import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load .env from multiple locations
// When running from api/ directory, we need to go up one level to find root .env
const cwd = process.cwd();
const isInApiDir = cwd.endsWith('api') || cwd.endsWith('api\\') || cwd.endsWith('api/');
const rootDir = isInApiDir ? join(cwd, '..') : cwd;

const envPaths = [
  join(rootDir, '.env'),                 // root/.env (when running from api/)
  join(cwd, '.env'),                     // current directory .env
  join(__dirname, '../../.env'),         // api/.env (relative to this file)
  join(__dirname, '../../../.env'),      // root/.env (relative to this file)
  '.env',                                 // fallback
];

console.log('🔍 Searching for .env file...');
console.log('📁 Current directory:', cwd);
console.log('📁 Root directory:', rootDir);

let envLoaded = false;
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
    envLoaded = true;
    console.log(`📄 Loaded .env from: ${envPath}`);
    break;
  }
}

// Also try default dotenv.config() as fallback
if (!envLoaded) {
  dotenv.config();
  console.log('📄 Using default dotenv.config()');
}

const { Pool } = pg;

// Get password and handle quotes if present
const rawPassword = process.env.DB_PASSWORD || '';
const password = rawPassword.replace(/^["']|["']$/g, ''); // Remove surrounding quotes if any

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'netsentinel',
  user: process.env.DB_USER || 'postgres',
  password: password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Check if password is missing
if (!dbConfig.password) {
  console.error('❌ DB_PASSWORD is not set in .env file');
  console.error('📝 Please create api/.env file with your database credentials');
  console.error('📋 Copy api/.env.example to api/.env and update the values');
  console.error('💡 Current working directory:', process.cwd());
  console.error('💡 Looking for .env in:', envPaths);
  console.error('💡 Environment variables:', {
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD ? '***' : 'NOT SET',
  });
  process.exit(1);
}

const pool = new Pool(dbConfig);

// Test connection
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err: Error) => {
  console.error('❌ Database connection error:', err.message);
  if (err.message.includes('password authentication failed')) {
    console.error('💡 Tip: Check your DB_PASSWORD in api/.env file');
  }
  // Don't exit on error, let the app handle it
});

export default pool;

