import { Device } from './entities/device.entity';
import { SafeRegistration } from './entities/safe-registration.entity';

export const INotificationsRepository = Symbol('INotificationsRepository');

export interface INotificationsRepository {
  registerDevice(
    device: Device,
    safeRegistration: SafeRegistration,
  ): Promise<void>;
}
