// SPDX-License-Identifier: FSL-1.1-MIT
import type { PasskeyAttestationErrorId } from '@/modules/passkeys/domain/entities/passkey-attestation-error-id.entity';

/**
 * Errors thrown by the attestation service. Mapped to HTTP status codes by the
 * service layer; the controller never exposes the error message text — only an
 * opaque `{ code: errorId }` envelope — so detail strings here are for logs.
 */
export class PasskeyAttestationError extends Error {
  public constructor(
    public readonly errorId: PasskeyAttestationErrorId,
    message?: string,
  ) {
    super(message ?? errorId);
    this.name = 'PasskeyAttestationError';
  }
}
