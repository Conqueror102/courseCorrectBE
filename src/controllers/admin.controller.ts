import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// 1. Dashboard Stats (Req 8, 8.1)
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const totalStudents = await prisma.user.count({ where: { role: Role.STUDENT } });
    const activeAccess = await prisma.enrollment.count({ where: { isActive: true } });
    
    // Unpaid = Students without ANY Payment with status 'success'? 
    // Or just registered students minus active enrollments?
    // Let's use Students with NO Enrollments as "Unpaid" loosely for now.
    // Or check Payment table.
    const unpaidStudents = await prisma.user.count({ 
      where: { 
        role: Role.STUDENT, 
        enrollments: { none: {} } 
      } 
    });
    
    // Expired Access
    const expiredAccess = await prisma.enrollment.count({
      where: { isActive: false, expiresAt: { lt: new Date() } }
    });

    // Recent Activity (Stubbed or derived from createdAt)
    const recentActivity = await prisma.enrollment.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } }, course: { select: { code: true } } }
    });

    const formattedActivity = recentActivity.map((e: any) => ({
      text: `${e.user.name} enrolled in ${e.course?.code}`,
      time: e.createdAt,
      type: 'student_activated'
    }));

    res.json({
      metrics: {
        totalStudents,
        activeAccess,
        expiredAccess,
        unpaidStudents
      },
      recentActivity: formattedActivity
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dashboard stats' });
  }
};

// 2. List Students (Req 5.1)
export const getStudents = async (req: Request, res: Response) => {
  const { page = 1, limit = 10, search, status } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  try {
    const where: any = { role: Role.STUDENT };

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } }
      ];
    }

    // Filter by Active/Expired/Paid ??
    // Current DB structure: User -> Enrollment. 
    // "Active" means User has AT LEAST ONE active enrollment.
    // This filter is tricky in Prisma on User model relations.
    // We'll skip complex relation check in WHERE for now, or filter in memory if small.
    // Better: Filter users primarily.
    
    const [students, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        select: {
          id: true,
          name: true,
          email: true,
          enrollments: {
            orderBy: { createdAt: 'desc' },
            take: 1, // Last enrollment
            select: { isActive: true, expiresAt: true, courseId: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    // Format response
    const formatted = students.map((s: any) => {
      const lastEnrollment = s.enrollments[0];
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        accessStatus: lastEnrollment?.isActive ? 'active' : 'expired',
        lastCourse: lastEnrollment?.courseId,
        expiresAt: lastEnrollment?.expiresAt
      };
    });

    res.json({
      data: formatted,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit)
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch students' });
  }
};

// 3. Manage Student (Disable, Extend, Delete)
export const manageStudent = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, days } = req.body; // action: 'disable' | 'extend' | 'delete'

  try {
    if (action === 'delete') {
      // Soft delete? User doesn't have deletedAt. Hard delete for now.
      await prisma.user.delete({ where: { id } });
      return res.json({ message: 'Student deleted' });
    }

    // For Extend/Disable, we need relevant enrollment.
    // Affects ALL active enrollments or specific?
    // Let's assume most recent.
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId: id },
      orderBy: { createdAt: 'desc' }
    });

    if (!enrollment) return res.status(404).json({ message: 'No enrollment found for student' });

    if (action === 'disable') {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { isActive: false }
      });
      return res.json({ message: 'Access disabled' });
    }

    if (action === 'extend' && days) {
      const currentExpiry = enrollment.expiresAt > new Date() ? enrollment.expiresAt : new Date();
      const newExpiry = new Date(currentExpiry);
      newExpiry.setDate(newExpiry.getDate() + Number(days));
      
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { 
          expiresAt: newExpiry,
          isActive: true // Re-activate if expired
        }
      });
      return res.json({ message: `Access extended by ${days} days` });
    }

    res.status(400).json({ message: 'Invalid action' });
  } catch (error) {
    res.status(500).json({ message: 'Action failed', error });
  }
};

// 4. Manual Access Grant (Platform-wide, no courseId needed)
export const grantAccess = async (req: Request, res: Response) => {
  const { studentId } = req.body;
  
  try {
    const user = await prisma.user.findUnique({ where: { id: studentId } });
    if (!user || user.role !== Role.STUDENT) {
        return res.status(404).json({ message: 'Student not found' });
    }

    // Check setting - create if doesn't exist
    let setting = await prisma.systemSetting.findUnique({ where: { key: 'ACCESS_MODE' } });
    
    if (!setting) {
      setting = await prisma.systemSetting.create({
        data: {
          key: 'ACCESS_MODE',
          value: 'DIRECT'
        }
      });
    }
    
    const mode = setting.value.trim().toUpperCase();
    console.log('Access Mode:', mode);

    if (mode === 'DIRECT') {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        
        await prisma.enrollment.create({
            data: {
                userId: studentId,
                isActive: true,
                expiresAt
            }
        });
        return res.json({ message: 'Access granted directly (Platform enrollment created)' });
    } else {
        const { generatePasskey } = await import('../utils/passkey.util.js');
        const passkey = generatePasskey(user.name);

        await prisma.passkey.create({
            data: {
                code: passkey,
                generatedBy: req.user?.id || 'admin',
                userEmail: user.email
            }
        });
         
        return res.json({ message: 'Passkey generated', passkey });
    }

  } catch (error) {
      res.status(500).json({ message: 'Failed to grant access', error });
  }
};

// 5. List Transactions (Backend for Admin Tracking)
export const getTransactions = async (req: Request, res: Response) => {
  const { page = 1, limit = 10, status, search } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  try {
    const where: any = {};

    if (status) {
      where.status = String(status);
    }

    if (search) {
      where.OR = [
        { reference: { contains: String(search), mode: 'insensitive' } },
        { user: { name: { contains: String(search), mode: 'insensitive' } } },
        { user: { email: { contains: String(search), mode: 'insensitive' } } }
      ];
    }

    const [transactions, total] = await prisma.$transaction([
      prisma.payment.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          course: {
            select: {
              code: true,
              title: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.payment.count({ where })
    ]);

    res.json({
      data: transactions,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
};

// 6. Transaction Statistics
export const getTransactionStats = async (req: Request, res: Response) => {
  try {
    // Total Revenue (Successful payments)
    const revenueResult = await prisma.payment.aggregate({
      where: { status: 'success' },
      _sum: { amount: true }
    });

    const totalRevenue = revenueResult._sum.amount || 0;

    // Total Transactions count
    const totalTransactions = await prisma.payment.count();
    
    // Successful Transactions count
    const successfulTransactions = await prisma.payment.count({
      where: { status: 'success' }
    });

    // Failed/Pending count
    const pendingTransactions = await prisma.payment.count({
      where: { status: 'pending' }
    });

    // Daily revenue for the last 7 days (Chart data)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyRevenue = await prisma.payment.findMany({
      where: {
        status: 'success',
        createdAt: { gte: sevenDaysAgo }
      },
      select: {
        amount: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Grouping by date in memory for simpler chart data format
    const chartData = dailyRevenue.reduce((acc: any, curr: any) => {
      const date = curr.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = 0;
      }
      acc[date] += curr.amount;
      return acc;
    }, {});

    const formattedChartData = Object.keys(chartData).map(date => ({
      date,
      revenue: chartData[date]
    }));

    res.json({
      summary: {
        totalRevenue,
        totalTransactions,
        successfulTransactions,
        pendingTransactions,
        successRate: totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0
      },
      chartData: formattedChartData
    });
  } catch (error) {
    console.error('Failed to fetch transaction stats:', error);
    res.status(500).json({ message: 'Failed to fetch transaction stats' });
  }
};

