// SPDX-License-Identifier: FSL-1.1-MIT
import type { IEncryptionService } from '@/datasources/encryption/encryption.service.interface';

/**
 * Static service accessor for TypeORM subscribers and transformers,
 * which cannot use NestJS DI.
 *
 * The encryption module sets the service at startup via {@link setService}.
 * Subscribers/transformers call {@link getService} or {@link getServiceOrNull}
 * synchronously during entity lifecycle hooks.
 */
export class EncryptionLocator {
  private static service: IEncryptionService | null = null;

  static setService(svc: IEncryptionService): void {
    EncryptionLocator.service = svc;
  }

  /**
   * Returns the service or `null` if encryption is not configured.
   * Use this in subscribers/transformers that must be no-ops when encryption is disabled.
   */
  static getServiceOrNull(): IEncryptionService | null {
    return EncryptionLocator.service;
  }

  /**
   * Returns the service or throws if encryption is not configured.
   * Use this in code that requires encryption to function.
   */
  static getService(): IEncryptionService {
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
