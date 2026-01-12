import { Request, Response } from 'express';
import { Level, Semester, ContentType } from '@prisma/client';
import { getMuxUploadUrl, getCloudinarySignature, getAssetIdFromUpload, signMuxUrl, signCloudinaryUrl } from '../services/media.service.js';
import { prisma } from '../lib/prisma.js';

// 0. Get Upload URL (Step 1 for Frontend)
export const getUploadUrl = async (req: Request, res: Response) => {
    const { type } = req.body;

    try {
        if (type === 'VIDEO') {
            const url = await getMuxUploadUrl();
            return res.json({ url, type: 'mux' });
        } else {
            const signatureData = getCloudinarySignature(type);
            return res.json({ ...signatureData, type: 'cloudinary' });
        }
    } catch {
        res.status(500).json({ message: 'Failed to generate upload URL' });
    }
};

// 1. Create Lesson (Step 2: After FE uploads)
export const createLesson = async (req: Request, res: Response) => {
  try {
    const { 
      title, 
      description, 
      courseCode, 
      level, 
      semester, 
      academicSession, 
      type,
      courseTitle,
      lecturer,
      instructions,
      uploadId,
      publicId
    } = req.body;

    const code = (courseCode as string).toUpperCase().trim();
    const session = (academicSession as string).trim();
    const sem = semester as Semester;
    const lvl = level as Level;
    
    let course = await prisma.course.findUnique({
      where: {
        code_session_semester_level: {
          code,
          session,
          semester: sem,
          level: lvl,
        }
      }
    });

    if (!course) {
      course = await prisma.course.create({
        data: {
          code,
          session,
          semester: sem,
          level: lvl,
          title: courseTitle || code,
          lecturer: lecturer,
          description: description,
        }
      });
    }

    let fileUrl = '';
    
    if (type === 'VIDEO') {
      if (!uploadId) return res.status(400).json({ message: 'uploadId is required for VIDEO' });
      
      const { playbackId } = await getAssetIdFromUpload(uploadId);
      
      if (playbackId) {
          fileUrl = `mux:${playbackId}`;
      } else {
          fileUrl = `mux_pending:${uploadId}`;
      }
    } else {
      if (!publicId) return res.status(400).json({ message: 'publicId is required for Non-Video' });
      fileUrl = `cloudinary:${publicId}`;
    }

    const lesson = await prisma.lesson.create({
      data: {
        title,
        description,
        type: type as ContentType,
        fileUrl, 
        fileSize: 0,
        instructions,
        courseId: course.id,
      },
    });

    res.status(201).json({
      id: lesson.id,
      fileUrl: lesson.fileUrl,
      uploadedAt: lesson.createdAt,
      metadata: { ...req.body }
    });

  } catch {
    res.status(500).json({ message: 'Lesson creation failed' });
  }
};

// 2. Get Lesson Content (Retrieval)
export const getLesson = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const lesson = await prisma.lesson.findUnique({ where: { id } });
        if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const enrollment = await prisma.enrollment.findFirst({
            where: {
                userId,
                isActive: true,
                expiresAt: { gt: new Date() }
            }
        });

        const isAdmin = req.user?.role === 'ADMIN';

        if (!enrollment && !isAdmin) {
             return res.status(403).json({ message: 'Access Denied: No active platform access' });
        }

        let signedUrl = lesson.fileUrl;

        if (lesson.fileUrl.startsWith('mux:')) {
            const playbackId = lesson.fileUrl.split(':')[1];
            signedUrl = signMuxUrl(playbackId);
        } else if (lesson.fileUrl.startsWith('https://stream.mux.com/')) {
            const match = lesson.fileUrl.match(/stream\.mux\.com\/([^.]+)/);
            if (match) {
                const playbackId = match[1];
                signedUrl = signMuxUrl(playbackId);
            }
        } else if (lesson.fileUrl.startsWith('cloudinary:')) {
            const publicId = lesson.fileUrl.split(':')[1];
            const resourceType = lesson.type === 'PDF' ? 'raw' : 
                                 lesson.type === 'AUDIO' ? 'video' : 'image';
            signedUrl = signCloudinaryUrl(publicId, resourceType);
        }

        res.json({
            ...lesson,
            fileUrl: signedUrl
        });
    } catch {
        res.status(500).json({ message: 'Error retrieving lesson' });
    }
};

// 3. Get Course Lessons (List)
export const getCourseLessons = async (req: Request, res: Response) => {
    const { courseId } = req.params;
    
    try {
        const lessons = await prisma.lesson.findMany({
            where: { courseId },
            select: { id: true, title: true, type: true, description: true, createdAt: true }
        });
        res.json(lessons);
    } catch {
        res.status(500).json({ message: 'Error fetching lessons' });
    }
};

// 3b. Get All Lessons (Admin)
export const getAllLessons = async (req: Request, res: Response) => {
    const { page = 1, limit = 20, type, courseId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    try {
        const where: any = {};
        if (type) where.type = type;
        if (courseId) where.courseId = courseId;

        const [lessons, total] = await prisma.$transaction([
            prisma.lesson.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    course: {
                        select: { id: true, code: true, title: true }
                    }
                }
            }),
            prisma.lesson.count({ where })
        ]);

        res.json({
            data: lessons,
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    } catch {
        res.status(500).json({ message: 'Error fetching lessons' });
    }
};

// 4. Update Lesson (Admin)
export const updateLesson = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, description, instructions } = req.body;

    try {
        const lesson = await prisma.lesson.findUnique({ where: { id } });
        if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

        const updated = await prisma.lesson.update({
            where: { id },
            data: {
                ...(title && { title }),
                ...(description && { description }),
                ...(instructions !== undefined && { instructions }),
            },
        });

        res.json(updated);
    } catch {
        res.status(500).json({ message: 'Failed to update lesson' });
    }
};

// 5. Delete Lesson (Admin)
export const deleteLesson = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        await prisma.lesson.delete({ where: { id } });
        res.json({ message: 'Lesson deleted' });
    } catch {
        res.status(500).json({ message: 'Failed to delete lesson' });
    }
};

// 6. Proxy Lesson File (Streams Cloudinary files through backend)
export const proxyLessonFile = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const lesson = await prisma.lesson.findUnique({ where: { id } });
        if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const enrollment = await prisma.enrollment.findFirst({
            where: {
                userId,
                isActive: true,
                expiresAt: { gt: new Date() }
            }
        });

        const isAdmin = req.user?.role === 'ADMIN';

        if (!enrollment && !isAdmin) {
             return res.status(403).json({ message: 'Access Denied: No active platform access' });
        }

        let fileUrl = lesson.fileUrl;

        if (lesson.fileUrl.startsWith('cloudinary:')) {
            const publicId = lesson.fileUrl.split(':')[1];
            const resourceType = lesson.type === 'PDF' ? 'raw' : 
                                 lesson.type === 'AUDIO' ? 'video' : 'image';
            fileUrl = signCloudinaryUrl(publicId, resourceType);
        } else if (!lesson.fileUrl.startsWith('https://res.cloudinary.com/')) {
            return res.status(400).json({ message: 'Proxy only supports Cloudinary files.' });
        }

        const response = await fetch(fileUrl);
        
        if (!response.ok) {
            return res.status(response.status).json({ message: 'Failed to fetch file from storage' });
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const contentLength = response.headers.get('content-length');
        
        res.setHeader('Content-Type', contentType);
        if (contentLength) res.setHeader('Content-Length', contentLength);
        
        const extension = lesson.type === 'PDF' ? '.pdf' : lesson.type === 'AUDIO' ? '.mp3' : '.bin';
        res.setHeader('Content-Disposition', `inline; filename="${lesson.title}${extension}"`);

        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
        
    } catch {
        res.status(500).json({ message: 'Error streaming file' });
    }
};
