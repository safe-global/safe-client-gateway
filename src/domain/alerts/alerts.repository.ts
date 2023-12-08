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
  ) {}

  async addContracts(contracts: Array<AlertsRegistration>): Promise<void> {
    await this.alertsApi.addContracts(contracts);
  }

  async handleAlertLog(chainId: string, log: AlertLog): Promise<void> {
    const decodedEvent = this.delayModifierDecoder.decodeEventLog({
      data: log.data as Hex,
      topics: log.topics as [Hex, Hex, Hex],
    });

    const decodedTransactions = this.decodeTransactionAdded(
      decodedEvent.args.data,
    );

    if (!decodedTransactions) {
      return this._notifyUnknownTransaction(chainId, log);
    }

    try {
      const safeAddress = decodedEvent.args.to;

      const newSafe = await this.predictNewSafeSetup({
        chainId,
        safeAddress,
        decodedTransactions,
      });

      return this._notifyNewSafeSetup({ chainId, safeAddress, newSafe });
    } catch {
      return this._notifyUnknownTransaction(chainId, log);
    }
  }

  private decodeTransactionAdded(data: Hex) {
    try {
      const decoded = this.safeDecoder.decodeFunctionData({ data });

      if (decoded.functionName !== 'execTransaction') {
        return [decoded];
      }

      return this.multiSendDecoder
        .mapMultiSendTransactions(decoded.args[2])
        .flatMap(({ data }) => this.safeDecoder.decodeFunctionData({ data }));
    } catch {
      return null;
    }
  }

  private async predictNewSafeSetup(args: {
    chainId: string;
    safeAddress: string;
    decodedTransactions: Array<ReturnType<SafeDecoder['decodeFunctionData']>>;
  }): Promise<Safe> {
    const currentSafe = await this.safeRepository.getSafe({
      chainId: args.chainId,
      address: args.safeAddress,
    });

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
    }, currentSafe);
  }

  private async _notifyUnknownTransaction(
    chainId: string,
    log: AlertLog,
  ): Promise<void> {
    const emails = await this.emailRepository.getVerifiedEmailsBySafeAddress({
      chainId,
      safeAddress: log.address,
    });

    if (!emails.length) {
      this.loggingService.debug(
        `An alert log for an invalid transaction with no verified emails associated was thrown for Safe ${log.address}`,
      );
    } else {
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
  }

  private async _notifyNewSafeSetup(args: {
    chainId: string;
    safeAddress: string;
    newSafe: Safe;
  }): Promise<void> {
    const emails = await this.emailRepository.getVerifiedEmailsBySafeAddress({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
    });

    if (!emails.length) {
      this.loggingService.debug(
        `An alert log for an transaction with no verified emails associated was thrown for Safe ${args.safeAddress}`,
      );
    } else {
      // TODO: Add test coverage
      return this.emailApi.createMessage({
        to: emails,
        template: this.configurationService.getOrThrow<string>(
          'email.templates.recoveryTx',
        ),
        // TODO: subject and substitutions need to be set according to the template design
        subject: 'Recovery attempt',
        substitutions: {},
      });
    }
  }
}
