// SPDX-License-Identifier: FSL-1.1-MIT
import type { SafenetRelayedTask } from '#/modules/safenet/domain/entities/safenet-payer.entity';

/** Not a `SafenetPayerError`: the fee may have been paid, so the job must not retry. */
export class SafenetPayerMaybePaidError extends Error {
  constructor(message: string, { taskId, payerNonce }: SafenetRelayedTask) {
    super(`${message} (taskId ${taskId}, payerNonce ${payerNonce})`);
    this.name = 'SafenetPayerMaybePaidError';
  }
}
