import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_only_replace_in_prod',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_only_replace_in_prod_refresh',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
}));
