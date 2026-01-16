import { prisma } from '../lib/prisma.js';
// 1. Student Dashboard Data (Platform-wide access)
export const getStudentDashboard = async (req, res) => {
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ message: 'Unauthorized' });
    try {
        // Get latest enrollment (platform-wide, no courseId)
        const enrollment = await prisma.enrollment.findFirst({
            where: { userId, isActive: true },
            orderBy: { createdAt: 'desc' }
        });
        let accessStatus = 'inactive';
        let daysRemaining = 0;
        let expiresAt = null;
        if (enrollment) {
            const now = new Date();
            if (enrollment.expiresAt > now) {
                accessStatus = 'active';
                const diffTime = Math.abs(enrollment.expiresAt.getTime() - now.getTime());
                daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                expiresAt = enrollment.expiresAt;
            }
            else {
                accessStatus = 'expired';
                // Disable if expired but marked active
                // Ideally backend sets isActive=false on expiry, but we do lazy check here too.
            }
        }
        // Content Counts - platform-wide (all lessons across all courses)
        let contentCounts = { video: 0, audio: 0, pdf: 0 };
        if (accessStatus === 'active') {
            const lessons = await prisma.lesson.findMany();
            contentCounts.video = lessons.filter((l) => l.type === 'VIDEO').length;
            contentCounts.audio = lessons.filter((l) => l.type === 'AUDIO').length;
            contentCounts.pdf = lessons.filter((l) => l.type === 'PDF').length;
        }
        res.json({
            accessStatus,
            daysRemaining,
            expiresAt,
            activationDate: enrollment?.createdAt || null,
            contentCounts
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch dashboard data' });
    }
};
// 2. Recently Added Courses/Lessons
export const getRecentStudentContent = async (req, res) => {
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ message: 'Unauthorized' });
    const { limit, type } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(String(limit), 10) || 5, 1), 20);
    const normalizedType = typeof type === 'string' ? type.toLowerCase() : 'all';
    const shouldFetchCourses = normalizedType !== 'lessons';
    const shouldFetchLessons = normalizedType !== 'courses';
    try {
        const [courses, lessons] = await Promise.all([
            shouldFetchCourses
                ? prisma.course.findMany({
                    take: parsedLimit,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        code: true,
                        title: true,
                        description: true,
                        level: true,
                        semester: true,
                        session: true,
                        createdAt: true,
                    },
                })
                : Promise.resolve([]),
            shouldFetchLessons
                ? prisma.lesson.findMany({
                    take: parsedLimit,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        type: true,
                        createdAt: true,
                        course: {
                            select: { id: true, code: true, title: true },
                        },
                    },
                })
                : Promise.resolve([]),
        ]);
        res.json({ courses, lessons });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch recent content' });
    }
};
