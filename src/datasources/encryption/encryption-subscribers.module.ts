// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { MemberSubscriber } from '@/datasources/encryption/subscribers/member.subscriber';
import { AddressBookItemSubscriber } from '@/datasources/encryption/subscribers/address-book-item.subscriber';

/**
 * Registers TypeORM entity subscribers for field-level encryption.
 *
 * Imported unconditionally — subscribers are always active but become no-ops
 * when encryption is disabled. This ensures encrypted rows are never silently
 * returned as ciphertext if the feature flag is toggled off while encrypted
 * data exists in the DB.
 */
@Module({
  providers: [MemberSubscriber, AddressBookItemSubscriber],
})
export class EncryptionSubscribersModule {}
