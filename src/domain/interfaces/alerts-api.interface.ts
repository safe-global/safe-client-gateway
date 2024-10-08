import type { AlertsRegistration } from '@/domain/alerts/entities/alerts-registration.entity';
import type { AlertsDeletion } from '@/domain/alerts/entities/alerts-deletion.entity';

export const IAlertsApi = Symbol('IAlertsApi');

export interface IAlertsApi {
  addContract(contract: AlertsRegistration): Promise<void>;

  deleteContract(contract: AlertsDeletion): Promise<void>;
}
