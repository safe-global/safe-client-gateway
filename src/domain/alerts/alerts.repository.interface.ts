import { AlertsRegistration } from '@/domain/alerts/entities/alerts.entity';
import { AlertLog } from '@/routes/alerts/entities/alert.dto.entity';

export const IAlertsRepository = Symbol('IAlertsRepository');

export interface IAlertsRepository {
  addContracts(contracts: Array<AlertsRegistration>): Promise<void>;

  handleAlertLog(log: AlertLog): void;
}
