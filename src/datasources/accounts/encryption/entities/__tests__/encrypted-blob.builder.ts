import { Builder, type IBuilder } from '@/__tests__/builder';
import { fakeJson } from '@/__tests__/faker';
import type { EncryptedBlob } from '@/datasources/accounts/encryption/entities/encrypted-blob.entity';
import { faker } from '@faker-js/faker/.';

export function encryptedBlobBuilder(): IBuilder<EncryptedBlob> {
  return new Builder<EncryptedBlob>()
    .with(
      'encryptedData',
      Buffer.from(
        faker.helpers.multiple(() => JSON.parse(fakeJson()), {
          count: 10,
        }),
      ),
    )
    .with('encryptedDataKey', Buffer.from(faker.string.alphanumeric()))
    .with('iv', Buffer.from(faker.string.alphanumeric()));
}
