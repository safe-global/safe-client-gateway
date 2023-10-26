import { Inject, Injectable } from '@nestjs/common';
import { parseAbi, decodeEventLog, Hex, decodeFunctionData } from 'viem';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { Alert, AlertLog } from '@/routes/alerts/entities/alerts.entity';

const DELAY_MODIFIER_ABI = parseAbi([
  'event TransactionAdded(uint256 indexed queueNonce, bytes32 indexed txHash, address to, uint256 value, bytes data, uint8 operation)',
]);

const SAFE_ABI = parseAbi([
  'function addOwnerWithThreshold(address owner, uint256 _threshold)',
]);
@Injectable()
export class AlertsService {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  onAlert(alert: Alert): void {
    for (const log of alert.transaction.logs) {
      const event = this.parseAlertLog(log);

      switch (event?.eventName) {
        case 'TransactionAdded': {
          const transactionAdded = this.parseTransactionAdded(event.args.data);

          if (!transactionAdded) {
            continue;
          }

          this.notifyOfTransactionAdded({
            safeAddress: event.args.to,
            ...transactionAdded,
          });
        }
      }
    }
  }

  private parseAlertLog(log: AlertLog) {
    try {
      return decodeEventLog({
        abi: DELAY_MODIFIER_ABI,
        data: log.data as Hex,
        topics: log.topics as [signature: Hex, ...args: Hex[]],
      });
    } catch {
      this.loggingService.warn({
        type: 'invalid_alert_log',
        ...log,
      });
    }
  }

  private parseTransactionAdded(data: Hex) {
    try {
      return decodeFunctionData({
        abi: SAFE_ABI,
        data,
      });
    } catch {
      this.loggingService.warn({
        type: 'invalid_alert_data',
        data,
      });
    }
  }

  private notifyOfTransactionAdded(
    args: ReturnType<typeof this.parseTransactionAdded> & { safeAddress: Hex },
  ) {
    switch (args.functionName) {
      case 'addOwnerWithThreshold': {
        const [owner, _threshold] = args.args;

        console.log(
          args.safeAddress,
          `addOwnerWithThreshold(${owner}, ${_threshold}) transaction added`,
        );

        break;
      }

      default: {
        console.log(args.safeAddress, 'Unknown transaction added');
      }
    }
  }
}
