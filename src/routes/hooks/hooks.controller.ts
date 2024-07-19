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
import { HooksService } from '@/routes/hooks/hooks.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { BasicAuthGuard } from '@/routes/common/auth/basic-auth.guard';
import { Event } from '@/routes/hooks/entities/event.entity';
import { EventSchema } from '@/routes/hooks/entities/schemas/event.schema';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { EventProtocolChangedError } from '@/routes/hooks/errors/event-protocol-changed.error';
import { EventProtocolChangedFilter } from '@/routes/hooks/filters/event-protocol-changed.filter';
import { ConfigEventType } from '@/routes/hooks/entities/event-type.entity';

@Controller({
  path: '',
  version: '1',
})
@ApiExcludeController()
export class HooksController {
  private readonly isEventsQueueEnabled: boolean;

  constructor(
    private readonly hooksService: HooksService,
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
  postEvent(@Body(new ValidationPipe(EventSchema)) event: Event): void {
    if (!this.isEventsQueueEnabled || this.isHttpEvent(event)) {
      this.hooksService.onEvent(event).catch((error) => {
        this.loggingService.error(error);
      });
    } else {
      throw new EventProtocolChangedError();
    }
  }

  private isHttpEvent(event: Event): boolean {
    return Object.values(ConfigEventType).includes(
      event.type as ConfigEventType,
    );
  }
}
