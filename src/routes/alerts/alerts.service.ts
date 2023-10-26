import { Alert } from '@/routes/alerts/entities/alert.dto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AlertsService {
  onAlert(alert: Alert): void {
    console.log(alert);
  }
}
