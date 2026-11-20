// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import {
  type Address,
  concat,
  encodeFunctionData,
  encodePacked,
  getAddress,
  type Hex,
  keccak256,
  parseAbi,
  toBytes,
} from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import type { IConfigurationService } from '#/config/configuration.service.interface';
import { getAllMultiSendDeployments } from '#/domain/common/utils/deployments';
import type { ILoggingService } from '#/logging/logging.interface';
import type { IChainsRepository } from '#/modules/chains/domain/chains.repository.interface';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '#/modules/contracts/domain/__tests__/encoders/multi-send-encoder.builder';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import {
  erc20ApproveEncoder,
  erc20TransferEncoder,
} from '#/modules/relay/domain/contracts/__tests__/encoders/erc20-encoder.builder';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import { setPreSignatureEncoder } from '#/modules/swaps/domain/contracts/__tests__/encoders/gp-v2-encoder.builder';
import { GPv2Decoder } from '#/modules/swaps/domain/contracts/decoders/gp-v2-decoder.helper';
import { orderBuilder } from '#/modules/swaps/domain/entities/__tests__/order.builder';
import {
  OrderKind,
  OrderStatus,
} from '#/modules/swaps/domain/entities/order.entity';
import type { SwapsRepository } from '#/modules/swaps/domain/swaps.repository';
import { tokenBuilder } from '#/modules/tokens/domain/__tests__/token.builder';
import type { ITokenRepository } from '#/modules/tokens/domain/token.repository.interface';
import { GPv2OrderHelper } from '#/modules/transactions/routes/helpers/gp-v2-order.helper';
import { SwapOrderHelper } from '#/modules/transactions/routes/helpers/swap-order.helper';

const swapsRepository = {
  getOrder: vi.fn(),
} as MockedObject<SwapsRepository>;
const swapsRepositoryMock = vi.mocked(swapsRepository);

const gpv2Decoder = {
  getOrderUidFromSetPreSignature: vi.fn(),
} as MockedObject<GPv2Decoder>;
const gpv2DecoderMock = vi.mocked(gpv2Decoder);

const tokenRepository = {
  getToken: vi.fn(),
} as MockedObject<ITokenRepository>;

const tokenRepositoryMock = vi.mocked(tokenRepository);

const configurationService = {
  getOrThrow: vi.fn(),
} as MockedObject<IConfigurationService>;
const configurationServiceMock = vi.mocked(configurationService);

const loggingService = {
  debug: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;
const multiSendDecoder = new MultiSendDecoder(loggingService);

const chainsRepository = {
  getChain: vi.fn(),
} as MockedObject<IChainsRepository>;
const chainsRepositoryMock = vi.mocked(chainsRepository);

describe('Swap Order Helper tests', () => {
  let target: SwapOrderHelper;
  const explorerBaseUrl = faker.internet.url();

  beforeEach(() => {
    vi.resetAllMocks();
    configurationServiceMock.getOrThrow.mockImplementation((key) => {
      if (key === 'swaps.explorerBaseUri') {
        return explorerBaseUrl;
      }
      throw new Error(`Key ${key} not found.`);
    });

    target = new SwapOrderHelper(
      multiSendDecoder,
      gpv2DecoderMock,
      tokenRepositoryMock,
      swapsRepositoryMock,
      configurationServiceMock,
      chainsRepositoryMock,
    );
  });

  it.each([Object.values(OrderStatus)])(
    'should map %s swap orders successfully',
    async (orderStatus) => {
      const chainId = faker.string.numeric();
      const buyToken = tokenBuilder().build();
      const sellToken = tokenBuilder().build();
      const order = orderBuilder()
        .with('status', orderStatus)
        .with('buyToken', getAddress(buyToken.address))
        .with('sellToken', getAddress(sellToken.address))
        .build();
      gpv2DecoderMock.getOrderUidFromSetPreSignature.mockReturnValue(
        order.uid as Address,
      );
      swapsRepositoryMock.getOrder.mockResolvedValue(order);
      tokenRepositoryMock.getToken.mockImplementation(({ address }) => {
        if (address === order.buyToken) {
          return Promise.resolve(buyToken);
        }
        if (address === order.sellToken) {
          return Promise.resolve(sellToken);
        }
        return Promise.reject(new Error(`Token ${address} not found.`));
      });

      const actual = await target.getOrder({
        chainId,
        orderUid: order.uid as Address,
      });

      expect(actual).toEqual({
        appData: order.appData,
        availableBalance: order.availableBalance,
        buyAmount: order.buyAmount,
        buyToken: order.buyToken,
        buyTokenBalance: order.buyTokenBalance,
        class: order.class,
        creationDate: order.creationDate,
        ethflowData: order.ethflowData,
        executedBuyAmount: order.executedBuyAmount,
        executedFeeAmount: order.executedFeeAmount,
        executedSellAmount: order.executedSellAmount,
        executedSellAmountBeforeFees: order.executedSellAmountBeforeFees,
        executedFee: order.executedFee,
        executedFeeToken: order.executedFeeToken,
        feeAmount: order.feeAmount,
        from: order.from,
        fullAppData: order.fullAppData,
        invalidated: order.invalidated,
        isLiquidityOrder: order.isLiquidityOrder,
        kind: order.kind,
        onchainOrderData: order.onchainOrderData,
        onchainUser: order.onchainUser,
        owner: order.owner,
        partiallyFillable: order.partiallyFillable,
        quoteId: order.quoteId,
        receiver: order.receiver,
        sellAmount: order.sellAmount,
        sellToken: order.sellToken,
        sellTokenBalance: order.sellTokenBalance,
        signature: order.signature,
        signingScheme: order.signingScheme,
        status: order.status,
        uid: order.uid,
        validTo: order.validTo,
      });
    },
  );

  it(`should throw if repository getOrder throws an error`, async () => {
    const chainId = faker.string.numeric();
    const orderUid = faker.string.hexadecimal({ length: 112 }) as Hex;
    const error = new Error('Order not found');
    swapsRepositoryMock.getOrder.mockRejectedValue(error);

    await expect(target.getOrder({ chainId, orderUid })).rejects.toThrow(error);

    expect(swapsRepositoryMock.getOrder).toHaveBeenCalledTimes(1);
    expect(swapsRepositoryMock.getOrder).toHaveBeenCalledWith(
      chainId,
      expect.any(String),
    );
  });

  it('should throw if token data is not available', async () => {
    const chainId = faker.string.numeric();
    const tokenAddress = getAddress(faker.finance.ethereumAddress());
    tokenRepositoryMock.getToken.mockRejectedValue(
      new Error('Token not found'),
    );

    await expect(
      target.getToken({
        chainId,
        address: tokenAddress,
      }),
    ).rejects.toThrow('Token not found');

    expect(tokenRepository.getToken).toHaveBeenCalledTimes(1);
    expect(tokenRepository.getToken).toHaveBeenCalledWith({
      chainId,
      address: tokenAddress,
    });
  });

  it.each(Object.values(OrderStatus))(
    'should throw if %s order kind is unknown',
    async (status) => {
      const chainId = faker.string.numeric();
      const order = orderBuilder()
        .with('status', status)
        .with('kind', OrderKind.Unknown)
        .build();
      swapsRepositoryMock.getOrder.mockResolvedValue(order);

      await expect(
        target.getOrder({
          chainId,
          orderUid: order.uid as Address,
        }),
      ).rejects.toThrow('Unknown order kind');

      expect(swapsRepositoryMock.getOrder).toHaveBeenCalledTimes(1);
      expect(swapsRepositoryMock.getOrder).toHaveBeenCalledWith(
        chainId,
        order.uid,
      );
    },
  );

  it('maps to native token if token is 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const tokenAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    chainsRepositoryMock.getChain.mockResolvedValue(chain);

    const actual = await target.getToken({
      chainId,
      address: tokenAddress,
    });

    expect(tokenRepository.getToken).not.toHaveBeenCalledTimes(1);
    expect(actual).toStrictEqual({
      address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      decimals: chain.nativeCurrency.decimals,
      logoUri: chain.nativeCurrency.logoUri,
      name: chain.nativeCurrency.name,
      symbol: chain.nativeCurrency.symbol,
      type: 'NATIVE_TOKEN',
      trusted: true,
    });
  });
});

describe('SwapOrderHelper.findSwapOrder', () => {
  const chainId = '11155111';
  const officialMultiSend = faker.helpers.arrayElement(
    getAllMultiSendDeployments({ chainId }),
  );
  const fakeConfigurationService = new FakeConfigurationService();
  fakeConfigurationService.set('swaps.explorerBaseUri', faker.internet.url());
  const target = new SwapOrderHelper(
    multiSendDecoder,
    new GPv2Decoder(loggingService),
    tokenRepositoryMock,
    swapsRepositoryMock,
    fakeConfigurationService,
    chainsRepositoryMock,
  );

  const randomAddress = (): Address =>
    getAddress(faker.finance.ethereumAddress());
  const orderUid = (owner: Address): Hex =>
    encodePacked(
      ['bytes32', 'address', 'uint32'],
      [
        keccak256(toBytes(faker.string.hexadecimal({ length: 64 }))),
        owner,
        faker.number.int({ min: 1, max: 2 ** 32 - 1 }),
      ],
    );

  type Call = {
    operation: number;
    to: Address;
    value: bigint;
    data: Hex;
  };

  const safeAddress = randomAddress();
  const presign = (overrides: Partial<Call> = {}, signed = true): Call => ({
    operation: Operation.CALL,
    to: GPv2OrderHelper.SettlementContractAddress,
    value: BigInt(0),
    data: setPreSignatureEncoder()
      .with('orderUid', orderUid(safeAddress))
      .with('signed', signed)
      .encode(),
    ...overrides,
  });
  const approve = (
    spender: Address = GPv2OrderHelper.VaultRelayerAddress,
  ): Call => ({
    operation: Operation.CALL,
    to: randomAddress(),
    value: BigInt(0),
    data: erc20ApproveEncoder().with('spender', spender).encode(),
  });
  const wrap = (): Call => ({
    operation: Operation.CALL,
    to: randomAddress(),
    value: faker.number.bigInt({ min: 1, max: 10n ** 18n }),
    data: encodeFunctionData({
      abi: parseAbi(['function deposit() payable']),
      functionName: 'deposit',
    }),
  });
  const nativeTransfer = (): Call => ({
    operation: Operation.CALL,
    to: randomAddress(),
    value: faker.number.bigInt({ min: 1, max: 10n ** 18n }),
    data: '0x',
  });
  const tokenTransfer = (): Call => ({
    operation: Operation.CALL,
    to: randomAddress(),
    value: BigInt(0),
    data: erc20TransferEncoder().encode(),
  });

  const single = (call: Call) => ({
    chainId,
    safeAddress,
    transaction: {
      to: call.to,
      value: call.value.toString(),
      data: call.data,
      operation: call.operation,
    },
  });
  const batch = (
    calls: Array<Call>,
    overrides: { to?: Address; operation?: Operation } = {},
  ) => ({
    chainId,
    safeAddress,
    transaction: {
      to: overrides.to ?? officialMultiSend,
      value: '0',
      data: multiSendEncoder()
        .with('transactions', multiSendTransactionsEncoder(calls))
        .encode(),
      operation: overrides.operation ?? Operation.DELEGATE,
    },
  });

  it('finds a presignature of an order owned by the Safe', () => {
    const call = presign();

    expect(target.findSwapOrder(single(call))).toStrictEqual({
      preSignature: call.data,
      approvedTokens: [],
      wrappedTokens: [],
    });
  });

  it('finds a batch of wrap, approval to the VaultRelayer and presignature', () => {
    const wrapCall = wrap();
    const approveCall = approve();
    const presignCall = presign();

    expect(
      target.findSwapOrder(batch([wrapCall, approveCall, presignCall])),
    ).toStrictEqual({
      preSignature: presignCall.data,
      approvedTokens: [approveCall.to],
      wrappedTokens: [wrapCall.to],
    });
  });

  it('ignores a transaction without a presignature', () => {
    expect(target.findSwapOrder(single(tokenTransfer()))).toBeNull();
  });

  it.each([
    ['a native transfer', nativeTransfer],
    ['a token transfer', tokenTransfer],
    ['an approval to another spender', () => approve(randomAddress())],
    ['a second presignature', () => presign()],
  ])('ignores a batch that also contains %s', (_, other) => {
    expect(target.findSwapOrder(batch([other(), presign()]))).toBeNull();
  });

  it('ignores a presignature sent to an address other than the Settlement contract', () => {
    expect(
      target.findSwapOrder(single(presign({ to: randomAddress() }))),
    ).toBeNull();
  });

  it('ignores a presignature that sends value', () => {
    expect(
      target.findSwapOrder(
        single(presign({ value: faker.number.bigInt({ min: 1 }) })),
      ),
    ).toBeNull();
  });

  it('ignores a presignature made with a delegate call', () => {
    expect(
      target.findSwapOrder(batch([presign({ operation: Operation.DELEGATE })])),
    ).toBeNull();
  });

  it('ignores a cancelled presignature', () => {
    expect(target.findSwapOrder(single(presign({}, false)))).toBeNull();
  });

  it('ignores a presignature of an order owned by another address', () => {
    const call = presign({
      data: setPreSignatureEncoder()
        .with('orderUid', orderUid(randomAddress()))
        .with('signed', true)
        .encode(),
    });

    expect(target.findSwapOrder(single(call))).toBeNull();
  });

  it('ignores a batch whose last entry is truncated', () => {
    const truncatedEntry = encodePacked(
      ['uint8', 'address', 'uint256'],
      [Operation.CALL, randomAddress(), faker.number.bigInt({ min: 1 })],
    );
    const args = batch([presign()]);
    const transactions = concat([
      multiSendTransactionsEncoder([presign()]),
      truncatedEntry,
    ]);

    expect(
      target.findSwapOrder({
        ...args,
        transaction: {
          ...args.transaction,
          data: multiSendEncoder().with('transactions', transactions).encode(),
        },
      }),
    ).toBeNull();
  });

  it('ignores a batch sent to an unofficial MultiSend', () => {
    expect(
      target.findSwapOrder(batch([presign()], { to: randomAddress() })),
    ).toBeNull();
  });

  it('ignores a batch that is not delegate called', () => {
    expect(
      target.findSwapOrder(batch([presign()], { operation: Operation.CALL })),
    ).toBeNull();
  });
});
