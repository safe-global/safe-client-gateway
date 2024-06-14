import { Inject, Injectable } from '@nestjs/common';
import { Hex } from 'viem';
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
      const decodedTransactions = this._decodeTransactionAdded(
        decodedEvent.args.data,
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const newSafeState = this._mapSafeSetup({
        safe,
        decodedTransactions,
      });

      // TODO: Notify the user about the new Safe state
    } catch {
      // TODO: Notify the user about the unknown transaction
    }
  }

  private _decodeTransactionAdded(
    data: Hex,
  ): Array<ReturnType<typeof this._decodeRecoveryTransaction>> {
    try {
      return this.multiSendDecoder
        .mapMultiSendTransactions(data)
        .flatMap((multiSend) => {
          return this._decodeRecoveryTransaction(multiSend.data);
        });
    } catch {
      return [this._decodeRecoveryTransaction(data)];
    }
  }

  private _decodeRecoveryTransaction(
    data: Hex,
  ): ReturnType<typeof this.safeDecoder.decodeFunctionData> {
    const decoded = this.safeDecoder.decodeFunctionData({ data });

    const isRecoveryTransaction = [
      'addOwnerWithThreshold',
      'removeOwner',
      'swapOwner',
      'changeThreshold',
    ].includes(decoded.functionName);

    if (!isRecoveryTransaction) {
      throw new Error('Unknown recovery transaction');
    }

    return decoded;
  }

  private _mapSafeSetup(args: {
    safe: Safe;
    decodedTransactions: Array<ReturnType<SafeDecoder['decodeFunctionData']>>;
  }): Safe {
    return args.decodedTransactions.reduce((newSafe, decodedTransaction) => {
      switch (decodedTransaction.functionName) {
        case 'addOwnerWithThreshold': {
          const [ownerToAdd, newThreshold] = decodedTransaction.args;

          newSafe.owners.push(ownerToAdd);
          newSafe.threshold = Number(newThreshold);
          break;
        }
        case 'removeOwner': {
          const [, ownerToRemove, newThreshold] = decodedTransaction.args;

          newSafe.owners = newSafe.owners.filter((owner) => {
            return owner.toLowerCase() !== ownerToRemove.toLowerCase();
          });
          newSafe.threshold = Number(newThreshold);
          break;
        }
        case 'swapOwner': {
          const [, ownerToRemove, ownerToAdd] = decodedTransaction.args;

          newSafe.owners = newSafe.owners.map((owner) => {
            return owner.toLowerCase() === ownerToRemove.toLowerCase()
              ? ownerToAdd
              : owner;
          });
          break;
        }
        case 'changeThreshold': {
          const [newThreshold] = decodedTransaction.args;

          newSafe.threshold = Number(newThreshold);
          break;
        }
        default: {
          throw new Error(
            `Unknown recovery transaction ${decodedTransaction?.functionName}`,
          );
        }
      }

      return newSafe;
    }, structuredClone(args.safe));
  }
}
