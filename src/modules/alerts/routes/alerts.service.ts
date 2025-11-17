import { IAlertsRepository } from '@/modules/alerts/domain/alerts.repository.interface';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { Alert } from '@/modules/alerts/routes/entities/alert.dto.entity';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class AlertsService {
  constructor(
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(IAlertsRepository)
    private readonly alertsRepository: IAlertsRepository,
  ) {}

  async onAlert(alert: Alert): Promise<void> {
    for (const log of alert.transaction.logs) {
      try {
        const chainId = alert.transaction.network;
        await this.alertsRepository.handleAlertLog(chainId, log);
      } catch {
        this.loggingService.warn('Unknown alert received');
      }
    }
  }
}
