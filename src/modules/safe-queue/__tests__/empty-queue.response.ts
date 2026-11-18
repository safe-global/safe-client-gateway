// SPDX-License-Identifier: FSL-1.1-MIT
import { pageBuilder } from '#/domain/entities/__tests__/page.builder';
import type { Page } from '#/domain/entities/page.entity';
import { type Raw, rawify } from '#/validation/entities/raw.entity';

/**
 * A network response for a Safe whose queue holds no proposal, so anything
 * read from the queue (such as the recommended nonce) falls back to the
 * Transaction Service alone.
 */
export function emptyQueueResponse(): Promise<{
  data: Raw<Page<never>>;
  status: number;
}> {
  return Promise.resolve({
    data: rawify(pageBuilder<never>().with('results', []).build()),
    status: 200,
  });
}
