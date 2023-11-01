import { Injectable } from '@nestjs/common';
import { Hex } from 'viem';
import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { AlertLog } from '@/routes/alerts/entities/alert.dto.entity';
import { DelayModifierDecoder } from '@/domain/alerts/contracts/delay-modifier-decoder.helper';
import { SafeDecoder } from '@/domain/alerts/contracts/safe-decoder.helper';
import { MultiSendMapper } from '@/domain/alerts/mappers/multi-send.mapper';

@Injectable()
export class AlertsRepository implements IAlertsRepository {
  constructor(
    private readonly delayModifierDecoder: DelayModifierDecoder,
    private readonly safeDecoder: SafeDecoder,
    private readonly multiSendMapper: MultiSendMapper,
  ) {}

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
      return this.multiSendMapper
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
