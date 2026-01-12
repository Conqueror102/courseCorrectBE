import { Router } from 'express';
import { createCourse, getCourses, deleteCourse, updateCourse, getCourseStudents } from '../controllers/course.controller.js';


import { authenticate, authorize } from '../middleware/auth.middleware.js';

import { Role } from '@prisma/client';

const router = Router();

// Public
router.get('/', getCourses);

// Admin Only
router.post('/', authenticate, authorize([Role.ADMIN]), createCourse);
router.put('/:id', authenticate, authorize([Role.ADMIN]), updateCourse);
router.delete('/:id', authenticate, authorize([Role.ADMIN]), deleteCourse);
router.get('/:id/students', authenticate, authorize([Role.ADMIN]), getCourseStudents);


export default router;
