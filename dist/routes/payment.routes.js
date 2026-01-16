import { Router } from 'express';
import { initPayment, verifyPaymentStatus, paystackWebhook } from '../controllers/payment.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
const router = Router();
router.post('/initialize', authenticate, initPayment);
router.get('/verify/:reference', authenticate, verifyPaymentStatus);
router.post('/webhook', paystackWebhook); // No auth, verified by signature
export default router;
