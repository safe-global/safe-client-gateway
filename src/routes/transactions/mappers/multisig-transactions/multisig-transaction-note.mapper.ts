import { Injectable } from '@nestjs/common';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import sanitizeHtml from 'sanitize-html';
import { ProposeTransactionDto } from '@/domain/transactions/entities/propose-transaction.dto.entity';

@Injectable()
export class MultisigTransactionNoteMapper {
  /**
   * The Safe Transaction Service does not expose a top-level `note` field.
   * Instead, if present, the note is encoded within the JSON `origin` string.
   * This helper extracts and sanitises that value for downstream consumers.
   */
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
