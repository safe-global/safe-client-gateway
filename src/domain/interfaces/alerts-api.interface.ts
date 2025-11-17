import type { AlertsRegistration } from '@/modules/alerts/domain/entities/alerts-registration.entity';
import type { AlertsDeletion } from '@/modules/alerts/domain/entities/alerts-deletion.entity';

export const IAlertsApi = Symbol('IAlertsApi');

export interface IAlertsApi {
  addContract(contract: AlertsRegistration): Promise<void>;

  deleteContract(contract: AlertsDeletion): Promise<void>;
}
