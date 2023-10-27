import { Inject, Injectable } from '@nestjs/common';
import { Hex } from 'viem';
import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { IAlertsApi } from '@/domain/interfaces/alerts-api.inferface';
import { Contract } from '@/domain/alerts/entities/alerts.entity';
import { AlertLog } from '@/routes/alerts/entities/alert.dto.entity';
import { DelayModifierDecoder } from '@/domain/alerts/contracts/delay-modifier-decoder.helper';
import { SafeDecoder } from '@/domain/alerts/contracts/safe-decoder.helper';
import { Contract } from '@/domain/alerts/entities/alerts.entity';
import { IAlertsApi } from '@/domain/interfaces/alerts-api.inferface';

@Injectable()
export class AlertsRepository implements IAlertsRepository {
  constructor(
    @Inject(IAlertsApi)
    private readonly alertsApi: IAlertsApi,
    private readonly delayModifierDecoder: DelayModifierDecoder,
    private readonly safeDecoder: SafeDecoder,
  ) {}

  async addContracts(contracts: Array<Contract>): Promise<void> {
    await this.alertsApi.addContracts(contracts);
  }

  handleAlertLog(log: AlertLog): void {
    const decodedEvent = this.delayModifierDecoder.decodeEventLog({
      data: log.data as Hex,
      topics: log.topics as [Hex, Hex, Hex],
    });

    const decodedTransaction = this.decodeTransactionAdded(
      decodedEvent.args.data,
    );

    if (decodedTransaction?.functionName !== 'addOwnerWithThreshold') {
      // Transaction outside of specified ABI => notify user
    } else {
      // addOwnerWithThreshold transaction => notify user
      // const safeAddress = decodedEvent.args.to;
      // const [owner, _threshold] = decodedTransaction.args;
    }
  }

  private decodeTransactionAdded(data: Hex) {
    try {
      return this.safeDecoder.decodeFunctionData({ data });
    } catch {
      return null;
    }
  }
}
