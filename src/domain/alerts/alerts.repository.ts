import { Inject, Injectable } from '@nestjs/common';
import { Hex } from 'viem';
import { IAlertsRepository } from '@/domain/alerts/alerts.repository.interface';
import { Contract, ContractId } from '@/domain/alerts/entities/alerts.entity';
import { IAlertsApi } from '@/domain/interfaces/alerts-api.inferface';
import { AlertLog } from '@/routes/alerts/entities/alert.dto.entity';
import { DelayModifierDecoder } from '@/domain/alerts/contracts/delay-modifier-decoder.helper';
import { SafeDecoder } from '@/domain/alerts/contracts/safe-decoder.helper';

@Injectable()
export class AlertsRepository implements IAlertsRepository {
  constructor(
    @Inject(IAlertsApi) private readonly alertsApi: IAlertsApi,
    @Inject(DelayModifierDecoder)
    private readonly delayModifierDecoder: DelayModifierDecoder,
    @Inject(SafeDecoder) private readonly safeDecoder: SafeDecoder,
  ) {}

  async addContracts(contracts: Array<Contract>): Promise<void> {
    await this.alertsApi.addContracts(contracts);
  }

  async removeContracts(contractIds: Array<ContractId>): Promise<void> {
    await this.alertsApi.removeContracts(contractIds);
  }

  handleAlertLog(log: AlertLog): void {
    const decodedEvent = this.delayModifierDecoder.decodeEventLog({
      // We can cast as it throws if values are invalid
      data: log.data as Hex,
      topics: log.topics as [Hex, Hex, Hex],
    });

    if (decodedEvent?.eventName !== 'TransactionAdded') {
      // Unknown alert log
      return;
    }

    const decodedData = this.safeDecoder.decodeFunctionData(decodedEvent.args);

    if (decodedData?.functionName !== 'addOwnerWithThreshold') {
      // Transaction outside of specified ABI added => notify user
      return;
    }

    // const safeAddress = decodedEvent.args.to;
    // const [owner, _threshold] = decodedData.args;

    // addOwnerWithThreshold transaction added => notify user
  }
}
