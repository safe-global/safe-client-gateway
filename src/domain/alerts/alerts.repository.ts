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
      return this._notifyInvalidTransaction(chainId, log);
    }

    for (const decodedTransaction of decodedTransactions) {
      switch (decodedTransaction.functionName) {
        case 'addOwnerWithThreshold': {
          // const safeAddress = decodedEvent.args.to;
          // const [owner, _threshold] = decodedTransaction.args;
          break;
        }
        case 'removeOwner': {
          // const safeAddress = decodedEvent.args.to;
          // const [prevOwner, owner, _threshold] = decodedTransaction.args;
          break;
        }
        case 'swapOwner': {
          // const safeAddress = decodedEvent.args.to;
          // const [prevOwner, oldOwner, newOwner] = decodedTransaction.args;
          break;
        }
        case 'changeThreshold': {
          // const safeAddress = decodedEvent.args.to;
          // const [_threshold] = decodedTransaction.args;
          break;
        }
        default: {
          return this._notifyInvalidTransaction(chainId, log);
        }
      }
    }
  }

  private decodeTransactionAdded(data: Hex) {
    try {
      return this.multiSendDecoder
        .mapMultiSendTransactions(data)
        .map(this.safeDecoder.decodeFunctionData);
    } catch {
      try {
        return [this.safeDecoder.decodeFunctionData({ data })];
      } catch {
        return null;
      }
    }
  }

  private async _notifyInvalidTransaction(
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
}
