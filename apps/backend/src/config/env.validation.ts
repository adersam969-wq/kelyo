import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, MinLength, validateSync } from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsNumber()
  PORT: number = 3000;

  @IsString()
  DB_HOST!: string;

  @IsNumber()
  DB_PORT!: number;

  @IsString()
  DB_USERNAME!: string;

  @IsString()
  DB_PASSWORD!: string;

  @IsString()
  DB_NAME!: string;

  @IsString()
  REDIS_HOST!: string;

  @IsNumber()
  REDIS_PORT!: number;

  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET must be at least 32 characters' })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_REFRESH_SECRET must be at least 32 characters' })
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @IsString()
  CINETPAY_API_KEY?: string;

  @IsOptional()
  @IsString()
  CINETPAY_SITE_ID?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('\n')}`,
    );
  }
  return validated;
}
