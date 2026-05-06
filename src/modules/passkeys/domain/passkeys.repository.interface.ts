// SPDX-License-Identifier: FSL-1.1-MIT
import type {
  PasskeyRecord,
  PasskeyRecordInput,
  WriteOutcome,
} from '@/modules/passkeys/domain/entities/passkey-record.entity';

export const IPasskeysRepository = Symbol('IPasskeysRepository');

export interface IPasskeysRepository {
  /**
   * Idempotent insert. If a row with the same `credentialId` already exists,
   * the outcome distinguishes:
   *   - identical          → re-POST of the exact same record
   *   - cross_rp_conflict  → credentialId already registered to a different RP
   *   - conflict           → same RP, different (x, y) or verifiers
   *
   * The repository never overwrites — the first write wins.
   */
  create(input: PasskeyRecordInput): Promise<WriteOutcome>;

  findByCredentialId(credentialId: Buffer): Promise<PasskeyRecord | null>;
}
