// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { INDEX_KEY_LENGTH } from '@/datasources/kms/encryption.constants';
import { IKmsService } from '@/datasources/kms/kms.service.interface';

/**
 * The fixed data key this double hands out. Wrapping is the identity, so
 * `decrypt` returns whatever it is given: enough for `KmsEncryptionService` to
 * run its real envelope encryption, and for the blind-index key to unwrap.
 */
const DATA_KEY = Buffer.alloc(INDEX_KEY_LENGTH, 7);

/**
 * Replaces `KmsModule` so a spec can turn field encryption on without AWS.
 * Everything above this boundary stays real: values are AES-GCM encrypted for
 * real, stored as `kms:v1:...`, and blind indexes are computed for real. Use
 * it to assert what reaches the database, not to assert encryption itself.
 */
@Module({
  providers: [
    {
      provide: IKmsService,
      useValue: {
        generateDataKey: (): Promise<{
          plaintextKey: Buffer;
          wrappedKey: Buffer;
        }> => Promise.resolve({ plaintextKey: DATA_KEY, wrappedKey: DATA_KEY }),
        encrypt: (args: { plaintext: Buffer }): Promise<Buffer> =>
          Promise.resolve(args.plaintext),
        decrypt: (args: { ciphertext: Buffer }): Promise<Buffer> =>
          Promise.resolve(args.ciphertext),
      },
    },
  ],
  exports: [IKmsService],
})
export class TestKmsModule {}

/** The wrapped blind-index key this double unwraps, for `encryption.indexKey`. */
export const TEST_WRAPPED_INDEX_KEY = DATA_KEY.toString('base64');
