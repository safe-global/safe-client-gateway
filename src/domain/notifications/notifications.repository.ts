import { Inject } from '@nestjs/common';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { Device } from './entities/device.entity';
import { SafeRegistration } from './entities/safe-registration.entity';
import { INotificationsRepository } from './notifications.repository.interface';

export class NotificationsRepository implements INotificationsRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {}

  async registerDevice(
    device: Device,
    safeRegistration: SafeRegistration,
  ): Promise<void> {
    const api = await this.transactionApiManager.getTransactionApi(
      safeRegistration.chainId,
    );
    return api.postDeviceRegistration(
      device,
      safeRegistration.safes,
      safeRegistration.signatures,
    );
  }
}
