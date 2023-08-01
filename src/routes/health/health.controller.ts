import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController, ApiOkResponse } from '@nestjs/swagger';
import { Health, HealthStatus } from './entities/health.entity';
import { HealthService } from './health.service';

@Controller({ path: 'health' })
@ApiExcludeController()
export class HealthController {
  constructor(private readonly service: HealthService) {}

  @ApiOkResponse({ type: Health })
  @Get('live')
  liveness(): Health {
    return new Health(HealthStatus.OK);
  }

  @ApiOkResponse({ type: Health })
  @Get('ready')
  readiness(): Promise<Health> {
    return this.service.isReady();
  }
}
