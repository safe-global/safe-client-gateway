// SPDX-License-Identifier: FSL-1.1-MIT

import type { IFieldEncryptionService } from '@/datasources/encryption/field-encryption.service.interface';

/**
 * Bridges the DI-managed {@link IFieldEncryptionService} to TypeORM column
 * transformers, which are plain objects created at entity-definition time and
 * therefore cannot receive injected dependencies.
 *
 * The running application registers the service during bootstrap
 * (see FieldEncryptionService.onModuleInit), before any query runs. When the
 * registry is empty (e.g. an integration test that does not wire encryption),
 * the transformer falls back to a plaintext pass-through.
 */
let registeredService: IFieldEncryptionService | undefined;

export const FieldEncryptionRegistry = {
  set(service: IFieldEncryptionService | undefined): void {
    registeredService = service;
  },
  get(): IFieldEncryptionService | undefined {
    return registeredService;
  },
};
