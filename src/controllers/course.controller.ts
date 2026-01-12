import { Request, Response } from 'express';
import { Level, Semester } from '@prisma/client';
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

// 2. Get Courses (Filterable)
export const getCourses = async (req: Request, res: Response) => {
  const { level, semester, session } = req.query;

  try {
    const where: any = {};
    if (level) where.level = level as Level;
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
        ...(level && { level: level as Level }),
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

    const formatted = students.map(s => ({
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
