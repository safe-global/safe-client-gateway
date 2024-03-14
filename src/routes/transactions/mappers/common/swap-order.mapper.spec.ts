import { SwapOrderMapper } from '@/routes/transactions/mappers/common/swap-order.mapper';
import { SwapsRepository } from '@/domain/swaps/swaps.repository';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { CustomTransactionMapper } from '@/routes/transactions/mappers/common/custom-transaction.mapper';
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
import { CustomTransactionInfo } from '@/routes/transactions/entities/custom-transaction.entity';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { ILoggingService } from '@/logging/logging.interface';

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

const customTransactionMapper = {
  mapCustomTransaction: jest.fn(),
} as jest.MockedObjectDeep<CustomTransactionMapper>;

const customTransactionMapperMock = jest.mocked(customTransactionMapper);

const loggingService = {
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;
const loggingServiceMock = jest.mocked(loggingService);

function asDecimal(amount: number | bigint, decimals: number): number {
  return Number(amount) / 10 ** decimals;
}

describe('Swap Order Mapper tests', () => {
  let target: SwapOrderMapper;

  beforeEach(() => {
    jest.resetAllMocks();
    target = new SwapOrderMapper(
      swapsRepositoryMock,
      setPreSignatureDecoderMock,
      tokenRepositoryMock,
      customTransactionMapperMock,
      loggingServiceMock,
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

    const result = await target.mapSwapOrder(chainId, transaction, 0);

    const surplus = asDecimal(order.executedSurplusFee!, buyToken.decimals!);
    const expectedSurplus = `${surplus} ${buyToken.symbol}`;
    const executionRatio =
      asDecimal(order.executedSellAmount, sellToken.decimals!) /
      asDecimal(order.executedBuyAmount, buyToken.decimals!);
    const expectedExecutionPrice = `1 ${sellToken.symbol} = ${executionRatio} ${buyToken.symbol}`;
    expect(result).toBeInstanceOf(FulfilledSwapOrderTransactionInfo);
    expect(result).toEqual({
      type: 'SwapOrder',
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
      surplus: expectedSurplus,
      executionPrice: expectedExecutionPrice,
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

      const result = await target.mapSwapOrder(chainId, transaction, 0);

      const ratio =
        asDecimal(order.sellAmount, sellToken.decimals!) /
        asDecimal(order.buyAmount, buyToken.decimals!);
      const expectedLimitPriceDescription = `1 ${sellToken.symbol} = ${ratio} ${buyToken.symbol}`;
      expect(result).toBeInstanceOf(DefaultSwapOrderTransactionInfo);
      expect(result).toEqual({
        type: 'SwapOrder',
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
        limitPriceDescription: expectedLimitPriceDescription,
        humanDescription: null,
        richDecodedInfo: null,
      });
    },
  );

  it(`should map to custom order if getOrder throws an error`, async () => {
    const chainId = faker.string.numeric();
    const transaction = multisigTransactionBuilder().build();
    const dataSize = 0;
    const orderUid = faker.string.hexadecimal({ length: 112 }) as `0x${string}`;
    setPreSignatureDecoderMock.getOrderUid.mockReturnValue(orderUid);
    swapsRepositoryMock.getOrder.mockRejectedValue(
      new Error('Order not found'),
    );
    const customTransaction = new CustomTransactionInfo(
      new AddressInfo(faker.finance.ethereumAddress()),
      dataSize.toString(),
      transaction.value,
      null,
      null,
      false,
      null,
      null,
    );
    customTransactionMapperMock.mapCustomTransaction.mockResolvedValue(
      customTransaction,
    );

    const result = await target.mapSwapOrder(chainId, transaction, dataSize);

    expect(result).toBe(customTransaction);
    expect(setPreSignatureDecoderMock.getOrderUid).toHaveBeenCalledTimes(1);
    expect(setPreSignatureDecoderMock.getOrderUid).toHaveBeenCalledWith(
      transaction.data,
    );
    expect(swapsRepositoryMock.getOrder).toHaveBeenCalledTimes(1);
    expect(swapsRepositoryMock.getOrder).toHaveBeenCalledWith(
      chainId,
      expect.any(String),
    );
    expect(
      customTransactionMapperMock.mapCustomTransaction,
    ).toHaveBeenCalledTimes(1);
    expect(
      customTransactionMapperMock.mapCustomTransaction,
    ).toHaveBeenCalledWith(transaction, dataSize, chainId, null, null);
  });

  it('should map to custom order if transaction data is null', async () => {
    const chainId = faker.string.numeric();
    const transaction = multisigTransactionBuilder().with('data', null).build();
    const dataSize = 0;
    const customTransaction = new CustomTransactionInfo(
      new AddressInfo(faker.finance.ethereumAddress()),
      dataSize.toString(),
      transaction.value,
      null,
      null,
      false,
      null,
      null,
    );
    customTransactionMapperMock.mapCustomTransaction.mockResolvedValue(
      customTransaction,
    );

    const result = await target.mapSwapOrder(chainId, transaction, dataSize);

    expect(result).toBe(customTransaction);
    expect(
      customTransactionMapperMock.mapCustomTransaction,
    ).toHaveBeenCalledTimes(1);
    expect(
      customTransactionMapperMock.mapCustomTransaction,
    ).toHaveBeenCalledWith(transaction, dataSize, chainId, null, null);
    expect(setPreSignatureDecoderMock.getOrderUid).toHaveBeenCalledTimes(0);
    expect(swapsRepositoryMock.getOrder).toHaveBeenCalledTimes(0);
  });

  it(`should map to custom transaction if order id is null`, async () => {
    const chainId = faker.string.numeric();
    const transaction = multisigTransactionBuilder().build();
    const dataSize = 0;
    setPreSignatureDecoderMock.getOrderUid.mockReturnValue(null);
    const customTransaction = new CustomTransactionInfo(
      new AddressInfo(faker.finance.ethereumAddress()),
      dataSize.toString(),
      transaction.value,
      null,
      null,
      false,
      null,
      null,
    );
    setPreSignatureDecoderMock.getOrderUid.mockReturnValue(null);
    customTransactionMapperMock.mapCustomTransaction.mockResolvedValue(
      customTransaction,
    );

    const result = await target.mapSwapOrder(chainId, transaction, dataSize);

    expect(result).toBe(customTransaction);
    expect(setPreSignatureDecoderMock.getOrderUid).toHaveBeenCalledTimes(1);
    expect(setPreSignatureDecoderMock.getOrderUid).toHaveBeenCalledWith(
      transaction.data,
    );
    expect(swapsRepositoryMock.getOrder).toHaveBeenCalledTimes(0);
    expect(
      customTransactionMapperMock.mapCustomTransaction,
    ).toHaveBeenCalledTimes(1);
    expect(
      customTransactionMapperMock.mapCustomTransaction,
    ).toHaveBeenCalledWith(transaction, dataSize, chainId, null, null);
  });

  it('should map to custom transaction if token data is not available', async () => {
    const chainId = faker.string.numeric();
    const transaction = multisigTransactionBuilder().build();
    const dataSize = 0;
    const order = orderBuilder().build();
    setPreSignatureDecoderMock.getOrderUid.mockReturnValue(
      order.uid as `0x${string}`,
    );
    const customTransaction = new CustomTransactionInfo(
      new AddressInfo(faker.finance.ethereumAddress()),
      dataSize.toString(),
      transaction.value,
      null,
      null,
      false,
      null,
      null,
    );
    customTransactionMapperMock.mapCustomTransaction.mockResolvedValue(
      customTransaction,
    );
    tokenRepositoryMock.getToken.mockRejectedValue(
      new Error('Token not found'),
    );
    swapsRepositoryMock.getOrder.mockResolvedValue(order);

    const result = await target.mapSwapOrder(chainId, transaction, dataSize);

    expect(result).toBe(customTransaction);
    expect(setPreSignatureDecoderMock.getOrderUid).toHaveBeenCalledTimes(1);
    expect(setPreSignatureDecoderMock.getOrderUid).toHaveBeenCalledWith(
      transaction.data,
    );
    expect(swapsRepositoryMock.getOrder).toHaveBeenCalledTimes(1);
    expect(swapsRepositoryMock.getOrder).toHaveBeenCalledWith(
      chainId,
      order.uid,
    );
    expect(
      customTransactionMapperMock.mapCustomTransaction,
    ).toHaveBeenCalledTimes(1);
    expect(
      customTransactionMapperMock.mapCustomTransaction,
    ).toHaveBeenCalledWith(transaction, dataSize, chainId, null, null);
  });

  it.each(['fulfilled', 'open', 'cancelled', 'expired'])(
    'should map to custom transaction if order kind is unknown',
    async (status) => {
      const chainId = faker.string.numeric();
      const transaction = multisigTransactionBuilder().build();
      const dataSize = 0;
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
      const customTransaction = new CustomTransactionInfo(
        new AddressInfo(faker.finance.ethereumAddress()),
        dataSize.toString(),
        transaction.value,
        null,
        null,
        false,
        null,
        null,
      );
      customTransactionMapperMock.mapCustomTransaction.mockResolvedValue(
        customTransaction,
      );

      const result = await target.mapSwapOrder(chainId, transaction, dataSize);

      expect(result).toBe(customTransaction);
      expect(setPreSignatureDecoderMock.getOrderUid).toHaveBeenCalledTimes(1);
      expect(setPreSignatureDecoderMock.getOrderUid).toHaveBeenCalledWith(
        transaction.data,
      );
      expect(swapsRepositoryMock.getOrder).toHaveBeenCalledTimes(1);
      expect(swapsRepositoryMock.getOrder).toHaveBeenCalledWith(
        chainId,
        order.uid,
      );
      expect(
        customTransactionMapperMock.mapCustomTransaction,
      ).toHaveBeenCalledTimes(1);
      expect(
        customTransactionMapperMock.mapCustomTransaction,
      ).toHaveBeenCalledWith(transaction, dataSize, chainId, null, null);
    },
  );
});
