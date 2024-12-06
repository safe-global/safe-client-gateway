import { faker } from '@faker-js/faker';
import {
  encodeAbiParameters,
  getAddress,
  keccak256,
  parseAbiParameters,
} from 'viem';
import { SafeTypedDataHelper } from '@/domain/contracts/safe-typed-data.helper';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';

describe('SafeTypedDataHelper', () => {
  const target = new SafeTypedDataHelper();

  describe('getDomainHash', () => {
    it.each(['0.1.0', '1.0.0', '1.1.0', '1.1.1', '1.2.0'])(
      'should return domain hash for version %s',
      (version) => {
        // keccak256("EIP712Domain(address verifyingContract)");
        // @see https://github.com/safe-global/safe-smart-account/blob/v1.2.0/contracts/GnosisSafe.sol#L23-L26
        const DOMAIN_TYPEHASH =
          '0x035aff83d86937d35b32e04f0ddc6ff469290eef2f1b692d8a815c89404d4749';

        const chainId = faker.string.numeric();
        const safe = safeBuilder().with('version', version).build();

        const actual = target.getDomainHash({ chainId, safe });

        expect(actual).toEqual(
          keccak256(
            encodeAbiParameters(parseAbiParameters('bytes32, address'), [
              DOMAIN_TYPEHASH,
              getAddress(safe.address),
            ]),
          ),
        );
      },
    );

    it.each(['1.3.0', '1.4.0', '1.4.1'])(
      'should return chainId-based domain hash for version %s',
      (version) => {
        // keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");
        // @see https://github.com/safe-global/safe-smart-account/blob/v1.3.0/contracts/GnosisSafe.sol#L35-L38
        const DOMAIN_TYPEHASH =
          '0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218';

        const chainId = faker.string.numeric();
        const safe = safeBuilder().with('version', version).build();

        const actual = target.getDomainHash({ chainId, safe });

        expect(actual).toEqual(
          keccak256(
            encodeAbiParameters(
              parseAbiParameters('bytes32, uint256, address'),
              [DOMAIN_TYPEHASH, BigInt(chainId), getAddress(safe.address)],
            ),
          ),
        );
      },
    );
  });

  describe('getSafeTxMessageHash', () => {
    it.each(['0.1.0'])(
      'should return dataGas-based SafeTx message hash for version %s',
      (version) => {
        // keccak256("SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 dataGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)");
        // @see https://github.com/safe-global/safe-smart-account/blob/v0.1.0/contracts/GnosisSafe.sol#L25-L28
        const SAFE_TX_TYPEHASH =
          '0x14d461bc7412367e924637b363c7bf29b8f47e2f84869f4426e5633d8af47b20';

        const chainId = faker.string.numeric();
        const safe = safeBuilder().with('version', version).build();
        const transaction = multisigTransactionBuilder()
          .with('safe', safe.address)
          .build();

        const actual = target.getSafeTxMessageHash({
          chainId,
          safe,
          transaction,
        });

        if (
          !transaction.data ||
          !transaction.safeTxGas ||
          !transaction.baseGas ||
          !transaction.gasPrice ||
          !transaction.gasToken ||
          !transaction.refundReceiver
        ) {
          // Appease TypeScript
          throw new Error('Missing transaction data');
        }

        expect(actual).toEqual(
          keccak256(
            encodeAbiParameters(
              parseAbiParameters(
                'bytes32, address, uint256, bytes32, uint8, uint256, uint256, uint256, address, address, uint256',
              ),
              [
                SAFE_TX_TYPEHASH,
                getAddress(transaction.to),
                BigInt(transaction.value),
                // EIP-712 expects bytes to be hashed
                keccak256(transaction.data),
                transaction.operation,
                BigInt(transaction.safeTxGas),
                BigInt(transaction.baseGas),
                BigInt(transaction.gasPrice),
                getAddress(transaction.gasToken),
                getAddress(transaction.refundReceiver),
                BigInt(transaction.nonce),
              ],
            ),
          ),
        );
      },
    );

    it.each(['1.0.0', '1.1.0', '1.1.1', '1.2.0', '1.3.0', '1.4.0', '1.4.1'])(
      'should return baseGas-based SafeTx message hash for version %s',
      (version) => {
        // keccak256("SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)");
        // @see https://github.com/safe-global/safe-smart-account/blob/v1.0.0/contracts/GnosisSafe.sol#L25-L28
        const SAFE_TX_TYPEHASH =
          '0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8';

        const chainId = faker.string.numeric();
        const safe = safeBuilder().with('version', version).build();
        const transaction = multisigTransactionBuilder()
          .with('safe', safe.address)
          .build();

        const actual = target.getSafeTxMessageHash({
          chainId,
          safe,
          transaction,
        });

        if (
          !transaction.data ||
          !transaction.safeTxGas ||
          !transaction.baseGas ||
          !transaction.gasPrice ||
          !transaction.gasToken ||
          !transaction.refundReceiver
        ) {
          // Appease TypeScript
          throw new Error('Missing transaction data');
        }

        expect(actual).toEqual(
          keccak256(
            encodeAbiParameters(
              parseAbiParameters(
                'bytes32, address, uint256, bytes32, uint8, uint256, uint256, uint256, address, address, uint256',
              ),
              [
                SAFE_TX_TYPEHASH,
                getAddress(transaction.to),
                BigInt(transaction.value),
                // EIP-712 expects bytes to be hashed
                keccak256(transaction.data),
                transaction.operation,
                BigInt(transaction.safeTxGas),
                BigInt(transaction.baseGas),
                BigInt(transaction.gasPrice),
                getAddress(transaction.gasToken),
                getAddress(transaction.refundReceiver),
                BigInt(transaction.nonce),
              ],
            ),
          ),
        );
      },
    );

    it.each([
      'data' as const,
      'safeTxGas' as const,
      'baseGas' as const,
      'gasPrice' as const,
      'gasToken' as const,
      'refundReceiver' as const,
    ])(
      'should return null SafeTx message hash if transaction %s is null',
      (field) => {
        const chainId = faker.string.numeric();
        const safe = safeBuilder().with('version', null).build();
        const transaction = multisigTransactionBuilder()
          .with('safe', safe.address)
          .with(field, null)
          .build();

        const actual = target.getSafeTxMessageHash({
          chainId,
          safe,
          transaction,
        });

        expect(actual).toBe(null);
      },
    );
  });
});
