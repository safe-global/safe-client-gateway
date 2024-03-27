import { SwapOrderMapper } from '@/routes/transactions/mappers/common/swap-order.mapper';
import { SwapsRepository } from '@/domain/swaps/swaps.repository';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { SetPreSignatureDecoder } from '@/domain/swaps/contracts/decoders/set-pre-signature-decoder.helper';
import { faker } from '@faker-js/faker';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { orderBuilder } from '@/domain/swaps/entities/__tests__/order.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import {
  DefaultSwapOrderTransactionInfo,
  FulfilledSwapOrderTransactionInfo,
} from '@/routes/transactions/entities/swap-order-info.entity';
import { getAddress } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';

const swapsRepository = {
  getOrder: jest.fn(),
} as jest.MockedObjectDeep<SwapsRepository>;
const swapsRepositoryMock = jest.mocked(swapsRepository);

const setPreSignatureDecoder = {
  getOrderUid: jest.fn(),
} as jest.MockedObjectDeep<SetPreSignatureDecoder>;
const setPreSignatureDecoderMock = jest.mocked(setPreSignatureDecoder);

const tokenRepository = {
  getToken: jest.fn(),
} as jest.MockedObjectDeep<ITokenRepository>;

const tokenRepositoryMock = jest.mocked(tokenRepository);

const configurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;
const configurationServiceMock = jest.mocked(configurationService);

function asDecimal(amount: number | bigint, decimals: number): number {
  return Number(amount) / 10 ** decimals;
}

describe('Swap Order Mapper tests', () => {
  let target: SwapOrderMapper;
  const explorerBaseUrl = faker.internet.url();

  beforeEach(() => {
    jest.resetAllMocks();
    configurationServiceMock.getOrThrow.mockImplementation((key) => {
      if (key === 'swaps.explorerBaseUri') return explorerBaseUrl;
      throw new Error(`Key ${key} not found.`);
    });
    target = new SwapOrderMapper(
      swapsRepositoryMock,
      setPreSignatureDecoderMock,
      tokenRepositoryMock,
      configurationServiceMock,
    );
  });

  it('should map fulfilled swap orders successfully', async () => {
    const chainId = faker.string.numeric();
    const transaction = multisigTransactionBuilder().build();
    const buyToken = tokenBuilder().with('decimals', 0).build();
    const sellToken = tokenBuilder().build();
    const order = orderBuilder()
      .with('status', 'fulfilled')
      .with('buyToken', getAddress(buyToken.address))
      .with('sellToken', getAddress(sellToken.address))
      .with('executedSurplusFee', faker.number.bigInt())
      .build();
    setPreSignatureDecoderMock.getOrderUid.mockReturnValue(
      order.uid as `0x${string}`,
    );
    swapsRepositoryMock.getOrder.mockResolvedValue(order);
    tokenRepositoryMock.getToken.mockImplementation(({ address }) => {
      if (address === order.buyToken) return Promise.resolve(buyToken);
      if (address === order.sellToken) return Promise.resolve(sellToken);
      return Promise.reject(new Error(`Token ${address} not found.`));
    });

    const result = await target.mapSwapOrder(chainId, {
      data: transaction.data as `0x${string}`,
    });

    const surplus = asDecimal(order.executedSurplusFee!, buyToken.decimals!);
    const expectedSurplus = `${surplus} ${buyToken.symbol}`;
    const executionRatio =
      asDecimal(order.executedSellAmount, sellToken.decimals!) /
      asDecimal(order.executedBuyAmount, buyToken.decimals!);
    const expectedExecutionPrice = `1 ${sellToken.symbol} = ${executionRatio} ${buyToken.symbol}`;
    expect(result).toBeInstanceOf(FulfilledSwapOrderTransactionInfo);
    expect(result).toEqual({
      type: 'SwapOrder',
      orderUid: order.uid,
      status: 'fulfilled',
      orderKind: order.kind,
      sellToken: {
        amount: `${asDecimal(order.sellAmount, sellToken.decimals!)}`,
        logo: sellToken.logoUri,
        symbol: sellToken.symbol,
      },
      buyToken: {
        amount: `${asDecimal(order.buyAmount, buyToken.decimals!)}`,
        logo: buyToken.logoUri,
        symbol: buyToken.symbol,
      },
      expiresTimestamp: order.validTo,
      filledPercentage: expect.any(String),
      explorerUrl: new URL(`${explorerBaseUrl}/orders/${order.uid}`),
      surplusLabel: expectedSurplus,
      executionPriceLabel: expectedExecutionPrice,
      humanDescription: null,
      richDecodedInfo: null,
    });
  });

  it.each(['open', 'cancelled', 'expired'])(
    'should map %s swap orders successfully',
    async (orderStatus) => {
      const chainId = faker.string.numeric();
      const transaction = multisigTransactionBuilder().build();
      const buyToken = tokenBuilder().with('decimals', 0).build();
      const sellToken = tokenBuilder().build();
      const order = orderBuilder()
        .with('status', orderStatus as 'open' | 'cancelled' | 'expired')
        .with('buyToken', getAddress(buyToken.address))
        .with('sellToken', getAddress(sellToken.address))
        .build();
      setPreSignatureDecoderMock.getOrderUid.mockReturnValue(
        order.uid as `0x${string}`,
      );
      swapsRepositoryMock.getOrder.mockResolvedValue(order);
      tokenRepositoryMock.getToken.mockImplementation(({ address }) => {
        if (address === order.buyToken) return Promise.resolve(buyToken);
        if (address === order.sellToken) return Promise.resolve(sellToken);
        return Promise.reject(new Error(`Token ${address} not found.`));
      });

      const result = await target.mapSwapOrder(chainId, {
        data: transaction.data as `0x${string}`,
      });

      const ratio =
        asDecimal(order.sellAmount, sellToken.decimals!) /
        asDecimal(order.buyAmount, buyToken.decimals!);
      const expectedLimitPriceDescription = `1 ${sellToken.symbol} = ${ratio} ${buyToken.symbol}`;
      expect(result).toBeInstanceOf(DefaultSwapOrderTransactionInfo);
      expect(result).toEqual({
        type: 'SwapOrder',
        orderUid: order.uid,
        status: order.status,
        orderKind: order.kind,
        sellToken: {
          amount: `${asDecimal(order.sellAmount, sellToken.decimals!)}`,
          logo: sellToken.logoUri,
          symbol: sellToken.symbol,
        },
        buyToken: {
          amount: `${asDecimal(order.buyAmount, buyToken.decimals!)}`,
          logo: buyToken.logoUri,
          symbol: buyToken.symbol,
        },
        expiresTimestamp: order.validTo,
        filledPercentage: expect.any(String),
        limitPriceLabel: expectedLimitPriceDescription,
        explorerUrl: new URL(`${explorerBaseUrl}/orders/${order.uid}`),
        humanDescription: null,
        richDecodedInfo: null,
      });
    },
  );

  it(`should throw if getOrder throws an error`, async () => {
    const chainId = faker.string.numeric();
    const transaction = multisigTransactionBuilder().build();
    const orderUid = faker.string.hexadecimal({ length: 112 }) as `0x${string}`;
    setPreSignatureDecoderMock.getOrderUid.mockReturnValue(orderUid);
    const error = new Error('Order not found');
    swapsRepositoryMock.getOrder.mockRejectedValue(error);

    await expect(
      target.mapSwapOrder(chainId, {
        data: transaction.data as `0x${string}`,
      }),
    ).rejects.toThrow(error);

    expect(setPreSignatureDecoderMock.getOrderUid).toHaveBeenCalledTimes(1);
    expect(setPreSignatureDecoderMock.getOrderUid).toHaveBeenCalledWith(
      transaction.data,
    );
    expect(swapsRepositoryMock.getOrder).toHaveBeenCalledTimes(1);
    expect(swapsRepositoryMock.getOrder).toHaveBeenCalledWith(
      chainId,
      expect.any(String),
    );
  });

  it(`should throw if order id is null`, async () => {
    const chainId = faker.string.numeric();
    const transaction = multisigTransactionBuilder().build();
    setPreSignatureDecoderMock.getOrderUid.mockReturnValue(null);

    await expect(
      target.mapSwapOrder(chainId, {
        data: transaction.data as `0x${string}`,
      }),
    ).rejects.toThrow('Order UID not found in transaction data');

    expect(setPreSignatureDecoderMock.getOrderUid).toHaveBeenCalledTimes(1);
    expect(setPreSignatureDecoderMock.getOrderUid).toHaveBeenCalledWith(
      transaction.data,
    );
    expect(swapsRepositoryMock.getOrder).toHaveBeenCalledTimes(0);
  });

  it('should throw if token data is not available', async () => {
    const chainId = faker.string.numeric();
    const transaction = multisigTransactionBuilder().build();
    const order = orderBuilder().build();
    setPreSignatureDecoderMock.getOrderUid.mockReturnValue(
      order.uid as `0x${string}`,
    );
    tokenRepositoryMock.getToken.mockRejectedValue(
      new Error('Token not found'),
    );
    swapsRepositoryMock.getOrder.mockResolvedValue(order);

    await expect(
      target.mapSwapOrder(chainId, {
        data: transaction.data as `0x${string}`,
      }),
    ).rejects.toThrow('Token not found');

    expect(setPreSignatureDecoderMock.getOrderUid).toHaveBeenCalledTimes(1);
    expect(setPreSignatureDecoderMock.getOrderUid).toHaveBeenCalledWith(
      transaction.data,
    );
    expect(swapsRepositoryMock.getOrder).toHaveBeenCalledTimes(1);
    expect(swapsRepositoryMock.getOrder).toHaveBeenCalledWith(
      chainId,
      order.uid,
    );
  });

  it.each(['fulfilled', 'open', 'cancelled', 'expired'])(
    'should throw if %s order kind is unknown',
    async (status) => {
      const chainId = faker.string.numeric();
      const transaction = multisigTransactionBuilder().build();
      const buyToken = tokenBuilder().with('decimals', 0).build();
      const sellToken = tokenBuilder().build();
      const order = orderBuilder()
        .with(
          'status',
          status as 'fulfilled' | 'open' | 'cancelled' | 'expired',
        )
        .with('buyToken', getAddress(buyToken.address))
        .with('sellToken', getAddress(sellToken.address))
        .with('kind', 'unknown')
        .build();
      setPreSignatureDecoderMock.getOrderUid.mockReturnValue(
        order.uid as `0x${string}`,
      );
      swapsRepositoryMock.getOrder.mockResolvedValue(order);
      tokenRepositoryMock.getToken.mockImplementation(({ address }) => {
        if (address === order.buyToken) return Promise.resolve(buyToken);
        if (address === order.sellToken) return Promise.resolve(sellToken);
        return Promise.reject(new Error(`Token ${address} not found.`));
      });

      await expect(
        target.mapSwapOrder(chainId, {
          data: transaction.data as `0x${string}`,
        }),
      ).rejects.toThrow('Unknown order kind');

      expect(setPreSignatureDecoderMock.getOrderUid).toHaveBeenCalledTimes(1);
      expect(setPreSignatureDecoderMock.getOrderUid).toHaveBeenCalledWith(
        transaction.data,
      );
      expect(swapsRepositoryMock.getOrder).toHaveBeenCalledTimes(1);
      expect(swapsRepositoryMock.getOrder).toHaveBeenCalledWith(
        chainId,
        order.uid,
      );
    },
  );

  it.each([
    // [executedAmount, amount, expectedFilledPercentage]
    [1000, 1000, '100.00'],
    [0, 1000, '0.00'],
    [500, 1000, '50.00'],
    [350, 1050, '33.33'],
  ])(
    'should calculate the filled percentage correctly for buy orders',
    async (executedAmount, amount, expected) => {
      const chainId = faker.string.numeric();
      const transaction = multisigTransactionBuilder().build();
      const buyToken = tokenBuilder().with('decimals', 0).build();
      const sellToken = tokenBuilder().build();
      const order = orderBuilder()
        .with(
          'status',
          faker.helpers.arrayElement([
            'open',
            'fulfilled',
            'cancelled',
            'expired',
          ]),
        )
        .build();
      if (order.kind === 'buy') {
        order['executedBuyAmount'] = BigInt(executedAmount);
        order['buyAmount'] = BigInt(amount);
      } else if (order.kind === 'sell') {
        order['executedSellAmount'] = BigInt(executedAmount);
        order['sellAmount'] = BigInt(amount);
      } else {
        throw new Error('Invalid order kind');
      }
      setPreSignatureDecoderMock.getOrderUid.mockReturnValue(
        order.uid as `0x${string}`,
      );
      swapsRepositoryMock.getOrder.mockResolvedValue(order);
      tokenRepositoryMock.getToken.mockImplementation(({ address }) => {
        if (address === order.buyToken) return Promise.resolve(buyToken);
        if (address === order.sellToken) return Promise.resolve(sellToken);
        return Promise.reject(new Error(`Token ${address} not found.`));
      });

      const result = await target.mapSwapOrder(chainId, {
        data: transaction.data as `0x${string}`,
      });

      expect(result).toMatchObject({
        filledPercentage: expected,
      });
    },
  );
});
