import express from 'express';
import { handleMuxWebhook } from '../controllers/webhook.controller.js';

const router = express.Router();

// Note: Mux webhooks need the raw body for signature verification.
// We handle this by placing this route BEFORE express.json() in app.ts,
// or by using express.raw() middleware here if express.json() hasn't run yet.
router.post('/mux', express.json(), handleMuxWebhook);

export default router;
