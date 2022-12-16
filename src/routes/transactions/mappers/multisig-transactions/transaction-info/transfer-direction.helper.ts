import { Injectable } from '@nestjs/common';
import { TransferDirection } from '../../../entities/transfer-transaction-info.entity';

@Injectable()
export class TransferDirectionHelper {
  getTransferDirection(safeAddress: string, from: string, to: string): string {
    if (safeAddress === from) {
      return TransferDirection[TransferDirection.Outgoing].toUpperCase();
    }
    if (safeAddress === to) {
      return TransferDirection[TransferDirection.Incoming].toUpperCase();
    }
    return TransferDirection[TransferDirection.Unknown].toUpperCase();
  }
}
