import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  corsOrigins: process.env.CORS_ORIGINS || '',
}));
