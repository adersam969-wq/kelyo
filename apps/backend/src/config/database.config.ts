import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME || 'kelyo',
  password: process.env.DB_PASSWORD || 'kelyo_dev_password',
  database: process.env.DB_NAME || 'kelyo_dev',
  logging: process.env.DB_LOGGING === 'true',
  synchronize: false, // never true in any env — always use migrations
  migrationsRun: false,
}));
