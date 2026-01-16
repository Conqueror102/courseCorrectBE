import { Router } from 'express';
import { getDashboardStats, getStudents, manageStudent, grantAccess } from '../controllers/admin.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { Role } from '@prisma/client';
const router = Router();
// Protected Admin Routes
router.use(authenticate, authorize([Role.ADMIN]));
router.get('/dashboard', getDashboardStats);
router.get('/students', getStudents);
router.post('/students/:id/action', manageStudent);
router.post('/grant-access', grantAccess); // New Route
export default router;
