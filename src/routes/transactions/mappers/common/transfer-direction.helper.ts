import { Injectable } from '@nestjs/common';
import { TransferDirection } from '../../entities/transfer-transaction-info.entity';

@Injectable()
export class TransferDirectionHelper {
  getTransferDirection(safeAddress: string, from: string, to: string): string {
    if (safeAddress === from) {
      return TransferDirection.Out;
    }
    if (safeAddress === to) {
      return TransferDirection.In;
    }
    return TransferDirection.Unknown;
  }
}
