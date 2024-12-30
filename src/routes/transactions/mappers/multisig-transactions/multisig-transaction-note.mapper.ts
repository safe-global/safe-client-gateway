import { Injectable } from '@nestjs/common';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';

@Injectable()
export class MultisigTransactionNoteMapper {
  mapTxNote(transaction: MultisigTransaction): string | null {
    if (transaction.origin) {
      try {
        const origin = JSON.parse(transaction.origin);
        const parsedName = origin.name && JSON.parse(String(origin.name));
        if (typeof parsedName.note === 'string') {
          return parsedName.note;
        }
      } catch {
        // Ignore, no note
      }
    }
    return null;
  }
}
