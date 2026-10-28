import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { HealthReport } from '@tsz/shared';
import { Public } from '../auth/decorators';
import { HealthService } from './health.service';

@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async get(): Promise<HealthReport> {
    const report = await this.health.check();
    if (report.status !== 'ok') {
      throw new HttpException(report, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return report;
  }
}
