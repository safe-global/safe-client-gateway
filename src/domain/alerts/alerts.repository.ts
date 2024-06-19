import { Inject, Injectable } from '@nestjs/common';
import { Hex, isAddressEqual } from 'viem';
import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { IAlertsApi } from '@/domain/interfaces/alerts-api.interface';
import { AlertsRegistration } from '@/domain/alerts/entities/alerts-registration.entity';
import { AlertsDeletion } from '@/domain/alerts/entities/alerts-deletion.entity';
import { AlertLog } from '@/routes/alerts/entities/alert.dto.entity';
import { DelayModifierDecoder } from '@/domain/alerts/contracts/decoders/delay-modifier-decoder.helper';
import { SafeDecoder } from '@/domain/contracts/decoders/safe-decoder.helper';
import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { Safe } from '@/domain/safe/entities/safe.entity';

@Injectable()
export class AlertsRepository implements IAlertsRepository {
  constructor(
    @Inject(IAlertsApi)
    private readonly alertsApi: IAlertsApi,
    private readonly delayModifierDecoder: DelayModifierDecoder,
    private readonly safeDecoder: SafeDecoder,
    private readonly multiSendDecoder: MultiSendDecoder,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
  ) {}

  async addContract(contract: AlertsRegistration): Promise<void> {
    await this.alertsApi.addContract(contract);
  }

  async deleteContract(contract: AlertsDeletion): Promise<void> {
    await this.alertsApi.deleteContract(contract);
  }

  async handleAlertLog(chainId: string, log: AlertLog): Promise<void> {
    const moduleAddress = log.address;

    const { safes } = await this.safeRepository.getSafesByModule({
      chainId,
      moduleAddress,
    });

    if (safes.length === 0) {
      this.loggingService.debug(
        `An alert for a module that is not activated on a Safe was received. moduleAddress=${moduleAddress}`,
      );
      return;
    }

    // Recovery module is deployed per Safe so we can assume that it is only enabled on one
    const safeAddress = safes[0];

    try {
      const safe = await this.safeRepository.getSafe({
        chainId,
        address: safeAddress,
      });

      const decodedEvent = this.delayModifierDecoder.decodeEventLog({
        data: log.data as Hex,
        topics: log.topics as [Hex, Hex, Hex],
      });

      if (isAddressEqual(decodedEvent.args.to, safeAddress)) {
        throw new Error('Alert is not for the Safe');
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const newSafeState = this._mapSafeSetup({
        safe,
        data: decodedEvent.args.data,
      });

      // TODO: Notify the user about the new Safe state
    } catch {
      // TODO: Notify the user about the unknown transaction
    }
  }

  private _mapSafeSetup(args: { safe: Safe; data: `0x${string}` }): Safe {
    const newSafe = structuredClone(args.safe);

    const transactions = ((): Array<`0x${string}`> => {
      if (!this.multiSendDecoder.helpers.isMultiSend(args.data)) {
        return [args.data];
      }
      return this.multiSendDecoder
        .mapMultiSendTransactions(args.data)
        .map((transaction) => transaction.data);
    })();

    for (const data of transactions) {
      const addOwnerWithThreshold = this.safeDecoder.decodeFunctionData({
        data,
        functionName: 'addOwnerWithThreshold',
      });
      const removeOwner = this.safeDecoder.decodeFunctionData({
        data,
        functionName: 'removeOwner',
      });
      const swapOwner = this.safeDecoder.decodeFunctionData({
        data,
        functionName: 'swapOwner',
      });
      const changeThreshold = this.safeDecoder.decodeFunctionData({
        data,
        functionName: 'changeThreshold',
      });

      if (addOwnerWithThreshold) {
        // Add new owner and set new threshold
        const [ownerToAdd, newThreshold] = addOwnerWithThreshold;
        newSafe.owners.push(ownerToAdd);
        newSafe.threshold = Number(newThreshold);
      } else if (removeOwner) {
        // Remove specified owner and set new threshold
        const [, ownerToRemove, newThreshold] = removeOwner;
        newSafe.owners = newSafe.owners.filter((owner) => {
          return isAddressEqual(owner, ownerToRemove);
        });
        newSafe.threshold = Number(newThreshold);
      } else if (swapOwner) {
        // Swap specified owner with new owner
        const [, ownerToRemove, ownerToAdd] = swapOwner;
        newSafe.owners = newSafe.owners.map((owner) => {
          return isAddressEqual(owner, ownerToRemove) ? ownerToAdd : owner;
        });
      } else if (changeThreshold) {
        // Set new threshold
        const [newThreshold] = changeThreshold;
        newSafe.threshold = Number(newThreshold);
      } else {
        throw new Error('Unknown transaction data');
      }
    }

    return newSafe;
  }
}
