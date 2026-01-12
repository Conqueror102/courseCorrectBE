import { Router } from 'express';
import { register, login, activatePasskey } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
const router = Router();
router.post('/register', register);
router.post('/login', login);
router.post('/activate-passkey', authenticate, activatePasskey);
export default router;
