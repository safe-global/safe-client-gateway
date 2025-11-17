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
import { HooksService } from '@/modules/hooks/routes/hooks.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { BasicAuthGuard } from '@/routes/common/auth/basic-auth.guard';
import { Event } from '@/modules/hooks/routes/entities/event.entity';
import { EventSchema } from '@/modules/hooks/routes/entities/schemas/event.schema';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { EventProtocolChangedError } from '@/modules/hooks/routes/errors/event-protocol-changed.error';
import { EventProtocolChangedFilter } from '@/modules/hooks/routes/filters/event-protocol-changed.filter';
import { ConfigEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Controller({
  path: '',
  version: '1',
})
@ApiExcludeController()
export class HooksController {
  private isHookHttpPostEventEnabled: boolean;
  constructor(
    private readonly hooksService: HooksService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,

    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.isHookHttpPostEventEnabled =
      this.configurationService.getOrThrow<boolean>(
        'features.hookHttpPostEvent',
      );
  }

  @UseGuards(BasicAuthGuard)
  @Post('/hooks/events')
  @UseFilters(EventProtocolChangedFilter)
  @HttpCode(202)
  postEvent(@Body(new ValidationPipe(EventSchema)) event: Event): void {
    if (this.isConfigEvent(event) || this.isHookHttpPostEventEnabled) {
      this.hooksService.onEvent(event).catch((error) => {
        this.loggingService.error(error);
      });
    } else {
      throw new EventProtocolChangedError();
    }
  }

  private isConfigEvent(event: Event): boolean {
    return Object.values(ConfigEventType).includes(
      event.type as ConfigEventType,
    );
  }
}
