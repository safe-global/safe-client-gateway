import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { inRange } from 'lodash';
import { Device } from '../../domain/notifications/entities/device.entity';
import { SafeRegistration as DomainSafeRegistration } from '../../domain/notifications/entities/safe-registration.entity';
import { INotificationsRepository } from '../../domain/notifications/notifications.repository.interface';
import { RegisterDeviceDto } from './entities/register-device.dto.entity';
import { SafeRegistration } from './entities/safe-registration.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(INotificationsRepository)
    private readonly notificationsRepository: INotificationsRepository,
  ) {}

  /**
   * Sends a registration request for each {@link DomainSafeRegistration} contained in the received
   * {@link RegisterDeviceDto}, instructing the provider to register the {@link Device} as a
   * notification target on each chain referenced in one of the {@link DomainSafeRegistration}.
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

    const registrationResults = await Promise.allSettled(
      safeRegistration.map((safeRegistrationItem) =>
        this.notificationsRepository.registerDevice(
          device,
          new DomainSafeRegistration(
            safeRegistrationItem.chain_id,
            safeRegistrationItem.safes,
            safeRegistrationItem.signatures,
          ),
        ),
      ),
    );

    if (registrationResults.some((result) => this.isServerError(result))) {
      throw new InternalServerErrorException(
        this.getErrorMessage(registrationResults, safeRegistration),
      );
    }
    if (registrationResults.some((result) => this.isClientError(result))) {
      throw new BadRequestException(
        this.getErrorMessage(registrationResults, safeRegistration),
      );
    }
  }

  /**
   * Sends a delete request.
   * The uuid is expected to be managed by the client. Its value should be equal
   * to the one provided when the client called {@link registerDevice}.
   *
   * @param chainId chain id to use.
   * @param uuid the same uuid provided when the device was registered.
   * @param safeAddress safe address of the un-registration target.
   */
  async unregisterDevice(
    chainId: string,
    uuid: string,
    safeAddress: string,
  ): Promise<void> {
    return this.notificationsRepository.unregisterDevice(
      chainId,
      uuid,
      safeAddress,
    );
  }

  private isServerError(
    result: PromiseSettledResult<DomainSafeRegistration>,
  ): boolean {
    return (
      result.status === 'rejected' && inRange(result.reason?.code, 500, 600)
    );
  }

  private isClientError(
    result: PromiseSettledResult<DomainSafeRegistration>,
  ): boolean {
    return (
      result.status === 'rejected' && inRange(result.reason?.code, 400, 500)
    );
  }

  private getErrorMessage(
    registrationResults: PromiseSettledResult<DomainSafeRegistration>[],
    safeRegistration: SafeRegistration[],
  ): string {
    const successChainIds = (
      registrationResults.filter(
        ({ status }) => status === 'fulfilled',
      ) as PromiseFulfilledResult<DomainSafeRegistration>[]
    ).map((registrationResult) => registrationResult.value.chainId);

    const erroredChainIds = safeRegistration
      .map((safeRegistrationItem) => safeRegistrationItem.chain_id)
      .filter((chainId) => !successChainIds.includes(chainId));

    return `Push notification registration failed for chain IDs: ${erroredChainIds}`;
  }
}
