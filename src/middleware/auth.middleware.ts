import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// Throttle for the "last seen" write so we don't hit the DB with an update on
// every single request.
const LAST_SEEN_UPDATE_MS = 5 * 60 * 1000; // 5 minutes

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        deviceId?: string;
      };
    }
  }
}

interface JwtPayload {
  userId: string;
  role: Role;
  deviceId?: string;
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;

    // Single-device rule: student tokens are bound to the device that logged in.
    // If another device has since taken the slot (or the token predates the
    // device system), the token is no longer valid.
    if (decoded.role === Role.STUDENT) {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { activeDeviceId: true, deviceLastSeenAt: true },
      });

      if (!user || !decoded.deviceId || user.activeDeviceId !== decoded.deviceId) {
        return res.status(401).json({ message: 'Session ended: this account is now signed in on another device.' });
      }

      const lastSeen = user.deviceLastSeenAt?.getTime() ?? 0;
      if (Date.now() - lastSeen > LAST_SEEN_UPDATE_MS) {
        prisma.user
          .update({ where: { id: decoded.userId }, data: { deviceLastSeenAt: new Date() } })
          .catch(() => {});
      }
    }

    req.user = { id: decoded.userId, role: decoded.role, deviceId: decoded.deviceId };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

export const authorize = (roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};
