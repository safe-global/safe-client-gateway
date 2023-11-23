import { Inject, Injectable } from '@nestjs/common';
import { Hex } from 'viem';
import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { IAlertsApi } from '@/domain/interfaces/alerts-api.interface';
import { AlertsRegistration } from '@/domain/alerts/entities/alerts.entity';
import { AlertLog } from '@/routes/alerts/entities/alert.dto.entity';
import { DelayModifierDecoder } from '@/domain/alerts/contracts/delay-modifier-decoder.helper';
import { SafeDecoder } from '@/domain/alerts/contracts/safe-decoder.helper';
import { MultiSendDecoder } from '@/domain/alerts/contracts/multi-send-decoder.helper';
import { IEmailRepository } from '@/domain/email/email.repository.interface';

@Injectable()
export class AlertsRepository implements IAlertsRepository {
  constructor(
    @Inject(IAlertsApi)
    private readonly alertsApi: IAlertsApi,
    // TODO: IEmailRepository needs to be injected to be used in
    // https://github.com/safe-global/safe-client-gateway/pull/872
    @Inject(IEmailRepository)
    private readonly emailRepository: IEmailRepository,
    private readonly delayModifierDecoder: DelayModifierDecoder,
    private readonly safeDecoder: SafeDecoder,
    private readonly multiSendDecoder: MultiSendDecoder,
  ) {}

  async addContracts(contracts: Array<AlertsRegistration>): Promise<void> {
    await this.alertsApi.addContracts(contracts);
  }

  handleAlertLog(log: AlertLog): void {
    const decodedEvent = this.delayModifierDecoder.decodeEventLog({
      data: log.data as Hex,
      topics: log.topics as [Hex, Hex, Hex],
    });

    const decodedTransactions = this.decodeTransactionAdded(
      decodedEvent.args.data,
    );

    if (!decodedTransactions) {
      // Transaction outside of specified ABI => notify user
      return;
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
          // Transaction outside of specified ABI => notify user
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
}
