import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    const checks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: 'unknown' as 'ok' | 'error' | 'unknown',
      },
    };

    try {
      await this.dataSource.query('SELECT 1');
      checks.services.database = 'ok';
    } catch {
      checks.services.database = 'error';
      checks.status = 'degraded';
    }

    return checks;
  }

  @Get('live')
  liveness() {
    return { status: 'ok' };
  }

  @Get('ready')
  async readiness() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ready' };
    } catch {
      return { status: 'not_ready' };
    }
  }
}
