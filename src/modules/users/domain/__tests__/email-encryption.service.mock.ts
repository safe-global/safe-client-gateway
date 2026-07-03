// SPDX-License-Identifier: FSL-1.1-MIT
import type { MockedObject } from 'vitest';
import type { EmailEncryptionService } from '@/modules/users/domain/email-encryption.service';

/**
 * A passthrough {@link EmailEncryptionService} double for repository
 * integration tests. It reproduces exactly how the real service behaves when
 * field encryption is disabled — the default everywhere outside production
 * rollout: values are stored and read back as plaintext and KMS is never
 * touched. This lets the repository integration suites exercise plain CRUD
 * without standing up KMS, mirroring the disabled path covered by the e2e
 * suite.
 */
export function createMockEmailEncryptionService(): MockedObject<EmailEncryptionService> {
  return {
    encrypt: vi.fn((_userId: number, email: string) => Promise.resolve(email)),
    decrypt: vi.fn((_userId: number, value: string) => Promise.resolve(value)),
    isEncrypted: vi.fn((value: string) => value.startsWith('kms:')),
    blindIndex: vi.fn((_value: string) => null),
    // Disabled-mode rows are plaintext, so batch decryption passes through.
    decryptUserEmails: vi.fn(
      (users: Array<{ id: number; email: string | null }>) =>
        Promise.resolve(users),
    ),
  } as unknown as MockedObject<EmailEncryptionService>;
}

/**
 * An {@link EmailEncryptionService} double that mimics the *enabled*
 * configuration with a reversible fake cipher instead of KMS: `encrypt`
 * produces `kms:v1:<base64url userId:email>` so rows land in the database as
 * ciphertext, `decrypt` reverses it (throwing on plaintext input and on a
 * userId mismatch, like the real enabled service), and `blindIndex` is a
 * deterministic tag. Lets integration suites assert that read paths actually
 * decrypt.
 */
export function createEncryptingMockEmailEncryptionService(): MockedObject<EmailEncryptionService> {
  const decrypt = (userId: number, value: string): Promise<string> => {
    if (!value.startsWith('kms:v1:')) {
      return Promise.reject(
        new Error(
          'Encountered an unencrypted value while field encryption is enabled',
        ),
      );
    }
    const decoded = Buffer.from(
      value.slice('kms:v1:'.length),
      'base64url',
    ).toString('utf8');
    const separator = decoded.indexOf(':');
    if (decoded.slice(0, separator) !== String(userId)) {
      return Promise.reject(new Error('Encryption context mismatch'));
    }
    return Promise.resolve(decoded.slice(separator + 1));
  };

  return {
    encrypt: vi.fn((userId: number, email: string) =>
      Promise.resolve(
        `kms:v1:${Buffer.from(`${userId}:${email}`, 'utf8').toString('base64url')}`,
      ),
    ),
    decrypt: vi.fn(decrypt),
    isEncrypted: vi.fn((value: string) => value.startsWith('kms:')),
    blindIndex: vi.fn((value: string) => `idx:${value.trim().toLowerCase()}`),
    decryptUserEmails: vi.fn(
      async (users: Array<{ id: number; email: string | null }>) =>
        Promise.all(
          users.map(async (user) =>
            user.email
              ? { ...user, email: await decrypt(user.id, user.email) }
              : user,
          ),
        ),
    ),
  } as unknown as MockedObject<EmailEncryptionService>;
}
