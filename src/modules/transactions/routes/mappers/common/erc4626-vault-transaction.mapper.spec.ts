// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { erc4626Abi, getAddress, type Hex, type PublicClient } from 'viem';
import type { MockedObject } from 'vitest';
import type { IBlockchainApiManager } from '#/domain/interfaces/blockchain-api.manager.interface';
import type { ILoggingService } from '#/logging/logging.interface';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '#/modules/contracts/domain/__tests__/encoders/multi-send-encoder.builder';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import {
  erc20ApproveEncoder,
  erc20TransferEncoder,
} from '#/modules/relay/domain/contracts/__tests__/encoders/erc20-encoder.builder';
import { ALLOWLISTED_ERC4626_VAULTS } from '#/modules/transactions/domain/erc4626-vault.allowlist';
import { KilnVaultHelper } from '#/modules/transactions/routes/helpers/kiln-vault.helper';
import { TransactionFinder } from '#/modules/transactions/routes/helpers/transaction-finder.helper';
import { Erc4626VaultTransactionMapper } from '#/modules/transactions/routes/mappers/common/erc4626-vault-transaction.mapper';

// Real mainnet calldata for Spark Savings spUSDT. The encodings are what the
// test is about, so they stay literal rather than coming from a builder.
const RECEIVER = getAddress('0x5afe5afe5afe5afe5afe5afe5afe5afe5afe5afe');
// deposit(uint256,address): 50,000 USDT
const DEPOSIT_CALLDATA: Hex =
  '0x6e553f650000000000000000000000000000000000000000000000000000000ba43b74000000000000000000000000005afe5afe5afe5afe5afe5afe5afe5afe5afe5afe';
// deposit(uint256,address,uint16): 50,000 USDT, referral 123
const DEPOSIT_WITH_REFERRAL_CALLDATA: Hex =
  '0x9b8d6d380000000000000000000000000000000000000000000000000000000ba43b74000000000000000000000000005afe5afe5afe5afe5afe5afe5afe5afe5afe5afe000000000000000000000000000000000000000000000000000000000000007b';
// redeem(uint256,address,address): 49,000 shares
const REDEEM_CALLDATA: Hex =
  '0xba0876520000000000000000000000000000000000000000000000000000000b68a0aa000000000000000000000000005afe5afe5afe5afe5afe5afe5afe5afe5afe5afe0000000000000000000000005afe5afe5afe5afe5afe5afe5afe5afe5afe5afe';

const MAINNET_CHAIN_ID = '1';
const [SP_USDT] = ALLOWLISTED_ERC4626_VAULTS;
const SP_USDT_VAULT = {
  chainId: SP_USDT.chainId,
  address: SP_USDT.address,
  name: SP_USDT.name,
  protocol: SP_USDT.protocol,
};

const mockLoggingService = {
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

const mockPublicClient = {
  readContract: vi.fn(),
} as unknown as MockedObject<PublicClient>;

const mockBlockchainApiManager = {
  getApi: vi.fn(),
} as unknown as MockedObject<IBlockchainApiManager>;

describe('Erc4626VaultTransactionMapper', () => {
  let target: Erc4626VaultTransactionMapper;

  beforeEach(() => {
    vi.resetAllMocks();
    mockBlockchainApiManager.getApi.mockResolvedValue(mockPublicClient);

    const transactionFinder = new TransactionFinder(
      new MultiSendDecoder(mockLoggingService),
    );
    target = new Erc4626VaultTransactionMapper(
      new KilnVaultHelper(transactionFinder),
      mockBlockchainApiManager,
    );
  });

  it('should be anchored on spUSDT, allowlisted on mainnet', () => {
    expect(SP_USDT).toEqual({
      chainId: MAINNET_CHAIN_ID,
      address: getAddress('0xe2e7a17dFf93280dec073C995595155283e3C372'),
      name: 'Spark Savings USDT',
      protocol: 'Spark',
      asset: {
        address: getAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7'),
        decimals: 6,
        symbol: 'USDT',
      },
    });
  });

  it('should decode a deposit', async () => {
    const actual = await target.mapVaultTransaction({
      chainId: MAINNET_CHAIN_ID,
      transaction: { to: SP_USDT.address, data: DEPOSIT_CALLDATA, value: '0' },
    });

    expect(actual).toEqual({
      method: 'deposit',
      vault: SP_USDT_VAULT,
      asset: SP_USDT.asset,
      assets: '50000000000',
      shares: null,
      receiver: RECEIVER,
      owner: null,
      referral: null,
    });
    expect(mockBlockchainApiManager.getApi).not.toHaveBeenCalled();
  });

  it('should decode a deposit with a referral', async () => {
    const actual = await target.mapVaultTransaction({
      chainId: MAINNET_CHAIN_ID,
      transaction: {
        to: SP_USDT.address,
        data: DEPOSIT_WITH_REFERRAL_CALLDATA,
        value: '0',
      },
    });

    expect(actual).toEqual({
      method: 'deposit',
      vault: SP_USDT_VAULT,
      asset: SP_USDT.asset,
      assets: '50000000000',
      shares: null,
      receiver: RECEIVER,
      owner: null,
      referral: 123,
    });
    expect(mockBlockchainApiManager.getApi).not.toHaveBeenCalled();
  });

  it('should decode a redeem, converting shares to assets on-chain', async () => {
    // 49,000 shares at 1.0101 USDT per share
    mockPublicClient.readContract.mockResolvedValue(BigInt(49_494_900_000));

    const actual = await target.mapVaultTransaction({
      chainId: MAINNET_CHAIN_ID,
      transaction: { to: SP_USDT.address, data: REDEEM_CALLDATA, value: '0' },
    });

    expect(actual).toEqual({
      method: 'redeem',
      vault: SP_USDT_VAULT,
      asset: SP_USDT.asset,
      assets: '49494900000',
      shares: '49000000000',
      receiver: RECEIVER,
      owner: RECEIVER,
      referral: null,
    });
    expect(mockBlockchainApiManager.getApi).toHaveBeenCalledWith(
      MAINNET_CHAIN_ID,
    );
    expect(mockPublicClient.readContract).toHaveBeenCalledWith({
      address: SP_USDT.address,
      abi: erc4626Abi,
      functionName: 'convertToAssets',
      args: [BigInt(49_000_000_000)],
    });
  });

  it('should decode a deposit batched after an approve', async () => {
    const approve = erc20ApproveEncoder()
      .with('spender', SP_USDT.address)
      .with('amount', BigInt(50_000_000_000));
    const multiSend = multiSendEncoder().with(
      'transactions',
      multiSendTransactionsEncoder([
        {
          operation: 0,
          to: SP_USDT.asset.address,
          value: BigInt(0),
          data: approve.encode(),
        },
        {
          operation: 0,
          to: SP_USDT.address,
          value: BigInt(0),
          data: DEPOSIT_WITH_REFERRAL_CALLDATA,
        },
      ]),
    );

    const actual = await target.mapVaultTransaction({
      chainId: MAINNET_CHAIN_ID,
      transaction: {
        to: getAddress(faker.finance.ethereumAddress()),
        data: multiSend.encode(),
        value: '0',
      },
    });

    expect(actual).toEqual({
      method: 'deposit',
      vault: SP_USDT_VAULT,
      asset: SP_USDT.asset,
      assets: '50000000000',
      shares: null,
      receiver: RECEIVER,
      owner: null,
      referral: 123,
    });
  });

  it('should return null for a vault that is not allowlisted', async () => {
    const actual = await target.mapVaultTransaction({
      chainId: MAINNET_CHAIN_ID,
      transaction: {
        to: getAddress(faker.finance.ethereumAddress()),
        data: REDEEM_CALLDATA,
        value: '0',
      },
    });

    expect(actual).toBeNull();
    expect(mockBlockchainApiManager.getApi).not.toHaveBeenCalled();
  });

  it('should return null for an allowlisted vault address on another chain', async () => {
    const actual = await target.mapVaultTransaction({
      chainId: faker.string.numeric({ exclude: [MAINNET_CHAIN_ID] }),
      transaction: { to: SP_USDT.address, data: DEPOSIT_CALLDATA, value: '0' },
    });

    expect(actual).toBeNull();
  });

  it('should return null for a call that is not a vault entry point', async () => {
    const actual = await target.mapVaultTransaction({
      chainId: MAINNET_CHAIN_ID,
      transaction: {
        to: SP_USDT.address,
        data: erc20TransferEncoder().encode(),
        value: '0',
      },
    });

    expect(actual).toBeNull();
  });

  it('should propagate a failed on-chain conversion', async () => {
    const error = new Error('RPC error');
    mockPublicClient.readContract.mockRejectedValue(error);

    await expect(
      target.mapVaultTransaction({
        chainId: MAINNET_CHAIN_ID,
        transaction: {
          to: SP_USDT.address,
          data: REDEEM_CALLDATA,
          value: '0',
        },
      }),
    ).rejects.toThrow(error);
  });
});
