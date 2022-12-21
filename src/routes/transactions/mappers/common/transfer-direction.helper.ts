import { Injectable } from '@nestjs/common';
import { TransferDirection } from '../../entities/transfer-transaction-info.entity';

@Injectable()
export class TransferDirectionHelper {
  getTransferDirection(
    safeAddress: string,
    from: string,
    to: string,
  ): TransferDirection {
    if (safeAddress === from) {
      return TransferDirection.Outgoing;
    }
    if (safeAddress === to) {
      return TransferDirection.Incoming;
    }
    return TransferDirection.Unknown;
  }
}
