import { erc20TransferEncoder } from '@/domain/contracts/contracts/__tests__/erc20-encoder.builder';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/contracts/contracts/__tests__/multi-send-encoder.builder';
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
} from '@/domain/contracts/contracts/__tests__/safe-encoder.builder';
import { MultiSendDecoder } from '@/domain/contracts/contracts/multi-send-decoder.helper';
import { SafeDecoder } from '@/domain/contracts/contracts/safe-decoder.helper';
import { createProxyWithNonceEncoder } from '@/domain/relay/contracts/__tests__/proxy-factory-encoder.builder';
import { Erc20ContractHelper } from '@/domain/relay/contracts/erc20-contract.helper';
import { ProxyFactoryDecoder } from '@/domain/relay/contracts/proxy-factory-decoder.helper';
import { SafeContractHelper } from '@/domain/relay/contracts/safe-contract.helper';
import { LimitAddressesMapper } from '@/domain/relay/limit-addresses.mapper';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { faker } from '@faker-js/faker';
import {
  getMultiSendCallOnlyDeployment,
  getMultiSendDeployment,
  getSafeL2SingletonDeployment,
  getSafeSingletonDeployment,
} from '@safe-global/safe-deployments';
import { Hex, getAddress } from 'viem';

const mockSafeRepository = jest.mocked({
  getSafe: jest.fn(),
} as jest.MockedObjectDeep<ISafeRepository>);

describe('LimitAddressesMapper', () => {
  let target: LimitAddressesMapper;

  beforeEach(() => {
    jest.resetAllMocks();

    const safeContractHelper = new SafeContractHelper();
    const erc20ContractHelper = new Erc20ContractHelper();
    const safeDecoder = new SafeDecoder();
    const multiSendDecoder = new MultiSendDecoder();
    const proxyFactoryDecoder = new ProxyFactoryDecoder();

    target = new LimitAddressesMapper(
      mockSafeRepository,
      safeContractHelper,
      erc20ContractHelper,
      safeDecoder,
      multiSendDecoder,
      proxyFactoryDecoder,
    );
  });

  describe('execTransaction', () => {
    // execTransaction
    it('should return the limit address when sending native currency to another party', async () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().build();
      const safeAddress = getAddress(safe.address);
      const data = execTransactionEncoder()
        .with('to', getAddress(faker.finance.ethereumAddress()))
        .encode() as Hex;
      // Official mastercopy
      mockSafeRepository.getSafe.mockResolvedValue(safe);

      const expectedLimitAddresses = await target.getLimitAddresses({
        chainId,
        data,
        to: safeAddress,
      });
      expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
    });

    // transfer (execTransaction)
    it('should return the limit when sending ERC-20 tokens to another party', async () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().build();
      const safeAddress = getAddress(safe.address);
      const data = execTransactionEncoder()
        .with('to', getAddress(faker.finance.ethereumAddress()))
        .with('data', erc20TransferEncoder().encode())
        .encode() as Hex;
      // Official mastercopy
      mockSafeRepository.getSafe.mockResolvedValue(safe);

      const expectedLimitAddresses = await target.getLimitAddresses({
        chainId,
        data,
        to: safeAddress,
      });
      expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
    });

    // cancellation (execTransaction)
    it('should return the limit address when cancelling a transaction', async () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().build();
      const safeAddress = getAddress(safe.address);
      const data = execTransactionEncoder()
        .with('to', safeAddress)
        .with('data', '0x')
        .encode() as Hex;
      // Official mastercopy
      mockSafeRepository.getSafe.mockResolvedValue(safe);

      const expectedLimitAddresses = await target.getLimitAddresses({
        chainId,
        data,
        to: safeAddress,
      });
      expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
    });

    // addOwnerWithThreshold (execTransaction)
    it('should return the limit address when making an addOwnerWithThreshold call', async () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().build();
      const safeAddress = getAddress(safe.address);
      const data = execTransactionEncoder()
        .with('to', safeAddress)
        .with('data', addOwnerWithThresholdEncoder().encode())
        .encode() as Hex;
      // Official mastercopy
      mockSafeRepository.getSafe.mockResolvedValue(safe);

      const expectedLimitAddresses = await target.getLimitAddresses({
        chainId,
        data,
        to: safeAddress,
      });
      expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
    });

    // changeThreshold (execTransaction)
    it('should return the limit address when making a changeThreshold call', async () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().build();
      const safeAddress = getAddress(safe.address);
      const data = execTransactionEncoder()
        .with('to', safeAddress)
        .with('data', changeThresholdEncoder().encode())
        .encode() as Hex;
      // Official mastercopy
      mockSafeRepository.getSafe.mockResolvedValue(safe);

      const expectedLimitAddresses = await target.getLimitAddresses({
        chainId,
        data,
        to: safeAddress,
      });
      expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
    });

    // enableModule (execTransaction)
    it('should return the limit address when making a enableModule call', async () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().build();
      const safeAddress = getAddress(safe.address);
      const data = execTransactionEncoder()
        .with('to', safeAddress)
        .with('data', enableModuleEncoder().encode())
        .encode() as Hex;
      // Official mastercopy
      mockSafeRepository.getSafe.mockResolvedValue(safe);

      const expectedLimitAddresses = await target.getLimitAddresses({
        chainId,
        data,
        to: safeAddress,
      });
      expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
    });

    // disableModule (execTransaction)
    it('should return the limit address when making a disableModule call', async () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().build();
      const safeAddress = getAddress(safe.address);
      const data = execTransactionEncoder()
        .with('to', safeAddress)
        .with('data', disableModuleEncoder().encode())
        .encode() as Hex;
      // Official mastercopy
      mockSafeRepository.getSafe.mockResolvedValue(safe);

      const expectedLimitAddresses = await target.getLimitAddresses({
        chainId,
        data,
        to: safeAddress,
      });
      expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
    });

    // removeOwner (execTransaction)
    it('should return the limit address when making a removeOwner call', async () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().build();
      const safeAddress = getAddress(safe.address);
      const data = execTransactionEncoder()
        .with('to', safeAddress)
        .with('data', removeOwnerEncoder().encode())
        .encode() as Hex;
      // Official mastercopy
      mockSafeRepository.getSafe.mockResolvedValue(safe);

      const expectedLimitAddresses = await target.getLimitAddresses({
        chainId,
        data,
        to: safeAddress,
      });
      expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
    });

    // setFallbackHandler (execTransaction)
    it('should return the limit address when making a setFallbackHandler call', async () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().build();
      const safeAddress = getAddress(safe.address);
      const data = execTransactionEncoder()
        .with('to', safeAddress)
        .with('data', setFallbackHandlerEncoder().encode())
        .encode() as Hex;
      // Official mastercopy
      mockSafeRepository.getSafe.mockResolvedValue(safe);

      const expectedLimitAddresses = await target.getLimitAddresses({
        chainId,
        data,
        to: safeAddress,
      });
      expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
    });

    // setGuard (execTransaction)
    it('should return the limit address when making a setGuard call', async () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().build();
      const safeAddress = getAddress(safe.address);
      const data = execTransactionEncoder()
        .with('to', safeAddress)
        .with('data', setGuardEncoder().encode())
        .encode() as Hex;
      // Official mastercopy
      mockSafeRepository.getSafe.mockResolvedValue(safe);

      const expectedLimitAddresses = await target.getLimitAddresses({
        chainId,
        data,
        to: safeAddress,
      });
      expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
    });

    // swapOwner (execTransaction)
    it('should return the limit address when making a swapOwner call', async () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().build();
      const safeAddress = getAddress(safe.address);
      const data = execTransactionEncoder()
        .with('to', safeAddress)
        .with('data', swapOwnerEncoder().encode())
        .encode() as Hex;
      // Official mastercopy
      mockSafeRepository.getSafe.mockResolvedValue(safe);

      const expectedLimitAddresses = await target.getLimitAddresses({
        chainId,
        data,
        to: safeAddress,
      });
      expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
    });

    // execTransaction (execTransaction)
    it('should return the limit address calling execTransaction on a nested Safe', async () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().build();
      const safeAddress = getAddress(safe.address);
      const data = execTransactionEncoder()
        .with('to', getAddress(faker.finance.ethereumAddress()))
        .with('data', execTransactionEncoder().encode())
        .encode() as Hex;
      // Official mastercopy
      mockSafeRepository.getSafe.mockResolvedValue(safe);

      const expectedLimitAddresses = await target.getLimitAddresses({
        chainId,
        data,
        to: safeAddress,
      });
      expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
    });

    // execTransaction
    it('should throw when sending native currency to self', async () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().build();
      const safeAddress = getAddress(safe.address);
      const data = execTransactionEncoder()
        .with('to', safeAddress)
        .encode() as Hex;
      // Official mastercopy
      mockSafeRepository.getSafe.mockRejectedValue(true);

      await expect(
        target.getLimitAddresses({
          chainId,
          data,
          to: safeAddress,
        }),
      ).rejects.toThrow('Invalid Safe contract');
    });

    // transfer (execTransaction)
    it('should throw when sending ERC-20 tokens to self', async () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().build();
      const safeAddress = getAddress(safe.address);
      const data = execTransactionEncoder()
        .with('to', getAddress(faker.finance.ethereumAddress()))
        .with('data', erc20TransferEncoder().with('to', safeAddress).encode())
        .encode() as Hex;
      // Official mastercopy
      mockSafeRepository.getSafe.mockResolvedValue(safe);

      await expect(
        target.getLimitAddresses({
          chainId,
          data,
          to: safeAddress,
        }),
      ).rejects.toThrow('Cannot get limit addresses – Invalid transfer');
    });

    // Unofficial mastercopy
    it('should throw when the mastercopy is not official', async () => {
      const chainId = faker.string.numeric();
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
          chainId,
          data,
          to: safeAddress,
        }),
      ).rejects.toThrow('Invalid Safe contract');
    });
  });

  describe('multiSend', () => {
    it('should return the limit address when entire batch is valid', async () => {
      // Fixed chain ID for deployment address
      const chainId = '1';
      const version = '1.3.0';
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
        chainId,
        data,
        to: getAddress(to),
      });
      expect(expectedLimitAddresses).toStrictEqual([safeAddress]);
    });

    it('should throw when the batch has an invalid transaction', async () => {
      // Fixed chain ID for deployment address
      const chainId = '1';
      const version = '1.3.0';
      const safe = safeBuilder().build();
      const safeAddress = getAddress(safe.address);
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
          chainId,
          data,
          to: getAddress(to),
        }),
      ).rejects.toThrow('Invalid MultiSend transactions');
    });

    it('should throw when the mastercopy is not official', async () => {
      // Fixed chain ID for deployment address
      const chainId = '1';
      const version = '1.3.0';
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
          chainId,
          data,
          to: getAddress(to),
        }),
      ).rejects.toThrow('Invalid Safe contract');
    });

    it('should throw when the batch is to varying parties', async () => {
      const chainId = '1';
      const version = '1.3.0';
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
          chainId,
          data,
          to: getAddress(to),
        }),
      ).rejects.toThrow('MultiSend transactions target different addresses');
    });

    it('should throw for non-callonly MultiSend deployments', async () => {
      // Fixed chain ID for deployment address
      const chainId = '1';
      const version = '1.3.0';
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
      // Non-callonly MultiSend deployment
      const to = getMultiSendDeployment({
        version,
        network: chainId,
      })!.networkAddresses[chainId];
      // Official mastercopy
      mockSafeRepository.getSafe.mockResolvedValue(safe);

      await expect(
        target.getLimitAddresses({
          chainId,
          data,
          to: getAddress(to),
        }),
      ).rejects.toThrow('Cannot get limit addresses – Invalid transfer');
    });

    it('should throw for unofficial MultiSend deployments', async () => {
      const chainId = faker.string.numeric();
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
          chainId,
          data,
          to,
        }),
      ).rejects.toThrow('Cannot get limit addresses – Invalid transfer');
    });
  });

  describe('createProxyWithNonce', () => {
    it('should return the limit addresses when creating an official L1 Safe', async () => {
      // Fixed chain ID for deployment address
      const chainId = '1';
      const version = '1.3.0';
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
        .with('initializer', setupEncoder().with('owners', owners).encode())
        .encode();
      // ProxyFactory address (singletons are checked for official mastercopies so we need not check this)
      const to = getAddress(faker.finance.ethereumAddress());

      const expectedLimitAddresses = await target.getLimitAddresses({
        chainId,
        data,
        to,
      });
      expect(expectedLimitAddresses).toStrictEqual(owners);
    });

    it('should return the limit addresses when creating an official L2 Safe', async () => {
      // Fixed chain ID for deployment address
      const chainId = '1';
      const version = '1.3.0';
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
        .with('initializer', setupEncoder().with('owners', owners).encode())
        .encode();
      // ProxyFactory address (singletons are checked for official mastercopies so we need not check this)
      const to = getAddress(faker.finance.ethereumAddress());

      const expectedLimitAddresses = await target.getLimitAddresses({
        chainId,
        data,
        to,
      });
      expect(expectedLimitAddresses).toStrictEqual(owners);
    });

    it('should throw when creating an unofficial Safe', async () => {
      const chainId = faker.string.numeric();
      const owners = [
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
      ];
      // Unofficial singleton
      const singleton = getAddress(faker.finance.ethereumAddress());
      const data = createProxyWithNonceEncoder()
        .with('singleton', getAddress(singleton))
        .with('initializer', setupEncoder().with('owners', owners).encode())
        .encode();
      // ProxyFactory address (singletons are checked for official mastercopies so we need not check this)
      const to = getAddress(faker.finance.ethereumAddress());

      await expect(
        target.getLimitAddresses({
          chainId,
          data,
          to,
        }),
      ).rejects.toThrow('Cannot get limit addresses – Invalid transfer');
    });
  });

  it('otherwise throws an error', async () => {
    const chainId = faker.string.numeric();
    const safe = safeBuilder().build();
    const safeAddress = getAddress(safe.address);
    const data = erc20TransferEncoder().encode();
    // Official mastercopy
    mockSafeRepository.getSafe.mockResolvedValue(safe);

    await expect(
      target.getLimitAddresses({
        chainId,
        data,
        to: safeAddress,
      }),
    ).rejects.toThrow('Cannot get limit addresses – Invalid transfer');
  });
});
