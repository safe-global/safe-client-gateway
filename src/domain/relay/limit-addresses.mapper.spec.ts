import {
  erc20ApproveEncoder,
  erc20TransferEncoder,
  erc20TransferFromEncoder,
} from '@/domain/relay/contracts/__tests__/encoders/erc20-encoder.builder';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/contracts/__tests__/encoders/multi-send-encoder.builder';
import {
  addOwnerWithThresholdEncoder,
  changeThresholdEncoder,
  disableModuleEncoder,
  enableModuleEncoder,
  execTransactionEncoder,
  removeOwnerEncoder,
  setFallbackHandlerEncoder,
  setGuardEncoder,
  setupEncoder,
  swapOwnerEncoder,
} from '@/domain/contracts/__tests__/encoders/safe-encoder.builder';
import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { SafeDecoder } from '@/domain/contracts/decoders/safe-decoder.helper';
import { createProxyWithNonceEncoder } from '@/domain/relay/contracts/__tests__/encoders/proxy-factory-encoder.builder';
import { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import { ProxyFactoryDecoder } from '@/domain/relay/contracts/decoders/proxy-factory-decoder.helper';
import { LimitAddressesMapper } from '@/domain/relay/limit-addresses.mapper';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { faker } from '@faker-js/faker';
import {
  getMultiSendCallOnlyDeployment,
  getMultiSendDeployment,
  getProxyFactoryDeployment,
  getSafeL2SingletonDeployment,
  getSafeSingletonDeployment,
} from '@safe-global/safe-deployments';
import { Hex, getAddress } from 'viem';
import configuration from '@/config/entities/configuration';
import { getDeploymentVersionsByChainIds } from '@/__tests__/deployments.helper';

const supportedChainIds = Object.keys(configuration().relay.apiKey);

const SAFE_VERSIONS = getDeploymentVersionsByChainIds(
  'Safe',
  supportedChainIds,
);
const SAFE_L2_VERSIONS = getDeploymentVersionsByChainIds(
  'SafeL2',
  supportedChainIds,
);
const MULTI_SEND_CALL_ONLY_VERSIONS = getDeploymentVersionsByChainIds(
  'MultiSendCallOnly',
  supportedChainIds,
);
const MULTI_SEND_VERSIONS = getDeploymentVersionsByChainIds(
  'MultiSend',
  supportedChainIds,
);
const PROXY_FACTORY_VERSIONS = getDeploymentVersionsByChainIds(
  'ProxyFactory',
  supportedChainIds,
);

const mockSafeRepository = jest.mocked({
  getSafe: jest.fn(),
} as jest.MockedObjectDeep<ISafeRepository>);

describe('LimitAddressesMapper', () => {
  let target: LimitAddressesMapper;

  beforeEach(() => {
    jest.resetAllMocks();

    const erc20Decoder = new Erc20Decoder();
    const safeDecoder = new SafeDecoder();
    const multiSendDecoder = new MultiSendDecoder();
    const proxyFactoryDecoder = new ProxyFactoryDecoder();

    target = new LimitAddressesMapper(
      mockSafeRepository,
      erc20Decoder,
      safeDecoder,
      multiSendDecoder,
      proxyFactoryDecoder,
    );
  });

  describe.each(supportedChainIds)('Chain %s', (chainId) => {
    describe('Safe', () => {
      describe.each(SAFE_VERSIONS[chainId])(
        'v%s execTransaction',
        (version) => {
          // execTransaction
          it('should return the limit address when sending native currency to another party', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('value', faker.number.bigInt())
              .encode() as Hex;
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            const expectedLimitAddresses = await target.getLimitAddresses({
              version,
              chainId,
              data,
              to: safeAddress,
            });
            expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
          });

          // transfer (execTransaction)
          it('should return the limit when `trasfer`ing ERC-20 tokens to another party', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('data', erc20TransferEncoder().encode())
              .encode() as Hex;
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            const expectedLimitAddresses = await target.getLimitAddresses({
              version,
              chainId,
              data,
              to: safeAddress,
            });
            expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
          });

          // transferFrom (execTransaction)
          it('should return the limit when `transferFrom`ing ERC-20 tokens to another party', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('data', erc20TransferFromEncoder().encode())
              .encode() as Hex;
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            const expectedLimitAddresses = await target.getLimitAddresses({
              version,
              chainId,
              data,
              to: safeAddress,
            });
            expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
          });

          // approve (execTransaction)
          it('should return the limit when `approve`ing` ERC-20 tokens', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('data', erc20ApproveEncoder().encode())
              .encode() as Hex;
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            const expectedLimitAddresses = await target.getLimitAddresses({
              version,
              chainId,
              data,
              to: safeAddress,
            });
            expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
          });

          // cancellation (execTransaction)
          it('should return the limit address when cancelling a transaction', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('to', safeAddress)
              .with('data', '0x')
              .encode() as Hex;
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            const expectedLimitAddresses = await target.getLimitAddresses({
              version,
              chainId,
              data,
              to: safeAddress,
            });
            expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
          });

          // addOwnerWithThreshold (execTransaction)
          it('should return the limit address when making an addOwnerWithThreshold call', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('to', safeAddress)
              .with('data', addOwnerWithThresholdEncoder().encode())
              .encode() as Hex;
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            const expectedLimitAddresses = await target.getLimitAddresses({
              version,
              chainId,
              data,
              to: safeAddress,
            });
            expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
          });

          // changeThreshold (execTransaction)
          it('should return the limit address when making a changeThreshold call', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('to', safeAddress)
              .with('data', changeThresholdEncoder().encode())
              .encode() as Hex;
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            const expectedLimitAddresses = await target.getLimitAddresses({
              version,
              chainId,
              data,
              to: safeAddress,
            });
            expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
          });

          // enableModule (execTransaction)
          it('should return the limit address when making a enableModule call', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('to', safeAddress)
              .with('data', enableModuleEncoder().encode())
              .encode() as Hex;
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            const expectedLimitAddresses = await target.getLimitAddresses({
              version,
              chainId,
              data,
              to: safeAddress,
            });
            expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
          });

          // disableModule (execTransaction)
          it('should return the limit address when making a disableModule call', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('to', safeAddress)
              .with('data', disableModuleEncoder().encode())
              .encode() as Hex;
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            const expectedLimitAddresses = await target.getLimitAddresses({
              version,
              chainId,
              data,
              to: safeAddress,
            });
            expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
          });

          // removeOwner (execTransaction)
          it('should return the limit address when making a removeOwner call', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('to', safeAddress)
              .with('data', removeOwnerEncoder().encode())
              .encode() as Hex;
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            const expectedLimitAddresses = await target.getLimitAddresses({
              version,
              chainId,
              data,
              to: safeAddress,
            });
            expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
          });

          // setFallbackHandler (execTransaction)
          it('should return the limit address when making a setFallbackHandler call', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('to', safeAddress)
              .with('data', setFallbackHandlerEncoder().encode())
              .encode() as Hex;
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            const expectedLimitAddresses = await target.getLimitAddresses({
              version,
              chainId,
              data,
              to: safeAddress,
            });
            expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
          });

          // setGuard (execTransaction)
          it('should return the limit address when making a setGuard call', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('to', safeAddress)
              .with('data', setGuardEncoder().encode())
              .encode() as Hex;
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            const expectedLimitAddresses = await target.getLimitAddresses({
              version,
              chainId,
              data,
              to: safeAddress,
            });
            expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
          });

          // swapOwner (execTransaction)
          it('should return the limit address when making a swapOwner call', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('to', safeAddress)
              .with('data', swapOwnerEncoder().encode())
              .encode() as Hex;
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            const expectedLimitAddresses = await target.getLimitAddresses({
              version,
              chainId,
              data,
              to: safeAddress,
            });
            expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
          });

          // execTransaction (execTransaction)
          it('should return the limit address calling execTransaction on a nested Safe', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('data', execTransactionEncoder().encode())
              .encode() as Hex;
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            const expectedLimitAddresses = await target.getLimitAddresses({
              version,
              chainId,
              data,
              to: safeAddress,
            });
            expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
          });

          // execTransaction
          it('should throw when sending native currency to self', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('to', safeAddress)
              .with('value', faker.number.bigInt())
              .encode() as Hex;
            // Official mastercopy
            mockSafeRepository.getSafe.mockRejectedValue(true);

            await expect(
              target.getLimitAddresses({
                version,
                chainId,
                data,
                to: safeAddress,
              }),
            ).rejects.toThrow(
              'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
            );
          });

          // transfer (execTransaction)
          it('should throw when `transfer`ing ERC-20 tokens to self', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with(
                'data',
                erc20TransferEncoder().with('to', safeAddress).encode(),
              )
              .encode() as Hex;
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            await expect(
              target.getLimitAddresses({
                version,
                chainId,
                data,
                to: safeAddress,
              }),
            ).rejects.toThrow(
              'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
            );
          });

          // transferFrom (execTransaction)
          it('should throw when `transferFrom`ing ERC-20 tokens to self', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with(
                'data',
                erc20TransferFromEncoder()
                  .with('recipient', safeAddress)
                  .encode(),
              )
              .encode() as Hex;
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            await expect(
              target.getLimitAddresses({
                version,
                chainId,
                data,
                to: safeAddress,
              }),
            ).rejects.toThrow(
              'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
            );
          });

          it('should throw when `transferFrom`ing ERC-20 tokens from sender to sender as recipient', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const recipient = getAddress(faker.finance.ethereumAddress());
            const data = execTransactionEncoder()
              .with(
                'data',
                erc20TransferFromEncoder()
                  .with('sender', recipient)
                  .with('recipient', recipient)
                  .encode(),
              )
              .encode() as Hex;
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            await expect(
              target.getLimitAddresses({
                version,
                chainId,
                data,
                to: safeAddress,
              }),
            ).rejects.toThrow(
              'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
            );
          });

          // Unofficial mastercopy
          it('should throw when the mastercopy is not official', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const data = execTransactionEncoder()
              .with('to', safeAddress)
              .encode() as Hex;
            // Unofficial mastercopy
            mockSafeRepository.getSafe.mockRejectedValue(
              new Error('Not official mastercopy'),
            );

            await expect(
              target.getLimitAddresses({
                version,
                chainId,
                data,
                to: safeAddress,
              }),
            ).rejects.toThrow(
              'Safe attempting to relay is not official. Only official Safe singletons are supported.',
            );
          });
        },
      );

      it('should default to the current version', async () => {
        // Non-existent version
        const version = '0.0.1';
        const safe = safeBuilder().build();
        const safeAddress = getAddress(safe.address);
        const data = execTransactionEncoder().encode() as Hex;
        // Official mastercopy
        mockSafeRepository.getSafe.mockResolvedValue(safe);

        const expectedLimitAddresses = await target.getLimitAddresses({
          version,
          chainId,
          data,
          to: safeAddress,
        });
        expect(expectedLimitAddresses).toStrictEqual([safeAddress]);

        expect(SAFE_VERSIONS[chainId].includes(version)).toBe(false);
      });
    });

    describe('MultiSendCallOnly', () => {
      describe.each(MULTI_SEND_CALL_ONLY_VERSIONS[chainId])(
        'v%s multiSend',
        (version) => {
          it('should return the limit address when entire batch is valid', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const transactions = [
              execTransactionEncoder()
                .with('data', addOwnerWithThresholdEncoder().encode())
                .encode(),
              execTransactionEncoder()
                .with('data', changeThresholdEncoder().encode())
                .encode(),
            ].map((data) => ({
              operation: faker.number.int({ min: 0, max: 1 }),
              data,
              to: safeAddress,
              value: faker.number.bigInt(),
            }));
            const data = multiSendEncoder()
              .with('transactions', multiSendTransactionsEncoder(transactions))
              .encode();
            const to = getMultiSendCallOnlyDeployment({
              version,
              network: chainId,
            })!.networkAddresses[chainId];
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            const expectedLimitAddresses = await target.getLimitAddresses({
              version,
              chainId,
              data,
              to: getAddress(to),
            });
            expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
          });

          it('should throw when the batch has an invalid transaction', async () => {
            const safe = safeBuilder().build();
            const transactions = [
              execTransactionEncoder().encode(),
              // Native ERC-20 transfer
              erc20TransferEncoder().encode(),
            ].map((data) => ({
              operation: faker.number.int({ min: 0, max: 1 }),
              data,
              to: getAddress(safe.address),
              value: faker.number.bigInt(),
            }));
            const data = multiSendEncoder()
              .with('transactions', multiSendTransactionsEncoder(transactions))
              .encode();
            const to = getMultiSendCallOnlyDeployment({
              version,
              network: chainId,
            })!.networkAddresses[chainId];
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            await expect(
              target.getLimitAddresses({
                version,
                chainId,
                data,
                to: getAddress(to),
              }),
            ).rejects.toThrow(
              'Invalid multiSend call. The batch is not all execTransaction calls to same address.',
            );
          });

          it('should throw when the mastercopy is not official', async () => {
            const safe = safeBuilder().build();
            const transactions = [
              execTransactionEncoder().encode(),
              execTransactionEncoder().encode(),
            ].map((data) => ({
              operation: faker.number.int({ min: 0, max: 1 }),
              data,
              to: getAddress(safe.address),
              value: faker.number.bigInt(),
            }));
            const data = multiSendEncoder()
              .with('transactions', multiSendTransactionsEncoder(transactions))
              .encode();
            const to = getMultiSendCallOnlyDeployment({
              version,
              network: chainId,
            })!.networkAddresses[chainId];
            // Unofficial mastercopy
            mockSafeRepository.getSafe.mockRejectedValue(
              new Error('Not official mastercopy'),
            );

            await expect(
              target.getLimitAddresses({
                version,
                chainId,
                data,
                to: getAddress(to),
              }),
            ).rejects.toThrow(
              'Safe attempting to relay is not official. Only official Safe singletons are supported.',
            );
          });

          it('should throw when the batch is to varying parties', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const otherParty = getAddress(faker.finance.ethereumAddress());
            const transactions = [
              execTransactionEncoder().with('to', safeAddress).encode(),
              execTransactionEncoder().with('to', otherParty).encode(),
            ].map((data, i) => ({
              operation: faker.number.int({ min: 0, max: 1 }),
              data,
              // Varying parties
              to: i === 0 ? safeAddress : otherParty,
              value: faker.number.bigInt(),
            }));
            const data = multiSendEncoder()
              .with('transactions', multiSendTransactionsEncoder(transactions))
              .encode();
            const to = getMultiSendCallOnlyDeployment({
              version,
              network: chainId,
            })!.networkAddresses[chainId];
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            await expect(
              target.getLimitAddresses({
                version,
                chainId,
                data,
                to: getAddress(to),
              }),
            ).rejects.toThrow(
              'Invalid multiSend call. The batch is not all execTransaction calls to same address.',
            );
          });

          it('should throw for unofficial MultiSend deployments', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const transactions = [
              execTransactionEncoder()
                .with('data', addOwnerWithThresholdEncoder().encode())
                .encode(),
              execTransactionEncoder()
                .with('data', changeThresholdEncoder().encode())
                .encode(),
            ].map((data) => ({
              operation: faker.number.int({ min: 0, max: 1 }),
              data,
              to: safeAddress,
              value: faker.number.bigInt(),
            }));
            const data = multiSendEncoder()
              .with('transactions', multiSendTransactionsEncoder(transactions))
              .encode();
            // Unofficial MultiSend deployment
            const to = getAddress(faker.finance.ethereumAddress());
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            await expect(
              target.getLimitAddresses({
                version,
                chainId,
                data,
                to,
              }),
            ).rejects.toThrow(
              'MultiSend contract is not official. Only official MultiSend contracts are supported.',
            );
          });
        },
      );

      it('should throw for non-existent MultiSendCallOnly versions', async () => {
        // Non-existent version
        const version = '1.0.0';
        const safe = safeBuilder().build();
        const safeAddress = getAddress(safe.address);
        const transactions = [
          execTransactionEncoder()
            .with('data', addOwnerWithThresholdEncoder().encode())
            .encode(),
          execTransactionEncoder()
            .with('data', changeThresholdEncoder().encode())
            .encode(),
        ].map((data) => ({
          operation: faker.number.int({ min: 0, max: 1 }),
          data,
          to: safeAddress,
          value: faker.number.bigInt(),
        }));
        const data = multiSendEncoder()
          .with('transactions', multiSendTransactionsEncoder(transactions))
          .encode();
        const to = faker.finance.ethereumAddress();

        await expect(
          target.getLimitAddresses({
            version,
            chainId,
            data,
            to: getAddress(to),
          }),
        ).rejects.toThrow(
          'MultiSend contract is not official. Only official MultiSend contracts are supported.',
        );

        expect(MULTI_SEND_CALL_ONLY_VERSIONS[chainId].includes(version)).toBe(
          false,
        );
      });
    });

    describe('MultiSend', () => {
      describe.each(MULTI_SEND_VERSIONS[chainId])(
        'v%s multiSend',
        (version) => {
          it('should return the limit address for valid "standard" MultiSend calls', async () => {
            const safe = safeBuilder().build();
            const safeAddress = getAddress(safe.address);
            const transactions = [
              execTransactionEncoder()
                .with('data', addOwnerWithThresholdEncoder().encode())
                .encode(),
              execTransactionEncoder()
                .with('data', changeThresholdEncoder().encode())
                .encode(),
            ].map((data) => ({
              operation: faker.number.int({ min: 0, max: 1 }),
              data,
              to: safeAddress,
              value: faker.number.bigInt(),
            }));
            const data = multiSendEncoder()
              .with('transactions', multiSendTransactionsEncoder(transactions))
              .encode();
            const to = getMultiSendDeployment({
              version,
              network: chainId,
            })!.networkAddresses[chainId];
            // Official mastercopy
            mockSafeRepository.getSafe.mockResolvedValue(safe);

            const expectedLimitAddresses = await target.getLimitAddresses({
              version,
              chainId,
              data,
              to: getAddress(to),
            });
            expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
          });
        },
      );

      it('should throw for non-existent MultiSend versions', async () => {
        // Non-existent version
        const version = '1.0.0';
        const safe = safeBuilder().build();
        const safeAddress = getAddress(safe.address);
        const transactions = [
          execTransactionEncoder()
            .with('data', addOwnerWithThresholdEncoder().encode())
            .encode(),
          execTransactionEncoder()
            .with('data', changeThresholdEncoder().encode())
            .encode(),
        ].map((data) => ({
          operation: faker.number.int({ min: 0, max: 1 }),
          data,
          to: safeAddress,
          value: faker.number.bigInt(),
        }));
        const data = multiSendEncoder()
          .with('transactions', multiSendTransactionsEncoder(transactions))
          .encode();
        const to = faker.finance.ethereumAddress();
        // Official mastercopy
        mockSafeRepository.getSafe.mockResolvedValue(safe);

        await expect(
          target.getLimitAddresses({
            version,
            chainId,
            data,
            to: getAddress(to),
          }),
        ).rejects.toThrow(
          'MultiSend contract is not official. Only official MultiSend contracts are supported.',
        );

        expect(MULTI_SEND_VERSIONS[chainId].includes(version)).toBe(false);
      });
    });

    describe('ProxyFactory', () => {
      describe.each(PROXY_FACTORY_VERSIONS[chainId])(
        'v%s createProxyWithNonce',
        (version) => {
          if (SAFE_VERSIONS[chainId].includes(version)) {
            it('should return the limit addresses when creating an official Safe', async () => {
              const owners = [
                getAddress(faker.finance.ethereumAddress()),
                getAddress(faker.finance.ethereumAddress()),
              ];
              const singleton = getSafeSingletonDeployment({
                version,
                network: chainId,
              })!.networkAddresses[chainId];
              const data = createProxyWithNonceEncoder()
                .with('singleton', getAddress(singleton))
                .with(
                  'initializer',
                  setupEncoder().with('owners', owners).encode(),
                )
                .encode();
              const proxyFactory = getProxyFactoryDeployment({
                version,
                network: chainId,
              })!.networkAddresses[chainId];
              const to = getAddress(proxyFactory);

              const expectedLimitAddresses = await target.getLimitAddresses({
                version,
                chainId,
                data,
                to,
              });
              expect(expectedLimitAddresses).toStrictEqual(owners);
            });

            it('should throw when using an unofficial ProxyFactory to create an official Safe', async () => {
              const owners = [
                getAddress(faker.finance.ethereumAddress()),
                getAddress(faker.finance.ethereumAddress()),
              ];
              const singleton = getSafeSingletonDeployment({
                version,
                network: chainId,
              })!.networkAddresses[chainId];
              const data = createProxyWithNonceEncoder()
                .with('singleton', getAddress(singleton))
                .with(
                  'initializer',
                  setupEncoder().with('owners', owners).encode(),
                )
                .encode();
              // Unofficial ProxyFactory
              const to = getAddress(faker.finance.ethereumAddress());

              await expect(
                target.getLimitAddresses({
                  version,
                  chainId,
                  data,
                  to,
                }),
              ).rejects.toThrow(
                'ProxyFactory contract is not official. Only official ProxyFactory contracts are supported.',
              );
            });
          }

          if (SAFE_L2_VERSIONS[chainId].includes(version)) {
            it('should return the limit addresses when creating an official L2 Safe', async () => {
              const owners = [
                getAddress(faker.finance.ethereumAddress()),
                getAddress(faker.finance.ethereumAddress()),
              ];
              const singleton = getSafeL2SingletonDeployment({
                version,
                network: chainId,
              })!.networkAddresses[chainId];
              const data = createProxyWithNonceEncoder()
                .with('singleton', getAddress(singleton))
                .with(
                  'initializer',
                  setupEncoder().with('owners', owners).encode(),
                )
                .encode();
              const proxyFactory = getProxyFactoryDeployment({
                version,
                network: chainId,
              })!.networkAddresses[chainId];
              const to = getAddress(proxyFactory);

              const expectedLimitAddresses = await target.getLimitAddresses({
                version,
                chainId,
                data,
                to,
              });
              expect(expectedLimitAddresses).toStrictEqual(owners);
            });

            it('should throw when using an unofficial ProxyFactory to create an official L2 Safe', async () => {
              const owners = [
                getAddress(faker.finance.ethereumAddress()),
                getAddress(faker.finance.ethereumAddress()),
              ];
              const singleton = getSafeL2SingletonDeployment({
                version,
                network: chainId,
              })!.networkAddresses[chainId];
              const data = createProxyWithNonceEncoder()
                .with('singleton', getAddress(singleton))
                .with(
                  'initializer',
                  setupEncoder().with('owners', owners).encode(),
                )
                .encode();
              // Unofficial ProxyFactory
              const to = getAddress(faker.finance.ethereumAddress());

              await expect(
                target.getLimitAddresses({
                  version,
                  chainId,
                  data,
                  to,
                }),
              ).rejects.toThrow(
                'ProxyFactory contract is not official. Only official ProxyFactory contracts are supported.',
              );
            });
          }

          it('should throw when creating an unofficial Safe', async () => {
            const owners = [
              getAddress(faker.finance.ethereumAddress()),
              getAddress(faker.finance.ethereumAddress()),
            ];
            // Unofficial singleton
            const singleton = getAddress(faker.finance.ethereumAddress());
            const data = createProxyWithNonceEncoder()
              .with('singleton', getAddress(singleton))
              .with(
                'initializer',
                setupEncoder().with('owners', owners).encode(),
              )
              .encode();
            const proxyFactory = getProxyFactoryDeployment({
              version,
              network: chainId,
            })!.networkAddresses[chainId];
            const to = getAddress(proxyFactory);

            await expect(
              target.getLimitAddresses({
                version,
                chainId,
                data,
                to,
              }),
            ).rejects.toThrow(
              'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
            );
          });

          it('should throw for non-existent ProxyFactory versions', async () => {
            // Non-existent version
            const version = '1.2.0';
            const owners = [
              getAddress(faker.finance.ethereumAddress()),
              getAddress(faker.finance.ethereumAddress()),
            ];
            // Unofficial singleton
            const singleton = getAddress(faker.finance.ethereumAddress());
            const data = createProxyWithNonceEncoder()
              .with('singleton', getAddress(singleton))
              .with(
                'initializer',
                setupEncoder().with('owners', owners).encode(),
              )
              .encode();
            const to = faker.finance.ethereumAddress();

            await expect(
              target.getLimitAddresses({
                version,
                chainId,
                data,
                to,
              }),
            ).rejects.toThrow(
              'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
            );

            expect(PROXY_FACTORY_VERSIONS[chainId].includes(version)).toBe(
              false,
            );
          });
        },
      );
    });

    describe('Validation', () => {
      it('should throw if not an execTransaction, multiSend or createProxyWithNonceCall', async () => {
        const version = faker.helpers.arrayElement(SAFE_VERSIONS[chainId]);
        const safe = safeBuilder().build();
        const safeAddress = getAddress(safe.address);
        const data = erc20TransferEncoder().encode();
        // Official mastercopy
        mockSafeRepository.getSafe.mockResolvedValue(safe);

        await expect(
          target.getLimitAddresses({
            version,
            chainId,
            data,
            to: safeAddress,
          }),
        ).rejects.toThrow(
          'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
        );
      });

      it('should throw if the to address is not valid', async () => {
        const version = faker.helpers.arrayElement(SAFE_VERSIONS[chainId]);
        const to = '0x000000000000000000000000000000000INVALID';
        const data = erc20TransferEncoder().encode();

        await expect(
          target.getLimitAddresses({
            version,
            chainId,
            data,
            to,
          }),
        ).rejects.toThrow('Invalid to provided');
      });

      it('should throw if the to address is not hexadecimal', async () => {
        const version = faker.helpers.arrayElement(SAFE_VERSIONS[chainId]);
        const to = 'not hexadecimal';
        const data = erc20TransferEncoder().encode();

        await expect(
          target.getLimitAddresses({
            version,
            chainId,
            data,
            to,
          }),
        ).rejects.toThrow('Invalid to provided');
      });

      it('should throw if the calldata is not hexadecimal', async () => {
        const version = faker.helpers.arrayElement(SAFE_VERSIONS[chainId]);
        const to = faker.finance.ethereumAddress();
        const data = 'not hexadecimal';

        await expect(
          target.getLimitAddresses({
            version,
            chainId,
            data,
            to,
          }),
        ).rejects.toThrow('Invalid data provided');
      });
    });
  });
});
