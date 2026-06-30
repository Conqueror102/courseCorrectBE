import { Request, Response } from 'express';
import { Semester } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// 1. Create Course
export const createCourse = async (req: Request, res: Response) => {
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create course', error });
  }
};

// Helper: fetch the admin-managed option list for a given type.
const fetchOptions = (type: 'LEVEL' | 'SESSION', order: 'asc' | 'desc') =>
  prisma.courseOption.findMany({
    where: { type },
    orderBy: { value: order },
  });

// 1b. Get the managed list of levels (for forms/filters)
export const getCourseLevels = async (_req: Request, res: Response) => {
  try {
    const rows = await fetchOptions('LEVEL', 'asc');
    res.json(rows.map((row) => row.value));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch levels' });
  }
};

// 1c. Get the managed list of sessions (for forms/filters)
export const getCourseSessions = async (_req: Request, res: Response) => {
  try {
    const rows = await fetchOptions('SESSION', 'desc');
    res.json(rows.map((row) => row.value));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch sessions' });
  }
};

// 1c-2. Get full managed options (admin) — [{ id, type, value }] for management UI
export const getCourseOptions = async (_req: Request, res: Response) => {
  try {
    const options = await prisma.courseOption.findMany({
      orderBy: [{ type: 'asc' }, { value: 'asc' }],
    });
    res.json(options);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch options' });
  }
};

// 1d. Add a managed option (admin) — { type: 'LEVEL' | 'SESSION', value }
export const addCourseOption = async (req: Request, res: Response) => {
  const { type, value } = req.body;
  const normalizedType = String(type || '').toUpperCase();
  const normalizedValue = String(value || '').trim();

  if (normalizedType !== 'LEVEL' && normalizedType !== 'SESSION') {
    return res.status(400).json({ message: 'type must be LEVEL or SESSION' });
  }
  if (!normalizedValue) {
    return res.status(400).json({ message: 'value is required' });
  }

  try {
    const option = await prisma.courseOption.create({
      data: { type: normalizedType, value: normalizedValue },
    });
    res.status(201).json(option);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ message: 'That option already exists' });
    }
    console.error(error);
    res.status(500).json({ message: 'Failed to add option' });
  }
};

// 1e. Delete a managed option (admin)
export const deleteCourseOption = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.courseOption.delete({ where: { id } });
    res.json({ message: 'Option deleted' });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ message: 'Option not found' });
    }
    console.error(error);
    res.status(500).json({ message: 'Failed to delete option' });
  }
};

// 2. Get Courses (Filterable)
export const getCourses = async (req: Request, res: Response) => {
  const { level, semester, session } = req.query;

  try {
    const where: any = {};
    if (level) where.level = String(level);
    if (semester) where.semester = semester as Semester;
    if (session) where.session = String(session);

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
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch courses' });
  }
};

// 3. Delete Course
export const deleteCourse = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.course.delete({ where: { id } });
    res.json({ message: 'Course deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete course' });
  }
};

// 4. Update Course (Admin)
export const updateCourse = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, code, level, semester, session, lecturer, price } = req.body;

  try {
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) return res.status(404).json({ message: 'Course not found' });

    const updated = await prisma.course.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(code && { code: code.toUpperCase().trim() }),
        ...(level && { level: String(level) }),
        ...(semester && { semester: semester as Semester }),
        ...(session && { session }),
        ...(lecturer && { lecturer }),
        ...(price !== undefined && { price: parseFloat(price) || 0 }),
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update course' });
  }
};

// 5. Get Course Students (Admin) - Note: With platform-wide access, this shows all students with active access
export const getCourseStudents = async (req: Request, res: Response) => {
  try {
    // Since access is platform-wide, return all students with active enrollment
    const students = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        enrollments: {
          some: {
            isActive: true,
            expiresAt: { gt: new Date() }
          }
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        enrollments: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { expiresAt: true, createdAt: true }
        }
      }
    });

    const formatted = students.map((s: any) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      accessExpiresAt: s.enrollments[0]?.expiresAt,
      enrolledAt: s.enrollments[0]?.createdAt
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch students' });
  }
};
