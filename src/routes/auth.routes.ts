import { Router } from 'express';
import { register, login, logout, activatePasskey, adminLogin } from '../controllers/auth.controller.js';

import { authenticate } from '../middleware/auth.middleware.js';


const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/admin/login', adminLogin);
router.post('/logout', authenticate, logout);
router.post('/activate-passkey', authenticate, activatePasskey);

export default router;
