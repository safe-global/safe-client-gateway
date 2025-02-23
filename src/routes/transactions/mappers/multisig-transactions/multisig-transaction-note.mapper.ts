import { Injectable } from '@nestjs/common';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import sanitizeHtml from 'sanitize-html';
import { ProposeTransactionDto } from '@/domain/transactions/entities/propose-transaction.dto.entity';

@Injectable()
export class MultisigTransactionNoteMapper {
  mapTxNote(
    transaction: MultisigTransaction | ProposeTransactionDto,
  ): string | null {
    if (transaction.origin) {
      try {
        const origin = JSON.parse(transaction.origin);
        if (typeof origin.note === 'string') {
          return sanitizeHtml(origin.note as string, {
            allowedAttributes: {},
            allowedTags: [],
            allowedIframeHostnames: [],
          });
        }
      } catch {
        // Ignore, no note
      }
    }
    return null;
  }
}
