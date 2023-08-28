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
   * Un-registers a device notification target, identified by its client {@link uuid}.
   */
  unregisterDevice(args: { chainId: string; uuid: string }): Promise<void>;

  /**
   * Un-registers a Safe notification target, identified by its client {@link uuid} and
   * Safe {@link safeAddress}.
   */
  unregisterSafe(args: {
    chainId: string;
    uuid: string;
    safeAddress: string;
  }): Promise<void>;
}
