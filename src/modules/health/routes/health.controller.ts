import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController, ApiOkResponse } from '@nestjs/swagger';
import { Health } from '@/modules/health/routes/entities/health.entity';
import { HealthService } from '@/modules/health/routes/health.service';

@Controller({ path: 'health' })
@ApiExcludeController()
export class HealthController {
  constructor(private readonly service: HealthService) {}

  @ApiOkResponse({ type: Health })
  @Get('live')
  liveness(): Promise<Health> {
    return this.service.isAlive();
  }

  @ApiOkResponse({ type: Health })
  @Get('ready')
  readiness(): Promise<Health> {
    return this.service.isReady();
  }
}
