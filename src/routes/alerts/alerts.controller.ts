import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Alert } from '@/routes/alerts/entities/alert.dto.entity';
import { AlertValidationPipe } from '@/routes/alerts/pipes/alert-validation.pipe';
import { AlertsService } from '@/routes/alerts/alerts.service';
import { AlertsRouteGuard } from '@/routes/alerts/guards/alerts-route.guard';
import { TenderlySignatureGuard } from '@/routes/alerts/guards/tenderly-signature.guard';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

@Controller({
  path: '',
  version: '1',
})
@ApiExcludeController()
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  @UseGuards(AlertsRouteGuard)
  @UseGuards(TenderlySignatureGuard)
  @Post('/alerts')
  @HttpCode(202)
  async postAlert(
    @Body(AlertValidationPipe)
    alertPayload: Alert,
  ): Promise<void> {
    // TODO: we return immediately but we should consider a pub/sub system to tackle received alerts
    //  which were not handled correctly (e.g. due to other 3rd parties being unavailable)
    this.alertsService
      .onAlert(alertPayload)
      .catch((reason) => this.loggingService.warn(reason));
  }
}
