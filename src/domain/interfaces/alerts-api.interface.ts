import { AlertsRegistration } from '@/domain/alerts/entities/alerts.entity';

export const IAlertsApi = Symbol('IAlertsApi');

export interface IAlertsApi {
  addContract(contract: AlertsRegistration): Promise<void>;
}
