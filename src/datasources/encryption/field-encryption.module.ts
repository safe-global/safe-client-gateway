// SPDX-License-Identifier: FSL-1.1-MIT

import { Global, Module } from '@nestjs/common';
import { AwsKmsApiModule } from '@/datasources/aws-kms/aws-kms-api.module';
import { EnvelopeKeyService } from '@/datasources/encryption/envelope-key.service';
import { FieldEncryptionService } from '@/datasources/encryption/field-encryption.service';
import { IFieldEncryptionService } from '@/datasources/encryption/field-encryption.service.interface';
import { PerEntityFieldCrypto } from '@/datasources/encryption/per-entity-field-crypto';

// Global so the single FieldEncryptionService instance unwraps its data keys
// at boot and the encryption services are injectable wherever needed
// (e.g. repositories doing per-entity encryption).
@Global()
@Module({
  imports: [AwsKmsApiModule],
  providers: [
    { provide: IFieldEncryptionService, useClass: FieldEncryptionService },
    EnvelopeKeyService,
    PerEntityFieldCrypto,
  ],
  exports: [IFieldEncryptionService, EnvelopeKeyService, PerEntityFieldCrypto],
})
export class FieldEncryptionModule {}
