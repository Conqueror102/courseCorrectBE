import { initializePayment, verifyPayment, validateWebhookSignature } from '../services/paystack.service.js';
import { sendPasskeyEmail } from '../services/email.service.js';
import { generatePasskey } from '../utils/passkey.util.js';
import { prisma } from '../lib/prisma.js';
// 1. Initialize Payment
export const initPayment = async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ message: 'Unauthorized' });
    try {
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        if (!dbUser)
            return res.status(404).json({ message: 'User not found' });
        // Check if user already has active access
        const existingEnrollment = await prisma.enrollment.findFirst({
            where: {
                userId: user.id,
                isActive: true,
                expiresAt: { gt: new Date() }
            }
        });
        if (existingEnrollment) {
            return res.status(400).json({
                message: 'You already have active platform access',
                expiresAt: existingEnrollment.expiresAt
            });
        }
        // Get platform price from settings
        const priceSetting = await prisma.systemSetting.findUnique({
            where: { key: 'PLATFORM_PRICE' }
        });
        const platformPrice = priceSetting ? parseFloat(priceSetting.value) : 5000;
        const amount = platformPrice * 100; // Paystack expects kobo
        const paymentData = await initializePayment(dbUser.email, amount, {
            userId: user.id,
            type: 'platform_access'
        });
        await prisma.payment.create({
            data: {
                userId: user.id,
                amount: platformPrice,
                reference: paymentData.reference,
                status: 'pending',
            }
        });
        res.json(paymentData);
    }
    catch {
        res.status(500).json({ message: 'Payment initialization failed' });
    }
};
// 2. Verify Payment Status
export const verifyPaymentStatus = async (req, res) => {
    const { reference } = req.params;
    const user = req.user;
    if (!user)
        return res.status(401).json({ message: 'Unauthorized' });
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
    }
    catch {
        res.status(500).json({ message: 'Payment verification failed' });
    }
};
// 3. Paystack Webhook
export const paystackWebhook = async (req, res) => {
    const signature = req.headers['x-paystack-signature'];
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
        }
        catch {
            return res.status(500).send('Processing error');
        }
    }
    res.sendStatus(200);
};
// Helper: Process successful payment
async function processSuccessfulPayment(paymentId, userId) {
    await prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'success' },
    });
    const setting = await prisma.systemSetting.findUnique({
        where: { key: 'ACCESS_MODE' }
    });
    const mode = setting?.value || 'DIRECT';
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        return;
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
    }
    else {
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
