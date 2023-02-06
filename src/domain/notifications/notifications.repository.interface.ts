import { Device } from './entities/device.entity';
import { SafeRegistration } from './entities/safe-registration.entity';

export const INotificationsRepository = Symbol('INotificationsRepository');

export interface INotificationsRepository {
  /**
   * Register a {@link Device} for notifications.
   * @param device
   * @param safeRegistration
   * @returns {@link SafeRegistration} on success
   */
  registerDevice(
    device: Device,
    safeRegistration: SafeRegistration,
  ): Promise<SafeRegistration>;
}
