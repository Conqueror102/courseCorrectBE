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
            message: 'Payment initialization failed',
            error: error.message 
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
            await processSuccessfulPayment(payment.id, payment.userId);
            return res.json({ status: 'success', message: 'Payment verified' });
        }

        res.json({ status: verification.data.status });
    } catch (error: any) {
        console.error('Payment verification error:', error);
        res.status(500).json({ 
            message: 'Payment verification failed',
            error: error.message
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
    const payload = JSON.stringify(req.body);
    if (!validateWebhookSignature(payload, signature)) {
        return res.status(401).send('Invalid signature');
    }

    const event = req.body;

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

            await processSuccessfulPayment(payment.id, payment.userId);
        } catch {
            return res.status(500).send('Processing error');
        }
    }

    res.sendStatus(200);
};

// Helper: Process successful payment
async function processSuccessfulPayment(paymentId: string, userId: string) {
    await prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'success' },
    });

    const setting = await prisma.systemSetting.findUnique({
        where: { key: 'ACCESS_MODE' }
    });
    const mode = setting?.value || 'DIRECT';

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    if (mode === 'DIRECT') {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await prisma.enrollment.create({
            data: {
                userId,
                isActive: true,
                expiresAt,
            }
        });
    } else {
        const passkey = generatePasskey(user.name);

        await prisma.passkey.create({
            data: {
                code: passkey,
                generatedBy: userId,
                userEmail: user.email,
            }
        });

        await sendPasskeyEmail(user.email, user.name, passkey);
    }
}
