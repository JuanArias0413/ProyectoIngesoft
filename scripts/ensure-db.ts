import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export function ensureEnv(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  const envExamplePath = path.resolve(process.cwd(), '.env.example');

  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    const username = os.userInfo().username || process.env.USER || 'postgres';
    const sessionSecret = crypto.randomBytes(32).toString('hex');
    let content = fs.readFileSync(envExamplePath, 'utf-8');
    content = content.replace(/TU_USUARIO_SO/g, username);
    content = content.replace(
      /SESSION_SECRET=cambia-este-valor-por-uno-aleatorio-de-32-caracteres-o-mas/,
      `SESSION_SECRET=${sessionSecret}`,
    );
    fs.writeFileSync(envPath, content, 'utf-8');
    console.info('Created .env file configured for user:', username);
  }
}

export function ensureDatabases(): void {
  for (const dbName of ['sgec_dev', 'sgec_test']) {
    try {
      execSync(`createdb ${dbName} 2>/dev/null`, { stdio: 'ignore' });
      console.info(`Database ${dbName} created.`);
    } catch {
      // Database probably already exists, which is normal
    }
  }
}

if (process.argv[1]?.endsWith('ensure-db.ts')) {
  ensureEnv();
  ensureDatabases();
}
