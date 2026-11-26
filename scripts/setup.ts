import { execSync } from 'node:child_process';
import { ensureEnv, ensureDatabases } from './ensure-db.js';

console.info('=== Setting up SGEC ===');
ensureEnv();
ensureDatabases();

console.info('Applying Prisma migrations...');
execSync('npx prisma migrate deploy', { stdio: 'inherit' });

console.info('Seeding database...');
execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });

console.info('=== SGEC setup completed successfully ===');
