import { Router } from 'express';
import { getStudentDashboard, getRecentStudentContent } from '../controllers/student.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { verifyEnrollment } from '../middleware/enrollment.middleware.js';
const router = Router();
// Protected Student Routes
router.use(authenticate);
router.get('/dashboard', getStudentDashboard);
router.get('/recent-content', verifyEnrollment, getRecentStudentContent);
export default router;
