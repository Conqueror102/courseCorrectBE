import { Router } from 'express';
import { uploadContent } from '../controllers/lesson.controller';
import { upload } from '../middleware/upload.middleware';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';
const router = Router();
// Admin Upload
router.post('/upload', authenticate, authorize([Role.ADMIN]), upload.single('file'), uploadContent);
export default router;
