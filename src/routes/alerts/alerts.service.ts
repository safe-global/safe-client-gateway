import { Alert } from '@/routes/alerts/entities/alert.dto.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AlertsService {
  onAlert(alert: Alert): void {
    console.log(alert);
  }
}
