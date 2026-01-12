import { Router } from 'express';
import { getSettings, updateSetting } from '../controllers/setting.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { Role } from '@prisma/client';

const router = Router();

// Admin Only
router.get('/', authenticate, authorize([Role.ADMIN]), getSettings);
router.put('/', authenticate, authorize([Role.ADMIN]), updateSetting);

export default router;
