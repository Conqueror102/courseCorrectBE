import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

// Platform-wide access check - user just needs ANY active enrollment
export const verifyEnrollment = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    // Check for ANY active enrollment (platform-wide access)
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });

    if (!enrollment) {
      return res.status(403).json({ message: 'Access Denied: No active platform access.' });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Error verifying enrollment' });
  }
};
