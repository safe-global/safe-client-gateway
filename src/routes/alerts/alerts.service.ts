import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { Alert } from '@/routes/alerts/entities/alert.dto.entity';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class AlertsService {
  constructor(
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(IAlertsRepository)
    private readonly alertsRepository: IAlertsRepository,
  ) {}

  onAlert(alert: Alert): void {
    for (const log of alert.transaction.logs) {
      try {
        this.alertsRepository.handleAlertLog(log);
      } catch {
        this.loggingService.warn('Unknown alert received');
      }
    }
  }
}
