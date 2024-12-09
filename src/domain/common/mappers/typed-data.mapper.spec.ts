import { faker } from '@faker-js/faker';
import {
  encodeAbiParameters,
  getAddress,
  hashMessage,
  hashTypedData,
  keccak256,
  parseAbiParameters,
} from 'viem';
import { TypedDataMapper } from '@/domain/common/mappers/typed-data.mapper';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { fakeJson } from '@/__tests__/faker';
import type { ILoggingService } from '@/logging/logging.interface';

// eslint-disable-next-line no-restricted-imports -- required for testing
import { getSafeL2SingletonDeployment } from '@safe-global/safe-deployments';

// <=1.2.0
// @see https://github.com/safe-global/safe-smart-account/blob/v1.2.0/contracts/GnosisSafe.sol#L23-L26
const DOMAIN_TYPEHASH_OLD =
  '0x035aff83d86937d35b32e04f0ddc6ff469290eef2f1b692d8a815c89404d4749';
const DOMAIN_TYPEHASH_OLD_VERSIONS = [
  '0.1.0',
  '1.0.0',
  '1.1.0',
  '1.1.1',
  '1.2.0',
];

// >=1.3.0
// @see https://github.com/safe-global/safe-smart-account/blob/v1.3.0/contracts/GnosisSafe.sol#L35-L38
const DOMAIN_TYPEHASH_NEW =
  '0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218';
const DOMAIN_TYPEHASH_NEW_VERSIONS = ['1.3.0', '1.4.0', '1.4.1'];

// <1.0.0
// @see https://github.com/safe-global/safe-smart-account/blob/v0.1.0/contracts/GnosisSafe.sol#L25-L28
const SAFE_TX_TYPEHASH_OLD =
  '0x14d461bc7412367e924637b363c7bf29b8f47e2f84869f4426e5633d8af47b20';
const SAFE_TX_TYPEHASH_OLD_VERSIONS = ['0.1.0'];

// >=1.0.0
// @see https://github.com/safe-global/safe-smart-account/blob/v1.0.0/contracts/GnosisSafe.sol#L25-L28
const SAFE_TX_TYPEHASH_NEW =
  '0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8';
const SAFE_TX_TYPEHASH_NEW_VERSIONS = [
  '1.0.0',
  '1.1.0',
  '1.1.1',
  '1.2.0',
  '1.3.0',
  '1.4.0',
  '1.4.1',
];

// <=1.4.1
// @see https://github.com/safe-global/safe-smart-account/blob/v0.1.0/contracts/GnosisSafe.sol#L30-L33
const SAFE_MESSAGE_TYPEHASH =
  '0x60b3cbf8b4a223d68d641b3b6ddf9a298e7f33710cf3d3a9d1146b5a6150fbca';
const SAFE_MESSAGE_TYPEHASH_VERSIONS = [
  '0.1.0',
  '1.0.0',
  '1.1.0',
  '1.1.1',
  '1.2.0',
  '1.3.0',
  '1.4.0',
  '1.4.1',
];

const mockLoggingService = {
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('SafeTypedDataMapper', () => {
  let target: TypedDataMapper;

  beforeEach(() => {
    jest.resetAllMocks();

    target = new TypedDataMapper(mockLoggingService);
  });

  describe('mapSafeTxTypedData', () => {
    describe('domainHash', () => {
      it.each(DOMAIN_TYPEHASH_OLD_VERSIONS)(
        'should return domainHash for version %s',
        (version) => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().with('version', version).build();
          const transaction = multisigTransactionBuilder()
            .with('safe', safe.address)
            .build();

          const typedData = target.mapSafeTxTypedData({
            chainId,
            safe,
            transaction,
          });

          expect(typedData).toEqual(
            expect.objectContaining({
              domainHash: keccak256(
                encodeAbiParameters(parseAbiParameters('bytes32, address'), [
                  DOMAIN_TYPEHASH_OLD,
                  getAddress(safe.address),
                ]),
              ),
            }),
          );
        },
      );

      it.each(DOMAIN_TYPEHASH_NEW_VERSIONS)(
        'should return chainId-based domainHash for version %s',
        (version) => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().with('version', version).build();
          const transaction = multisigTransactionBuilder()
            .with('safe', safe.address)
            .build();

          const typedData = target.mapSafeTxTypedData({
            chainId,
            safe,
            transaction,
          });

          expect(typedData).toEqual(
            expect.objectContaining({
              domainHash: keccak256(
                encodeAbiParameters(
                  parseAbiParameters('bytes32, uint256, address'),
                  [
                    DOMAIN_TYPEHASH_NEW,
                    BigInt(chainId),
                    getAddress(safe.address),
                  ],
                ),
              ),
            }),
          );
        },
      );

      it('should return null domainHash if version is null', () => {
        const chainId = faker.string.numeric();
        const safe = safeBuilder().with('version', null).build();
        const transaction = multisigTransactionBuilder()
          .with('safe', safe.address)
          .build();

        const typedData = target.mapSafeTxTypedData({
          chainId,
          safe,
          transaction,
        });

        expect(typedData).toEqual(
          expect.objectContaining({
            domainHash: null,
          }),
        );
      });

      it('should return null if domain is invalid', () => {
        const chainId = faker.string.numeric();
        const safe = safeBuilder()
          // Not a valid verifyingContract
          .with('address', 'invalid' as `0x${string}`)
          .build();
        const transaction = multisigTransactionBuilder()
          .with('safe', safe.address)
          .build();

        const typedData = target.mapSafeTxTypedData({
          chainId,
          safe,
          transaction,
        });

        expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
        expect(mockLoggingService.error).toHaveBeenNthCalledWith(
          1,
          `Failed to hash domain for ${safe.address}`,
        );
        expect(typedData).toEqual(
          expect.objectContaining({
            domainHash: null,
          }),
        );
      });
    });

    describe('messageHash', () => {
      it.each(SAFE_TX_TYPEHASH_OLD_VERSIONS)(
        'should return dataGas-based messageHash for version %s',
        (version) => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().with('version', version).build();
          const transaction = multisigTransactionBuilder()
            .with('safe', safe.address)
            .build();

          const typedData = target.mapSafeTxTypedData({
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

          expect(typedData).toEqual(
            expect.objectContaining({
              messageHash: keccak256(
                encodeAbiParameters(
                  parseAbiParameters(
                    'bytes32, address, uint256, bytes32, uint8, uint256, uint256, uint256, address, address, uint256',
                  ),
                  [
                    SAFE_TX_TYPEHASH_OLD,
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
            }),
          );
        },
      );

      it.each(SAFE_TX_TYPEHASH_NEW_VERSIONS)(
        'should return baseGas-based messageHash for version %s',
        (version) => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().with('version', version).build();
          const transaction = multisigTransactionBuilder()
            .with('safe', safe.address)
            .build();

          const typedData = target.mapSafeTxTypedData({
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

          expect(typedData).toEqual(
            expect.objectContaining({
              messageHash: keccak256(
                encodeAbiParameters(
                  parseAbiParameters(
                    'bytes32, address, uint256, bytes32, uint8, uint256, uint256, uint256, address, address, uint256',
                  ),
                  [
                    SAFE_TX_TYPEHASH_NEW,
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
            }),
          );
        },
      );

      it.each(['safeTxGas' as const, 'baseGas' as const, 'gasPrice' as const])(
        'should return messageHash if transaction %s is 0',
        (field) => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().build();
          const transaction = multisigTransactionBuilder()
            .with('safe', safe.address)
            .with(field, 0)
            .build();

          const typedData = target.mapSafeTxTypedData({
            chainId,
            safe,
            transaction,
          });

          expect(typedData).toEqual(
            expect.objectContaining({
              messageHash: expect.any(String),
            }),
          );
        },
      );

      it('should return null messageHash if version is null', () => {
        const chainId = faker.string.numeric();
        const safe = safeBuilder().with('version', null).build();
        const transaction = multisigTransactionBuilder()
          .with('safe', safe.address)
          .build();

        const typedData = target.mapSafeTxTypedData({
          chainId,
          safe,
          transaction,
        });

        expect(typedData).toEqual(
          expect.objectContaining({
            messageHash: null,
          }),
        );
      });

      it.each([
        'data' as const,
        'safeTxGas' as const,
        'baseGas' as const,
        'gasPrice' as const,
        'gasToken' as const,
        'refundReceiver' as const,
      ])(
        'should return null messageHash if transaction %s is null',
        (field) => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().with('version', null).build();
          const transaction = multisigTransactionBuilder()
            .with('safe', safe.address)
            .with(field, null)
            .build();

          const typedData = target.mapSafeTxTypedData({
            chainId,
            safe,
            transaction,
          });

          expect(typedData).toEqual(
            expect.objectContaining({
              messageHash: null,
            }),
          );
        },
      );

      it('should return null if message is invalid', () => {
        const chainId = faker.string.numeric();
        const safe = safeBuilder().build();
        const transaction = multisigTransactionBuilder()
          .with('safe', safe.address)
          // Invalid nonce
          .with('nonce', 'invalid' as unknown as number)
          .build();

        const typedData = target.mapSafeTxTypedData({
          chainId,
          safe,
          transaction,
        });

        expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
        expect(mockLoggingService.error).toHaveBeenNthCalledWith(
          1,
          `Failed to hash SafeTx for ${safe.address}`,
        );
        expect(typedData).toEqual(
          expect.objectContaining({
            messageHash: null,
          }),
        );
      });
    });
  });

  describe('mapSafeMessageTypedData', () => {
    describe('domainHash', () => {
      it.each(DOMAIN_TYPEHASH_OLD_VERSIONS)(
        'should return domainHash for version %s',
        (version) => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().with('version', version).build();
          const message = faker.lorem.words();

          const typedData = target.mapSafeMessageTypedData({
            chainId,
            safe,
            message,
          });

          expect(typedData).toEqual(
            expect.objectContaining({
              domainHash: keccak256(
                encodeAbiParameters(parseAbiParameters('bytes32, address'), [
                  DOMAIN_TYPEHASH_OLD,
                  getAddress(safe.address),
                ]),
              ),
            }),
          );
        },
      );

      it.each(DOMAIN_TYPEHASH_NEW_VERSIONS)(
        'should return chainId-based domainHash for version %s',
        (version) => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().with('version', version).build();
          const message = faker.lorem.words();

          const typedData = target.mapSafeMessageTypedData({
            chainId,
            safe,
            message,
          });

          expect(typedData).toEqual(
            expect.objectContaining({
              domainHash: keccak256(
                encodeAbiParameters(
                  parseAbiParameters('bytes32, uint256, address'),
                  [
                    DOMAIN_TYPEHASH_NEW,
                    BigInt(chainId),
                    getAddress(safe.address),
                  ],
                ),
              ),
            }),
          );
        },
      );

      it('should return null domainHash if version is null', () => {
        const chainId = faker.string.numeric();
        const safe = safeBuilder().with('version', null).build();
        const message = faker.lorem.words();

        const typedData = target.mapSafeMessageTypedData({
          chainId,
          safe,
          message,
        });

        expect(typedData).toEqual(
          expect.objectContaining({
            domainHash: null,
          }),
        );
      });

      it('should return null if domain is invalid', () => {
        const chainId = faker.string.numeric();
        const safe = safeBuilder()
          // Not a valid verifyingContract
          .with('address', 'invalid' as `0x${string}`)
          .build();
        const message = faker.lorem.words();

        const typedData = target.mapSafeMessageTypedData({
          chainId,
          safe,
          message,
        });

        expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
        expect(mockLoggingService.error).toHaveBeenNthCalledWith(
          1,
          `Failed to hash domain for ${safe.address}`,
        );
        expect(typedData).toEqual(
          expect.objectContaining({
            domainHash: null,
          }),
        );
      });
    });

    describe('messageHash', () => {
      it.each(SAFE_MESSAGE_TYPEHASH_VERSIONS)(
        'should return EIP-191 message-based messageHash for version %s',
        (version) => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().with('version', version).build();
          const message = faker.lorem.words();

          const typedData = target.mapSafeMessageTypedData({
            chainId,
            safe,
            message,
          });

          expect(typedData).toEqual(
            expect.objectContaining({
              messageHash: keccak256(
                encodeAbiParameters(parseAbiParameters('bytes32, bytes32'), [
                  SAFE_MESSAGE_TYPEHASH,
                  // EIP-712 expects bytes to be hashed
                  keccak256(hashMessage(message)),
                ]),
              ),
            }),
          );
        },
      );

      it.each(SAFE_MESSAGE_TYPEHASH_VERSIONS)(
        'should return EIP-712 message-based messageHash for version %s',
        (version) => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().with('version', version).build();
          const message = {
            domain: {
              name: faker.company.name(),
              version: faker.string.numeric(),
              chainId: faker.number.int(),
              verifyingContract: getAddress(faker.finance.ethereumAddress()),
            },
            types: {
              Person: [
                { name: 'name', type: 'string' },
                { name: 'wallet', type: 'address' },
              ],
              Mail: [
                { name: 'from', type: 'Person' },
                { name: 'to', type: 'Person' },
                { name: 'contents', type: 'string' },
              ],
            },
            primaryType: 'Mail',
            message: {
              from: {
                name: faker.person.firstName(),
                wallet: getAddress(faker.finance.ethereumAddress()),
              },
              to: {
                name: faker.person.firstName(),
                wallet: getAddress(faker.finance.ethereumAddress()),
              },
              contents: faker.lorem.words(),
            },
          } as const;

          const typedData = target.mapSafeMessageTypedData({
            chainId,
            safe,
            message,
          });

          expect(typedData).toEqual(
            expect.objectContaining({
              messageHash: keccak256(
                encodeAbiParameters(parseAbiParameters('bytes32, bytes32'), [
                  SAFE_MESSAGE_TYPEHASH,
                  // EIP-712 expects bytes to be hashed
                  keccak256(hashTypedData(message)),
                ]),
              ),
            }),
          );
        },
      );

      it.each([
        // Invalid message
        faker.number.int(), // Primitive (EIP-191) (will call hashTypedData as not a string)
        JSON.parse(fakeJson()), // EIP-712
      ])('should return null if message is invalid', (message) => {
        const chainId = faker.string.numeric();
        const safe = safeBuilder().build();

        const typedData = target.mapSafeMessageTypedData({
          chainId,
          safe,
          message,
        });

        expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
        expect(mockLoggingService.error).toHaveBeenNthCalledWith(
          1,
          `Failed to hash SafeMessage for ${safe.address}`,
        );
        expect(typedData).toEqual(
          expect.objectContaining({ messageHash: null }),
        );
      });
    });
  });

  it('these tests should cover up to the current version', () => {
    const deployment = getSafeL2SingletonDeployment();

    expect(DOMAIN_TYPEHASH_NEW_VERSIONS.at(-1)).toBe(deployment?.version);
    expect(SAFE_TX_TYPEHASH_NEW_VERSIONS.at(-1)).toBe(deployment?.version);
    expect(SAFE_MESSAGE_TYPEHASH_VERSIONS.at(-1)).toBe(deployment?.version);
  });
});
