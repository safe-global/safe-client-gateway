import { Controller, Post, HttpCode, Body } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Alert } from '@/routes/alerts/entities/alert.dto.entity';
import { AlertValidationPipe } from '@/routes/alerts/pipes/alert-validation.pipe';
import { AlertsService } from '@/routes/alerts/alerts.service';

@Controller({
  path: '',
  version: '1',
})
@ApiExcludeController()
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post('/alerts')
  @HttpCode(200)
  postAlert(
    @Body(AlertValidationPipe)
    alertPayload: Alert,
  ): void {
    this.alertsService.onAlert(alertPayload);
  }
}
