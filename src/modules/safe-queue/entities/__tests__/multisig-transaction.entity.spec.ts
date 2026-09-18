// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import { safeQueueMultisigTransactionBuilder } from '@/modules/safe-queue/entities/__tests__/queue-multisig-transaction.builder';
import { SafeQueueMultisigTransactionSchema } from '@/modules/safe-queue/entities/multisig-transaction.entity';

describe('SafeQueueMultisigTransactionSchema', () => {
  describe('to', () => {
    it('maps a null `to` to the zero address', () => {
      const tx = safeQueueMultisigTransactionBuilder().build();

      const result = SafeQueueMultisigTransactionSchema.parse({
        ...tx,
        to: null,
      });

      expect(result.to).toBe(zeroAddress);
    });

    it('maps a missing `to` to the zero address', () => {
      const { to: _to, ...tx } = safeQueueMultisigTransactionBuilder().build();

      const result = SafeQueueMultisigTransactionSchema.parse(tx);

      expect(result.to).toBe(zeroAddress);
    });

    it('checksums a non-null `to`', () => {
      const to = faker.finance.ethereumAddress();
      const tx = safeQueueMultisigTransactionBuilder()
        .with('to', to.toLowerCase() as `0x${string}`)
        .build();

      const result = SafeQueueMultisigTransactionSchema.parse(tx);

      expect(result.to).toBe(getAddress(to));
    });

    it('rejects a non-address `to`', () => {
      const tx = safeQueueMultisigTransactionBuilder().build();

      const result = SafeQueueMultisigTransactionSchema.safeParse({
        ...tx,
        to: faker.string.alphanumeric(),
      });

      expect(result.success).toBe(false);
    });
  });
});
