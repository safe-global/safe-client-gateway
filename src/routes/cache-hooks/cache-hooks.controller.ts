import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { CacheHooksService } from '@/routes/cache-hooks/cache-hooks.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { BasicAuthGuard } from '@/routes/common/auth/basic-auth.guard';
import { Event } from '@/routes/cache-hooks/entities/event.entity';
import { WebHookSchema } from '@/routes/cache-hooks/entities/schemas/web-hook.schema';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { EventProtocolChangedError } from '@/routes/cache-hooks/errors/event-protocol-changed.error';
import { EventProtocolChangedFilter } from '@/routes/cache-hooks/filters/event-protocol-changed.filter';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';

@Controller({
  path: '',
  version: '1',
})
@ApiExcludeController()
export class CacheHooksController {
  private readonly isEventsQueueEnabled: boolean;
  private readonly configServiceEventTypes = [
    EventType.CHAIN_UPDATE,
    EventType.SAFE_APPS_UPDATE,
  ];

  constructor(
    private readonly service: CacheHooksService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.isEventsQueueEnabled = this.configurationService.getOrThrow<boolean>(
      'features.eventsQueue',
    );
  }

  @UseGuards(BasicAuthGuard)
  @Post('/hooks/events')
  @UseFilters(EventProtocolChangedFilter)
  @HttpCode(202)
  async postEvent(
    @Body(new ValidationPipe(WebHookSchema)) event: Event,
  ): Promise<void> {
    if (!this.isEventsQueueEnabled || this.isHttpEvent(event)) {
      this.service.onEvent(event).catch((error) => {
        this.loggingService.error(error);
      });
    } else {
      throw new EventProtocolChangedError();
    }
  }

  private isHttpEvent(event: Event): boolean {
    return this.configServiceEventTypes.includes(event.type);
  }
}
