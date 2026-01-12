import { PrismaClient, Role } from '@prisma/client';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
const prisma = new PrismaClient();
const generateTokens = (userId, role) => {
    const accessToken = jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId, role }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};
// 1. Register Student
export const register = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser)
            return res.status(400).json({ message: 'User already exists' });
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
        const tokens = generateTokens(user.id, user.role);
        res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, ...tokens });
    }
    catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};
// 2. Login
export const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user)
            return res.status(401).json({ message: 'Invalid credentials' });
        const validPassword = await argon2.verify(user.password, password);
        if (!validPassword)
            return res.status(401).json({ message: 'Invalid credentials' });
        const tokens = generateTokens(user.id, user.role);
        res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, ...tokens });
    }
    catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};
// 3. Activate Passkey
export const activatePasskey = async (req, res) => {
    const { passkey } = req.body;
    const userId = req.user?.id;
    if (!userId)
        return res.status(401).json({ message: 'Unauthorized' });
    try {
        const key = await prisma.passkey.findUnique({ where: { code: passkey } });
        if (!key)
            return res.status(404).json({ message: 'Invalid passkey' });
        if (key.isUsed)
            return res.status(400).json({ message: 'Passkey already used' });
        // Start Transaction
        await prisma.$transaction(async (tx) => {
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Activation failed' });
    }
};
