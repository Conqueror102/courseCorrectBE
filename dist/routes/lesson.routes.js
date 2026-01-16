import { Router } from 'express';
import { getUploadUrl, createLesson, getLesson, getCourseLessons, getAllLessons, updateLesson, deleteLesson, proxyLessonFile } from '../controllers/lesson.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { verifyEnrollment } from '../middleware/enrollment.middleware.js';
import { Role } from '@prisma/client';
const router = Router();
// Admin Upload
router.post('/upload-url', authenticate, authorize([Role.ADMIN]), getUploadUrl);
// Get All Lessons (Admin only)
router.get('/all', authenticate, authorize([Role.ADMIN]), getAllLessons);
// Create Lesson (Admin)
router.post('/', authenticate, authorize([Role.ADMIN]), createLesson);
// Update Lesson (Admin)
router.put('/:id', authenticate, authorize([Role.ADMIN]), updateLesson);
// Delete Lesson (Admin)
router.delete('/:id', authenticate, authorize([Role.ADMIN]), deleteLesson);
// Proxy Lesson File (Streams Cloudinary files through backend to avoid CORS)
router.get('/:id/proxy', authenticate, proxyLessonFile);
// Get Specific Lesson (Protected - checks enrollment in controller)
router.get('/:id', authenticate, getLesson);
// Get Course Lessons (Protected by Enrollment - Admin bypasses)
router.get('/course/:courseId', authenticate, verifyEnrollment, getCourseLessons);
export default router;
