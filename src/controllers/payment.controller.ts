import { Request, Response } from 'express';
import { initializePayment, verifyPayment, validateWebhookSignature } from '../services/paystack.service.js';
import { sendPasskeyEmail } from '../services/email.service.js';
import { generatePasskey } from '../utils/passkey.util.js';
import { prisma } from '../lib/prisma.js';

// 1. Initialize Payment
export const initPayment = async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    try {
        console.log('Initializing payment for user:', user.id);
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        if (!dbUser) {
            console.log('User not found in DB:', user.id);
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('User email:', dbUser.email);

        // Check if user already has active access
        const existingEnrollment = await prisma.enrollment.findFirst({
            where: {
                userId: user.id,
                isActive: true,
                expiresAt: { gt: new Date() }
            }
        });

        if (existingEnrollment) {
            console.log('User already has active access until:', existingEnrollment.expiresAt);
            return res.status(400).json({ 
                message: 'You already have active platform access',
                expiresAt: existingEnrollment.expiresAt
            });
        }

        // Get platform price from settings
        console.log('Fetching PLATFORM_PRICE setting...');
        const priceSetting = await prisma.systemSetting.findUnique({ 
            where: { key: 'PLATFORM_PRICE' } 
        });
        const platformPrice = priceSetting ? parseFloat(priceSetting.value) : 5000;
        console.log('Platform price:', platformPrice);
        
        if (isNaN(platformPrice)) {
            console.error('Invalid platform price in settings:', priceSetting?.value);
            throw new Error('Invalid platform price configuration');
        }

        const amount = platformPrice * 100; // Paystack expects kobo
        console.log('Amount in kobo:', amount);

        const { callback_url } = req.body;

        console.log('Calling Paystack initialization...');
        if (callback_url) console.log('Using callback URL:', callback_url);

        const paymentData = await initializePayment(
            dbUser.email, 
            amount, 
            {
                userId: user.id,
                type: 'platform_access'
            },
            callback_url
        );
        console.log('Paystack response:', paymentData);

        console.log('Creating payment record in DB...');
        await prisma.payment.create({
            data: {
                userId: user.id,
                amount: platformPrice,
                reference: paymentData.reference,
                status: 'pending',
            }
        });
        console.log('Payment record created successfully');

        res.json(paymentData);
    } catch (error: any) {
        console.error('Payment initialization error:', error);
        res.status(500).json({ 
            message: 'Payment initialization failed'
        });
    }
};

// 2. Verify Payment Status
export const verifyPaymentStatus = async (req: Request, res: Response) => {
    const { reference } = req.params;
    const user = req.user;

    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const payment = await prisma.payment.findUnique({ where: { reference } });
        
        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        if (payment.userId !== user.id) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        if (payment.status === 'success') {
            return res.json({ status: 'success', message: 'Payment already verified' });
        }

        // Verify with Paystack
        const verification = await verifyPayment(reference);

        if (verification.data.status === 'success') {
            await processSuccessfulPayment(
                payment.id,
                payment.userId,
                verification.data.amount,
                verification.data.customer.email
            );
            return res.json({ status: 'success', message: 'Payment verified' });
        }

        res.json({ status: verification.data.status });
    } catch (error: any) {
        console.error('Payment verification error:', error);
        res.status(500).json({ 
            message: 'Payment verification failed'
        });
    }
};

// 3. Paystack Webhook
export const paystackWebhook = async (req: Request, res: Response) => {
    const signature = req.headers['x-paystack-signature'] as string;
    
    if (!signature) {
        return res.status(400).send('No signature');
    }

    // Validate webhook signature
    const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    if (!validateWebhookSignature(payload, signature)) {
        return res.status(401).send('Invalid signature');
    }

    let event: any;
    try {
        event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8')) : req.body;
    } catch {
        return res.status(400).send('Invalid payload');
    }

    if (event.event === 'charge.success') {
        const { reference } = event.data;

        try {
            const payment = await prisma.payment.findUnique({ where: { reference } });
            
            if (!payment) {
                return res.status(200).send('Payment not found');
            }

            if (payment.status === 'success') {
                return res.status(200).send('Already processed');
            }

            await processSuccessfulPayment(
                payment.id,
                payment.userId,
                event.data.amount,
                event.data.customer?.email
            );
        } catch (error: any) {
            console.error('Webhook processing error for reference', reference, ':', error?.message, error);
            return res.status(500).send('Processing error');
        }
    }

    res.sendStatus(200);
};

// Helper: Process successful payment
async function processSuccessfulPayment(
    paymentId: string,
    userId: string,
    paidAmountKobo?: number,
    customerEmail?: string
) {
    const emailToSend = await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
            where: { id: paymentId },
            include: { user: true },
        });

        if (!payment || payment.status === 'success') {
            return null;
        }

        const expectedAmountKobo = Math.round(Number(payment.amount) * 100);
        // Accept exact and overpayment; only reject a genuine underpayment.
        // Transfers (OPay etc.) can settle at a slightly different amount than
        // was requested, so an exact-match check leaves them permanently stuck.
        if (paidAmountKobo !== undefined && paidAmountKobo < expectedAmountKobo) {
            throw new Error(`Payment amount too low: paid=${paidAmountKobo} expected=${expectedAmountKobo}`);
        }

        if (
            customerEmail &&
            payment.user.email.toLowerCase() !== customerEmail.toLowerCase()
        ) {
            throw new Error('Payment customer mismatch');
        }

        const claimed = await tx.payment.updateMany({
            where: {
                id: paymentId,
                status: { not: 'success' },
            },
            data: { status: 'processing' },
        });

        if (claimed.count === 0) {
            return null;
        }

        const setting = await tx.systemSetting.findUnique({
            where: { key: 'ACCESS_MODE' }
        });
        const mode = setting?.value || 'DIRECT';

        if (mode === 'DIRECT') {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

            await tx.enrollment.create({
                data: {
                    userId,
                    isActive: true,
                    expiresAt,
                }
            });

            await tx.payment.update({
                where: { id: paymentId },
                data: { status: 'success' },
            });

            return null;
        }

        const passkey = generatePasskey(payment.user.name);

        await tx.passkey.create({
            data: {
                code: passkey,
                generatedBy: userId,
                userEmail: payment.user.email,
            }
        });

        await tx.payment.update({
            where: { id: paymentId },
            data: { status: 'success' },
        });

        return {
            email: payment.user.email,
            name: payment.user.name,
            passkey,
        };
    });

    if (emailToSend) {
        const sent = await sendPasskeyEmail(emailToSend.email, emailToSend.name, emailToSend.passkey);
        if (!sent) {
            console.error('Payment processed, but passkey email failed to send');
        }
    }
}
