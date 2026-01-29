import { Role } from '@prisma/client';
import argon2 from 'argon2';
import { prisma } from '../src/lib/prisma.js';
import dotenv from 'dotenv';

dotenv.config();

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
    process.exit(1);
  }

  try {
    const existingAdmin = await prisma.user.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      console.log(`Admin with email ${email} already exists.`);
      process.exit(0);
    }

    const hashedPassword = await argon2.hash(password);

    const admin = await prisma.user.create({
      data: {
        name: 'Super Admin',
        email,
        password: hashedPassword,
        role: Role.ADMIN,
      },
    });

    console.log(`Successfully created admin user: ${admin.email}`);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
