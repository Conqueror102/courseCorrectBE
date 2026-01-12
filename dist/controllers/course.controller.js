import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
// 1. Create Course
export const createCourse = async (req, res) => {
    const { title, description, code, level, semester, session, lecturer, price } = req.body;
    try {
        // Validate uppercase Code
        const formattedCode = code.toUpperCase().trim();
        // Check unique constraint (handled by DB, but good to check)
        const existing = await prisma.course.findFirst({
            where: {
                code: formattedCode,
                session,
                semester,
                level,
            },
        });
        if (existing) {
            return res.status(409).json({ message: 'Course already exists for this session/semester/level' });
        }
        const course = await prisma.course.create({
            data: {
                title,
                description,
                code: formattedCode,
                level, // Enum Level
                semester, // Enum Semester
                session,
                lecturer,
                price: parseFloat(price) || 0,
            },
        });
        res.status(201).json(course);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to create course', error });
    }
};
// 2. Get Courses (Filterable)
export const getCourses = async (req, res) => {
    const { level, semester, session } = req.query;
    try {
        const where = {};
        if (level)
            where.level = level;
        if (semester)
            where.semester = semester;
        if (session)
            where.session = String(session);
        const courses = await prisma.course.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { lessons: true },
                },
            },
        });
        res.json(courses);
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch courses' });
    }
};
// 3. Delete Course
export const deleteCourse = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.course.delete({ where: { id } });
        res.json({ message: 'Course deleted' });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to delete course' });
    }
};
