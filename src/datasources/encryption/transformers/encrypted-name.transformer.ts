// SPDX-License-Identifier: FSL-1.1-MIT
import type { ValueTransformer } from 'typeorm';
import { EncryptionLocator } from '@/datasources/encryption/encryption-locator';

export const encryptedNameTransformer: ValueTransformer = {
  to(value: string | null): string | null {
    if (!value) return null;
    return EncryptionLocator.getService().encrypt(value);
  },
  from(value: string | null): string | null {
    if (!value) return null;
    // Dual-read: legacy plaintext rows don't have the v1: prefix
    if (!value.startsWith('v1:')) return value;
    return EncryptionLocator.getService().decrypt(value);
  },
};
