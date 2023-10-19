import { Inject } from '@nestjs/common';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { Device } from '@/domain/notifications/entities/device.entity';
import { SafeRegistration } from '@/domain/notifications/entities/safe-registration.entity';
import { INotificationsRepository } from '@/domain/notifications/notifications.repository.interface';

export class NotificationsRepository implements INotificationsRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {}

  async registerDevice(
    device: Device,
    safeRegistration: SafeRegistration,
  ): Promise<SafeRegistration> {
    const api = await this.transactionApiManager.getTransactionApi(
      safeRegistration.chainId,
    );
    await api.postDeviceRegistration({
      device,
      safes: safeRegistration.safes,
      signatures: safeRegistration.signatures,
    });
    return safeRegistration;
  }

  async unregisterDevice(args: {
    chainId: string;
    uuid: string;
  }): Promise<void> {
    const api = await this.transactionApiManager.getTransactionApi(
      args.chainId,
    );
    return api.deleteDeviceRegistration(args.uuid);
  }

  async unregisterSafe(args: {
    chainId: string;
    uuid: string;
    safeAddress: string;
  }): Promise<void> {
    const api = await this.transactionApiManager.getTransactionApi(
      args.chainId,
    );
    return api.deleteSafeRegistration({
      uuid: args.uuid,
      safeAddress: args.safeAddress,
    });
  }
}
