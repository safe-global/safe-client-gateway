import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { inRange } from 'lodash';
import { Device } from '../../domain/notifications/entities/device.entity';
import { SafeRegistration } from '../../domain/notifications/entities/safe-registration.entity';
import { NotificationsRepository } from '../../domain/notifications/notifications.repository';
import { INotificationsRepository } from '../../domain/notifications/notifications.repository.interface';
import { RegisterDeviceDto } from './entities/register-device.dto.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(INotificationsRepository)
    private readonly notificationsRepository: NotificationsRepository,
  ) {}

  /**
   * Sends a registration request for each {@link SafeRegistration} contained in the received
   * {@link RegisterDeviceDto}, instructing the provider to register the {@link Device} as a
   * notification target on each chain referenced in one of the {@link SafeRegistration}.
   *
   * Since the provider requests are made independently, and they could error, the following
   * logic is followed to indicate the operation result to the client:
   *
   * - If no errors occur, HTTP 200 OK is sent to the client.
   *
   * - If the provider responds at least one server error (HTTP 500..599 code),
   *   then HTTP 500 is sent to the client.
   *
   * - If no server errors but the provider responds at least one client error
   *   (HTTP 400..499 code), then HTTP 400 is sent to the client.
   *
   * - Any other error (or status code not set) is assumed to be mapped to HTTP 503
   *   (see {@link HttpErrorFactory}).
   *
   * @param registerDeviceDto {@link RegisterDeviceDto} containing the data to register
   */
  async registerDevice(registerDeviceDto: RegisterDeviceDto): Promise<void> {
    const { deviceData, safeRegistration } = registerDeviceDto;
    const device = new Device(
      deviceData.uuid,
      deviceData.cloud_messaging_token,
      deviceData.buildNumber,
      deviceData.bundle,
      deviceData.device_type,
      deviceData.version,
      deviceData.timestamp,
    );

    const results = await Promise.allSettled(
      safeRegistration.map((safeRegistrationItem) =>
        this.notificationsRepository.registerDevice(
          device,
          new SafeRegistration(
            safeRegistrationItem.chain_id,
            safeRegistrationItem.safes,
            safeRegistrationItem.signatures,
          ),
        ),
      ),
    );

    if (this.hasServerErrors(results)) {
      throw new InternalServerErrorException();
    }
    if (this.hasClientErrors(results)) {
      throw new BadRequestException();
    }
  }

  private hasServerErrors(results: PromiseSettledResult<void>[]): boolean {
    return results.some(
      (result) =>
        result.status === 'rejected' && inRange(result.reason?.code, 500, 600),
    );
  }

  private hasClientErrors(results: PromiseSettledResult<void>[]): boolean {
    return results.some(
      (result) =>
        result.status === 'rejected' && inRange(result.reason?.code, 400, 500),
    );
  }
}
