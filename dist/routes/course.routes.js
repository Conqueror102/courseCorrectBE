import { Router } from 'express';
import { createCourse, getCourses, deleteCourse } from '../controllers/course.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';
const router = Router();
// Public? Or Student? Use authenticate for "Get Courses" to verify access?
// PRD: "Student... Browse available courses". Usually public or student.
router.get('/', getCourses);
// Admin Only
router.post('/', authenticate, authorize([Role.ADMIN]), createCourse);
router.delete('/:id', authenticate, authorize([Role.ADMIN]), deleteCourse);
export default router;
