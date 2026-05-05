// SPDX-License-Identifier: FSL-1.1-MIT
import type {
  PasskeyRecord,
  WriteOutcome,
} from '@/modules/passkeys/domain/entities/passkey-record.entity';

export const IPasskeysRepository = Symbol('IPasskeysRepository');

export interface IPasskeysRepository {
  /**
   * Idempotent insert. If a row with the same `credentialId` already exists,
   * the outcome distinguishes:
   *   - identical          → re-POST of the exact same record
   *   - conflict           → same credentialId, different (x, y) or verifiers
   *   - cross_rp_conflict  → matching coordinates but different rpId
   *
   * The repository never overwrites — the first write wins.
   */
  create(record: PasskeyRecord): Promise<WriteOutcome>;

  findByCredentialId(credentialId: Buffer): Promise<PasskeyRecord | null>;
}
