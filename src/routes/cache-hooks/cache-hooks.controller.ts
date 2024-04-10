import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { CacheHooksService } from '@/routes/cache-hooks/cache-hooks.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { BasicAuthGuard } from '@/routes/common/auth/basic-auth.guard';
import { Event } from '@/routes/cache-hooks/entities/event.entity';
import { PreExecutionLogGuard } from '@/routes/cache-hooks/guards/pre-execution.guard';
import { WebHookSchema } from '@/routes/cache-hooks/entities/schemas/web-hook.schema';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Controller({
  path: '',
  version: '1',
})
@ApiExcludeController()
export class CacheHooksController {
  private readonly isEventHooksEndpointEnabled: boolean;
  constructor(
    private readonly service: CacheHooksService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.isEventHooksEndpointEnabled =
      this.configurationService.getOrThrow<boolean>('features.eventsQueue');
  }

  @UseGuards(PreExecutionLogGuard, BasicAuthGuard)
  @Post('/hooks/events')
  @HttpCode(202)
  async postEvent(
    @Body(new ValidationPipe(WebHookSchema)) event: Event,
  ): Promise<void> {
    if (!this.isEventHooksEndpointEnabled) {
      this.service.onEvent(event).catch((error) => {
        this.loggingService.error(error);
      });
    }
  }
}
