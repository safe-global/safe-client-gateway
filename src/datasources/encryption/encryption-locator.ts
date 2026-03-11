// SPDX-License-Identifier: FSL-1.1-MIT
import type { IFieldEncryptionService } from '@/datasources/encryption/encryption.service.interface';

/**
 * Static service accessor for TypeORM transformers, which cannot use NestJS DI.
 *
 * The encryption module sets the service at startup via {@link setService}.
 * Transformers call {@link getService} synchronously during column read/write.
 */
export class EncryptionLocator {
  private static service: IFieldEncryptionService | null = null;

  static setService(svc: IFieldEncryptionService): void {
    EncryptionLocator.service = svc;
  }

  static getService(): IFieldEncryptionService {
    if (!EncryptionLocator.service) {
      throw new Error(
        'EncryptionLocator: service not set. Ensure EncryptionModule has been initialized.',
      );
    }
    return EncryptionLocator.service;
  }

  static reset(): void {
    EncryptionLocator.service = null;
  }
}
