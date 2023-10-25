import { Injectable } from '@nestjs/common';
import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { Alert } from '@/domain/alerts/entities/alerts.entity';

@Injectable()
export class AlertsRepository implements IAlertsRepository {
  alert(alert: Alert): void {
    console.log(alert);
  }
}
