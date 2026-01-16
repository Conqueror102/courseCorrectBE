import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { env } from '../config/env.js';
if (!env.DATABASE_URL) {
    console.error('⚠️  DATABASE_URL is not set in environment variables');
    console.error('Please set DATABASE_URL in your .env file');
}
const pool = new Pool({
    connectionString: env.DATABASE_URL,
});
// Handle pool errors
pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
});
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
