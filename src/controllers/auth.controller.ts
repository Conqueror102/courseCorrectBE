import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import argon2 from 'argon2';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

const generateTokens = (userId: string, role: Role, deviceId?: string) => {
  const accessToken = jwt.sign({ userId, role, deviceId }, process.env.JWT_SECRET as string, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId, role, deviceId }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

// 1. Register Student
export const register = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  // Validate input
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await argon2.hash(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: Role.STUDENT,
      },
    });

    // Create pending payment or respond?
    // Requirement 1: "Create pending student record and initiate Paystack payment session"
    // For now, simple registration.

    const deviceId = String(req.body.deviceId || '') || crypto.randomUUID();
    await prisma.user.update({
      where: { id: user.id },
      data: { activeDeviceId: deviceId, deviceLastSeenAt: new Date() },
    });

    const tokens = generateTokens(user.id, user.role, deviceId);

    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, deviceId, ...tokens });
  } catch (error: any) {
    console.error('Registration error:', error);
    
    // Provide more specific error messages
    // Database doesn't exist (P1003)
    if (error?.code === 'P1003') {
      return res.status(500).json({ 
        message: `Database does not exist. Please create the database first.`,
        error: 'Database not found',
        hint: 'Run: CREATE DATABASE courseCorrect; in PostgreSQL, or update DATABASE_URL in .env'
      });
    }
    // Database connection errors (P1000)
    if (error?.code === 'P1000' || error?.message?.includes('authentication')) {
      return res.status(500).json({ 
        message: 'Database connection failed. Please check your DATABASE_URL credentials in .env file',
        error: 'Database authentication error'
      });
    }
    // Database connection refused (P1001)
    if (error?.code === 'P1001') {
      return res.status(500).json({ 
        message: 'Cannot reach database server. Please ensure PostgreSQL is running and DATABASE_URL is correct',
        error: 'Database connection refused'
      });
    }
    // Table doesn't exist (migrations not run) - P2021
    if (error?.code === 'P2021' || error?.message?.includes('does not exist in the current database')) {
      return res.status(500).json({ 
        message: 'Database tables not found. Please run: pnpm prisma migrate dev',
        error: 'Database schema not initialized'
      });
    }
    
    res.status(500).json({ 
      message: 'Server Error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// 2. Login
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const validPassword = await argon2.verify(user.password, password);
    if (!validPassword) return res.status(401).json({ message: 'Invalid credentials' });

    // Single-device rule (students only): the account stays bound to the device
    // that logged in until that device logs out or an admin resets the lock.
    if (user.role === Role.STUDENT) {
      const deviceId = String(req.body.deviceId || '') || crypto.randomUUID();

      if (user.activeDeviceId && user.activeDeviceId !== deviceId) {
        return res.status(409).json({
          message: 'This account is already in use on another device. Log out on that device first, or contact the admin to reset your account device.',
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { activeDeviceId: deviceId, deviceLastSeenAt: new Date() },
      });

      const tokens = generateTokens(user.id, user.role, deviceId);
      return res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, deviceId, ...tokens });
    }

    const tokens = generateTokens(user.id, user.role);

    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, ...tokens });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// 2b. Logout — frees the account's device slot so another device can sign in
export const logout = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

  try {
    // Only the currently bound device may release the lock; a stale token from
    // an evicted device must not clear a newer device's binding.
    await prisma.user.updateMany({
      where: {
        id: req.user.id,
        ...(req.user.deviceId ? { activeDeviceId: req.user.deviceId } : {}),
      },
      data: { activeDeviceId: null, deviceLastSeenAt: null },
    });

    res.json({ message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
};

// 4. Admin Login
export const adminLogin = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // Check if credentials match environment variables (specific request)
    // Or just check if the user exists in DB with ADMIN role.
    // We'll do BOTH to be safe: check DB first, and ensure they are ADMIN.
    
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || user.role !== Role.ADMIN) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    const validPassword = await argon2.verify(user.password, password);
    if (!validPassword) return res.status(401).json({ message: 'Invalid admin credentials' });

    const tokens = generateTokens(user.id, user.role);

    res.json({ 
      user: { id: user.id, name: user.name, email: user.email, role: user.role }, 
      ...tokens 
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// 3. Activate Passkey
export const activatePasskey = async (req: Request, res: Response) => {
    const { passkey } = req.body;
    const userId = req.user?.id;
  
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  
    try {
      const key = await prisma.passkey.findUnique({ where: { code: passkey } });
  
      if (!key) return res.status(404).json({ message: 'Invalid passkey' });
      if (key.isUsed) return res.status(400).json({ message: 'Passkey already used' });
  
      // Start Transaction
      await prisma.$transaction(async (tx: any) => {
        // Mark key used
        await tx.passkey.update({
          where: { id: key.id },
          data: { isUsed: true },
        });
  
        // Create Enrollment (30 days)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
  
        await tx.enrollment.create({
          data: {
            userId,
            expiresAt,
          },
        });
      });
  
      res.json({ message: 'Access activated successfully against global content for 30 days.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Activation failed' });
    }
  };
