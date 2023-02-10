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

  /**
   * Un-registers a notification target, identified by its client {@link uuid}.
   * @param chainId
   * @param uuid
   * @param safeAddress
   */
  unregisterDevice(
    chainId: string,
    uuid: string,
    safeAddress: string,
  ): Promise<void>;
}
