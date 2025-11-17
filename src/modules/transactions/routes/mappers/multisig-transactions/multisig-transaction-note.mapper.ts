import { Injectable } from '@nestjs/common';
import { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import sanitizeHtml from 'sanitize-html';
import { ProposeTransactionDto } from '@/modules/transactions/domain/entities/propose-transaction.dto.entity';

@Injectable()
export class MultisigTransactionNoteMapper {
  /**
   * Extracts and sanitises a transaction note from a Safe transaction.
   *
   * The Safe Transaction Service does not expose a top-level `note` field.
   * Instead, if present, the note is encoded within the JSON `origin` string.
   * This helper parses that string and returns the note, or `null` if absent.
   *
   * @param {MultisigTransaction | ProposeTransactionDto} transaction - The transaction object, either a `MultisigTransaction` or `ProposeTransactionDto`.
   * @returns {string | null} The extracted note string if available, otherwise `null`.
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
