import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { Builder } from '@/__tests__/builder';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import {
  _getSafeDomain,
  _getSafeTxTypesAndMessage,
  getBaseMultisigTransaction,
  getSafeMessageMessageHash,
  getSafeTxHash,
} from '@/domain/common/utils/safe';
import { typedDataBuilder } from '@/routes/messages/entities/__tests__/typed-data.builder';
import type { BaseMultisigTransaction } from '@/domain/common/utils/safe';
import type { IBuilder } from '@/__tests__/builder';

// Audited versions only
const DOMAIN_WITHOUT_CHAIN_ID_VERSIONS = [
  '0.1.0',
  '1.0.0',
  '1.1.0',
  '1.1.1',
  '1.2.0',
];
const DOMAIN_WITH_CHAIN_ID_VERSIONS = ['1.3.0', '1.4.0', '1.4.1'];
const TYPES_WITH_DATAGAS_VERSIONS = ['0.0.1'];
const TYPES_WITH_BASEGAS_VERSIONS = [
  '1.0.0',
  '1.1.0',
  '1.1.1',
  '1.2.0',
  '1.3.0',
  '1.4.0',
  '1.4.1',
];

function safeTxHashMultisigTransactionBuilder(): IBuilder<BaseMultisigTransaction> {
  return new Builder<BaseMultisigTransaction>()
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('value', faker.string.numeric())
    .with('data', faker.string.hexadecimal() as `0x${string}`)
    .with('operation', faker.helpers.enumValue(Operation))
    .with('safeTxGas', faker.number.int())
    .with('baseGas', faker.number.int())
    .with('gasPrice', faker.string.numeric())
    .with('gasToken', getAddress(faker.finance.ethereumAddress()))
    .with('refundReceiver', getAddress(faker.finance.ethereumAddress()))
    .with('nonce', faker.number.int());
}

describe('Safe', () => {
  describe('getBaseMultisigTransaction', () => {
    it('should return a valid BaseMultisigTransaction', () => {
      const multisigTransaction = multisigTransactionBuilder().build();

      const result = getBaseMultisigTransaction(multisigTransaction);

      expect(result).toEqual({
        to: multisigTransaction.to,
        value: multisigTransaction.value,
        data: multisigTransaction.data,
        operation: multisigTransaction.operation,
        safeTxGas: multisigTransaction.safeTxGas,
        baseGas: multisigTransaction.baseGas,
        gasPrice: multisigTransaction.gasPrice,
        gasToken: multisigTransaction.gasToken,
        refundReceiver: multisigTransaction.refundReceiver,
        nonce: multisigTransaction.nonce,
      });
    });
  });

  describe('getSafeMessageMessageHash', () => {
    describe('generates a valid messageHash', () => {
      it('should handle strings', () => {
        const chainId = faker.string.numeric();
        const safe = safeBuilder().build();
        const message = faker.lorem.sentence();

        expect(() =>
          getSafeMessageMessageHash({
            chainId,
            message,
            safe,
          }),
        ).not.toThrow();
      });

      it('should handle typedData', () => {
        const chainId = faker.string.numeric();
        const safe = safeBuilder().build();
        const message = typedDataBuilder().build();

        expect(() =>
          getSafeMessageMessageHash({
            chainId,
            message,
            safe,
          }),
        ).not.toThrow();
      });

      it.each(DOMAIN_WITHOUT_CHAIN_ID_VERSIONS)(
        "should handle versions that don't include the chainId in the domain (%s)",
        (version) => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().with('version', version).build();
          const message = faker.helpers.arrayElement([
            faker.lorem.sentence(),
            typedDataBuilder().build(),
          ]);

          expect(() =>
            getSafeMessageMessageHash({ chainId, message, safe }),
          ).not.toThrow();
        },
      );

      it.each(DOMAIN_WITH_CHAIN_ID_VERSIONS)(
        'should handle versions that include the chainId in the domain (%s)',
        (version) => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().with('version', version).build();
          const message = faker.helpers.arrayElement([
            faker.lorem.sentence(),
            typedDataBuilder().build(),
          ]);

          expect(() =>
            getSafeMessageMessageHash({ chainId, message, safe }),
          ).not.toThrow();
        },
      );
    });

    describe.skip('examples', () => {
      describe('strings', () => {
        it('should generate a valid 1.0.0 messageHash', () => {
          const chainId = '';
          const safe = safeBuilder().with('version', '1.0.0').build();
          const message = '';

          const result = getSafeMessageMessageHash({
            chainId,
            message,
            safe,
          });

          expect(result).toBe('');
        });

        it('should generate a valid 1.1.0 messageHash', () => {
          const chainId = '';
          const safe = safeBuilder().with('version', '1.1.1').build();
          const message = '';

          const result = getSafeMessageMessageHash({
            chainId,
            message,
            safe,
          });

          expect(result).toBe('');
        });

        it('should generate a valid 1.2.0 messageHash', () => {
          const chainId = '';
          const safe = safeBuilder().with('version', '1.2.0').build();
          const message = '';

          const result = getSafeMessageMessageHash({
            chainId,
            message,
            safe,
          });

          expect(result).toBe('');
        });

        it('should generate a valid 1.3.0 messageHash', () => {
          const chainId = '';
          const safe = safeBuilder().with('version', '1.3.0').build();
          const message = '';

          const result = getSafeMessageMessageHash({
            chainId,
            message,
            safe,
          });

          expect(result).toBe('');
        });

        it('should generate a valid 1.4.0 messageHash', () => {
          const chainId = '';
          const safe = safeBuilder().with('version', '1.4.0').build();
          const message = '';

          const result = getSafeMessageMessageHash({
            chainId,
            message,
            safe,
          });

          expect(result).toBe('');
        });

        it('should generate a valid 1.4.1 messageHash', () => {
          const chainId = '';
          const safe = safeBuilder().with('version', '1.4.1').build();
          const message = '';

          const result = getSafeMessageMessageHash({
            chainId,
            message,
            safe,
          });

          expect(result).toBe('');
        });
      });

      describe('typedData', () => {
        it('should generate a valid 1.0.0 messageHash', () => {
          const chainId = '';
          const safe = safeBuilder().with('version', '1.0.0').build();
          const message = '';

          const result = getSafeMessageMessageHash({
            chainId,
            message,
            safe,
          });

          expect(result).toBe('');
        });

        it('should generate a valid 1.1.0 messageHash', () => {
          const chainId = '';
          const safe = safeBuilder().with('version', '1.1.1').build();
          const message = '';

          const result = getSafeMessageMessageHash({
            chainId,
            message,
            safe,
          });

          expect(result).toBe('');
        });

        it('should generate a valid 1.2.0 messageHash', () => {
          const chainId = '';
          const safe = safeBuilder().with('version', '1.2.0').build();
          const message = '';

          const result = getSafeMessageMessageHash({
            chainId,
            message,
            safe,
          });

          expect(result).toBe('');
        });

        it('should generate a valid 1.3.0 messageHash', () => {
          const chainId = '';
          const safe = safeBuilder().with('version', '1.3.0').build();
          const message = '';

          const result = getSafeMessageMessageHash({
            chainId,
            message,
            safe,
          });

          expect(result).toBe('');
        });

        it('should generate a valid 1.4.0 messageHash', () => {
          const chainId = '';
          const safe = safeBuilder().with('version', '1.4.0').build();
          const message = '';

          const result = getSafeMessageMessageHash({
            chainId,
            message,
            safe,
          });

          expect(result).toBe('');
        });

        it('should generate a valid 1.4.1 messageHash', () => {
          const chainId = '';
          const safe = safeBuilder().with('version', '1.4.1').build();
          const message = '';

          const result = getSafeMessageMessageHash({
            chainId,
            message: message,
            safe,
          });

          expect(result).toBe('');
        });
      });
    });
  });

  describe('getSafeTxHash', () => {
    describe('generates a valid safeTxHash', () => {
      it('should handle valid transactions', () => {
        const chainId = faker.string.numeric();
        const safe = safeBuilder().build();
        const transaction = safeTxHashMultisigTransactionBuilder().build();

        expect(() =>
          getSafeTxHash({ chainId, transaction, safe }),
        ).not.toThrow();
      });

      it('should handle empty data', () => {
        const chainId = faker.string.numeric();
        const safe = safeBuilder().build();
        const transaction = safeTxHashMultisigTransactionBuilder()
          .with('data', null)
          .build();

        expect(() =>
          getSafeTxHash({ chainId, transaction, safe }),
        ).not.toThrow();
      });

      it.each(DOMAIN_WITHOUT_CHAIN_ID_VERSIONS)(
        "should handle versions that don't include the chainId in the domain (%s)",
        (version) => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().with('version', version).build();
          const transaction = safeTxHashMultisigTransactionBuilder().build();

          expect(() =>
            getSafeTxHash({ chainId, transaction, safe }),
          ).not.toThrow();
        },
      );

      it.each(DOMAIN_WITH_CHAIN_ID_VERSIONS)(
        'should handle versions that include the chainId in the domain (%s)',
        (version) => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().with('version', version).build();
          const transaction = safeTxHashMultisigTransactionBuilder().build();

          expect(() =>
            getSafeTxHash({ chainId, transaction, safe }),
          ).not.toThrow();
        },
      );

      it.each(TYPES_WITH_DATAGAS_VERSIONS)(
        'should handle versions that use dataGas instead of baseGas (%s)',
        (version) => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().with('version', version).build();
          const transaction = safeTxHashMultisigTransactionBuilder().build();

          expect(() =>
            getSafeTxHash({ chainId, transaction, safe }),
          ).not.toThrow();
        },
      );

      it.each(TYPES_WITH_BASEGAS_VERSIONS)(
        'should handle versions that use baseGas instead of dataGas (%s)',
        (version) => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().with('version', version).build();
          const transaction = safeTxHashMultisigTransactionBuilder().build();

          expect(() =>
            getSafeTxHash({ chainId, transaction, safe }),
          ).not.toThrow();
        },
      );

      describe.skip('examples', () => {
        it('should generate a valid 1.0.0 safeTxHash', () => {
          const chainId = '';
          const safe = safeBuilder().with('version', '1.0.0').build();
          const transaction = safeTxHashMultisigTransactionBuilder().build();

          const result = getSafeTxHash({
            chainId,
            transaction,
            safe,
          });

          expect(result).toBe('');
        });

        it('should generate a valid 1.1.0 safeTxHash', () => {
          const chainId = '';
          const safe = safeBuilder().with('version', '1.1.1').build();
          const transaction = safeTxHashMultisigTransactionBuilder().build();

          const result = getSafeTxHash({
            chainId,
            transaction,
            safe,
          });

          expect(result).toBe('');
        });

        it('should generate a valid 1.2.0 safeTxHash', () => {
          const chainId = '';
          const safe = safeBuilder().with('version', '1.2.0').build();
          const transaction = safeTxHashMultisigTransactionBuilder().build();

          const result = getSafeTxHash({
            chainId,
            transaction,
            safe,
          });

          expect(result).toBe('');
        });

        it('should generate a valid 1.3.0 safeTxHash', () => {
          const chainId = '';
          const safe = safeBuilder().with('version', '1.3.0').build();
          const transaction = safeTxHashMultisigTransactionBuilder().build();

          const result = getSafeTxHash({
            chainId,
            transaction,
            safe,
          });

          expect(result).toBe('');
        });

        it('should generate a valid 1.4.0 safeTxHash', () => {
          const chainId = '';
          const safe = safeBuilder().with('version', '1.4.0').build();
          const transaction = safeTxHashMultisigTransactionBuilder().build();

          const result = getSafeTxHash({
            chainId,
            transaction,
            safe,
          });

          expect(result).toBe('');
        });

        it('should generate a valid 1.4.1 safeTxHash', () => {
          const chainId = '';
          const safe = safeBuilder().with('version', '1.4.1').build();
          const transaction = safeTxHashMultisigTransactionBuilder().build();

          const result = getSafeTxHash({
            chainId,
            transaction,
            safe,
          });

          expect(result).toBe('');
        });
      });
    });

    it('should throw if the Safe version is not present', () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().with('version', null).build();
      const transaction = safeTxHashMultisigTransactionBuilder().build();

      expect(() => getSafeTxHash({ chainId, transaction, safe })).toThrow(
        'Safe version is required',
      );
    });

    it.each<keyof BaseMultisigTransaction>([
      'safeTxGas',
      'baseGas',
      'gasPrice',
    ])('should throw if the %s is not present', (key) => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().build();
      const transaction = safeTxHashMultisigTransactionBuilder()
        .with(key, null)
        .build();

      expect(() => getSafeTxHash({ chainId, transaction, safe })).toThrow(
        'Transaction data is incomplete',
      );
    });

    it('should throw if the hash cannot be calculated', () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().build();
      const transaction = safeTxHashMultisigTransactionBuilder()
        .with('to', faker.string.numeric() as `0x${string}`)
        .build();

      expect(() => getSafeTxHash({ chainId, transaction, safe })).toThrow(
        'Failed to hash transaction data',
      );
    });
  });

  describe('getSafeTxDomain', () => {
    it.each(DOMAIN_WITHOUT_CHAIN_ID_VERSIONS)(
      "should return a domain without the chainId for versions that don't include it (%s)",
      (version) => {
        const chainId = faker.string.numeric();
        const address = getAddress(faker.finance.ethereumAddress());

        const result = _getSafeDomain({
          address,
          version,
          chainId,
        });

        expect(result).toEqual({
          verifyingContract: address,
        });
      },
    );

    it.each(DOMAIN_WITH_CHAIN_ID_VERSIONS)(
      'should return a domain with the chainId for versions that include it (%s)',
      (version) => {
        const chainId = faker.string.numeric();
        const address = getAddress(faker.finance.ethereumAddress());

        const result = _getSafeDomain({
          address,
          version,
          chainId,
        });

        expect(result).toEqual({
          chainId: Number(chainId),
          verifyingContract: address,
        });
      },
    );
  });

  describe('getSafeTxTypesAndMessage', () => {
    it('should default empty data to 0x', () => {
      const transaction = safeTxHashMultisigTransactionBuilder()
        .with('data', null)
        .build();
      const version = faker.helpers.arrayElement(TYPES_WITH_BASEGAS_VERSIONS);

      const result = _getSafeTxTypesAndMessage({
        transaction,
        version,
      });

      expect(result.message.data).toEqual('0x');
    });

    it.each<keyof BaseMultisigTransaction>(['gasToken', 'refundReceiver'])(
      'should default a missing %s to a zero address if not present',
      (key) => {
        const transaction = safeTxHashMultisigTransactionBuilder()
          .with(key, null)
          .build();
        const version = faker.helpers.arrayElement(TYPES_WITH_BASEGAS_VERSIONS);

        const result = _getSafeTxTypesAndMessage({
          transaction,
          version,
        });

        expect(result.message[key]).toEqual(
          '0x0000000000000000000000000000000000000000',
        );
      },
    );

    it.each<keyof BaseMultisigTransaction>([
      'safeTxGas',
      'baseGas',
      'gasPrice',
    ])('should throw if %s is not present', (key) => {
      const transaction = safeTxHashMultisigTransactionBuilder()
        .with(key, null)
        .build();
      const version = faker.helpers.arrayElement(TYPES_WITH_BASEGAS_VERSIONS);

      expect(() => _getSafeTxTypesAndMessage({ transaction, version })).toThrow(
        'Transaction data is incomplete',
      );
    });

    it.each(TYPES_WITH_DATAGAS_VERSIONS)(
      'should handle versions that use dataGas instead of baseGas (%s)',
      (version) => {
        const transaction = safeTxHashMultisigTransactionBuilder().build();

        const result = _getSafeTxTypesAndMessage({
          transaction,
          version,
        });

        expect(result).toEqual({
          types: {
            SafeTx: [
              { name: 'to', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'data', type: 'bytes' },
              { name: 'operation', type: 'uint8' },
              { name: 'safeTxGas', type: 'uint256' },
              { name: 'dataGas', type: 'uint256' },
              { name: 'gasPrice', type: 'uint256' },
              { name: 'gasToken', type: 'address' },
              { name: 'refundReceiver', type: 'address' },
              { name: 'nonce', type: 'uint256' },
            ],
          },
          message: {
            to: transaction.to,
            value: BigInt(transaction.value),
            data: transaction.data,
            operation: transaction.operation,
            safeTxGas: BigInt(transaction.safeTxGas!),
            dataGas: BigInt(transaction.baseGas!),
            gasPrice: BigInt(transaction.gasPrice!),
            gasToken: transaction.gasToken,
            refundReceiver: transaction.refundReceiver,
            nonce: BigInt(transaction.nonce),
          },
        });
      },
    );

    it.each(TYPES_WITH_BASEGAS_VERSIONS)(
      'should handle versions that use baseGas instead of dataGas (%s)',
      (version) => {
        const transaction = safeTxHashMultisigTransactionBuilder().build();

        const result = _getSafeTxTypesAndMessage({
          transaction,
          version,
        });

        expect(result).toEqual({
          types: {
            SafeTx: [
              { name: 'to', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'data', type: 'bytes' },
              { name: 'operation', type: 'uint8' },
              { name: 'safeTxGas', type: 'uint256' },
              { name: 'baseGas', type: 'uint256' },
              { name: 'gasPrice', type: 'uint256' },
              { name: 'gasToken', type: 'address' },
              { name: 'refundReceiver', type: 'address' },
              { name: 'nonce', type: 'uint256' },
            ],
          },
          message: {
            to: transaction.to,
            value: BigInt(transaction.value),
            data: transaction.data,
            operation: transaction.operation,
            safeTxGas: BigInt(transaction.safeTxGas!),
            baseGas: BigInt(transaction.baseGas!),
            gasPrice: BigInt(transaction.gasPrice!),
            gasToken: transaction.gasToken,
            refundReceiver: transaction.refundReceiver,
            nonce: BigInt(transaction.nonce),
          },
        });
      },
    );
  });
});
