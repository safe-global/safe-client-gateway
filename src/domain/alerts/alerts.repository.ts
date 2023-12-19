import { Inject, Injectable } from '@nestjs/common';
import { Hex } from 'viem';
import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { IAlertsApi } from '@/domain/interfaces/alerts-api.interface';
import { AlertsRegistration } from '@/domain/alerts/entities/alerts.entity';
import { AlertLog } from '@/routes/alerts/entities/alert.dto.entity';
import { DelayModifierDecoder } from '@/domain/alerts/contracts/delay-modifier-decoder.helper';
import { SafeDecoder } from '@/domain/alerts/contracts/safe-decoder.helper';
import { MultiSendDecoder } from '@/domain/alerts/contracts/multi-send-decoder.helper';
import { IEmailApi } from '@/domain/interfaces/email-api.interface';
import { IEmailRepository } from '@/domain/email/email.repository.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IModulesRepository } from '@/domain/modules/modules.repository.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { Safe } from '@/domain/safe/entities/safe.entity';

@Injectable()
export class AlertsRepository implements IAlertsRepository {
  constructor(
    @Inject(IAlertsApi)
    private readonly alertsApi: IAlertsApi,
    @Inject(IEmailApi)
    private readonly emailApi: IEmailApi,
    @Inject(IEmailRepository)
    private readonly emailRepository: IEmailRepository,
    private readonly delayModifierDecoder: DelayModifierDecoder,
    private readonly safeDecoder: SafeDecoder,
    private readonly multiSendDecoder: MultiSendDecoder,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IModulesRepository)
    private readonly modulesRepository: IModulesRepository,
  ) {}

  async addContracts(contracts: Array<AlertsRegistration>): Promise<void> {
    await this.alertsApi.addContracts(contracts);
  }

  async handleAlertLog(chainId: string, log: AlertLog): Promise<void> {
    const moduleAddress = log.address;

    const { safes } = await this.modulesRepository.getSafesByModule({
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

    const emails = await this.emailRepository.getVerifiedEmailsBySafeAddress({
      chainId,
      safeAddress,
    });

    if (emails.length === 0) {
      this.loggingService.debug(
        `An alert for a Safe with no associated emails was received. moduleAddress=${moduleAddress}, safeAddress=${safeAddress}`,
      );
      return;
    }

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

      const newSafeState = await this._mapSafeSetup({
        safe,
        decodedTransactions,
      });

      this._notifySafeSetup({
        chainId,
        newSafeState,
      });
    } catch {
      this._notifyUnknownTransaction(emails);
    }
  }

  private _decodeTransactionAdded(data: Hex) {
    const decoded = this.safeDecoder.decodeFunctionData({ data });

    if (decoded.functionName !== 'execTransaction') {
      return [decoded];
    }

    const execTransactionData = decoded.args[2];
    return this.multiSendDecoder
      .mapMultiSendTransactions(execTransactionData)
      .flatMap(({ data }) => this.safeDecoder.decodeFunctionData({ data }));
  }

  private async _mapSafeSetup(args: {
    safe: Safe;
    decodedTransactions: Array<ReturnType<SafeDecoder['decodeFunctionData']>>;
  }): Promise<Safe> {
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

  private async _notifyUnknownTransaction(emails: string[]): Promise<void> {
    return this.emailApi.createMessage({
      to: emails,
      template: this.configurationService.getOrThrow<string>(
        'email.templates.unknownRecoveryTx',
      ),
      // TODO: subject and substitutions need to be set according to the template design
      subject: 'Unknown transaction attempt',
      substitutions: {},
    });
  }

  private async _notifySafeSetup(args: {
    chainId: string;
    newSafeState: Safe;
  }): Promise<void> {
    const emails = await this.emailRepository.getVerifiedEmailsBySafeAddress({
      chainId: args.chainId,
      safeAddress: args.newSafeState.address,
    });

    if (!emails.length) {
      this.loggingService.debug(
        `An alert log for an transaction with no verified emails associated was thrown for Safe ${args.newSafeState.address}`,
      );
    } else {
      return this.emailApi.createMessage({
        to: emails,
        template: this.configurationService.getOrThrow<string>(
          'email.templates.recoveryTx',
        ),
        // TODO: subject and substitutions need to be set according to the template design
        subject: 'Recovery attempt',
        substitutions: {
          owners: JSON.stringify(args.newSafeState.owners),
          threshold: args.newSafeState.threshold.toString(),
        },
      });
    }
  }
}
