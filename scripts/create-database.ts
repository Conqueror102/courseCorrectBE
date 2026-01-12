import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set in .env file');
  process.exit(1);
}

// Extract database name from DATABASE_URL
const url = new URL(DATABASE_URL.replace('postgresql://', 'http://'));
const databaseName = url.pathname.slice(1); // Remove leading '/'

// Create connection URL without database name (connect to default 'postgres' database)
const adminUrl = DATABASE_URL.replace(`/${databaseName}`, '/postgres');

console.log(`📦 Attempting to create database: ${databaseName}`);

const pool = new Pool({
  connectionString: adminUrl,
});

async function createDatabase() {
  try {
    // Check if database exists
    const result = await pool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [databaseName]
    );

    if (result.rows.length > 0) {
      console.log(`✅ Database '${databaseName}' already exists`);
      await pool.end();
      return;
    }

    // Create database
    await pool.query(`CREATE DATABASE "${databaseName}"`);
    console.log(`✅ Database '${databaseName}' created successfully!`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Run: pnpm prisma migrate dev`);
    console.log(`   2. This will create all the tables in your database`);
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log(`✅ Database '${databaseName}' already exists`);
    } else {
      console.error('❌ Error creating database:', error.message);
      console.error('\n💡 Alternative: Create the database manually using:');
      console.error(`   CREATE DATABASE "${databaseName}";`);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

createDatabase();


