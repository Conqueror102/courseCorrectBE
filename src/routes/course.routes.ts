import { Router } from 'express';
import {
  createCourse,
  getCourses,
  getCourseLevels,
  getCourseSessions,
  getCourseOptions,
  addCourseOption,
  deleteCourseOption,
  deleteCourse,
  updateCourse,
  getCourseStudents,
} from '../controllers/course.controller.js';


import { authenticate, authorize } from '../middleware/auth.middleware.js';

import { Role } from '@prisma/client';

const router = Router();

// Public — managed option lists for forms/filters
router.get('/', getCourses);
router.get('/levels', getCourseLevels);
router.get('/sessions', getCourseSessions);

// Admin Only — manage option lists
router.get('/options', authenticate, authorize([Role.ADMIN]), getCourseOptions);
router.post('/options', authenticate, authorize([Role.ADMIN]), addCourseOption);
router.delete('/options/:id', authenticate, authorize([Role.ADMIN]), deleteCourseOption);

// Admin Only — courses
router.post('/', authenticate, authorize([Role.ADMIN]), createCourse);
router.put('/:id', authenticate, authorize([Role.ADMIN]), updateCourse);
router.delete('/:id', authenticate, authorize([Role.ADMIN]), deleteCourse);
router.get('/:id/students', authenticate, authorize([Role.ADMIN]), getCourseStudents);


export default router;
