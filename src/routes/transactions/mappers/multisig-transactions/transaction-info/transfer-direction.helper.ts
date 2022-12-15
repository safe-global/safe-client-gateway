import { Injectable } from '@nestjs/common';
import { TransferDirection } from '../../../entities/transfer-transaction-info.entity';

@Injectable()
export class TransferDirectionHelper {
  getTransferDirection(safe: string, from: string, to: string): string {
    if (safe === from) {
      return TransferDirection[TransferDirection.Outgoing].toUpperCase();
    }
    if (safe === to) {
      return TransferDirection[TransferDirection.Incoming].toUpperCase();
    }
    return TransferDirection[TransferDirection.Unknown].toUpperCase();
  }
}
