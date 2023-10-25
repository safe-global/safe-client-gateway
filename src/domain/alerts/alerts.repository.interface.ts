import { Alert } from '@/domain/alerts/entities/alert.entity';

export const IAlertsRepository = Symbol('IAlertsRepository');

export interface IAlertsRepository {
  alert(alert: Alert): void;
}
