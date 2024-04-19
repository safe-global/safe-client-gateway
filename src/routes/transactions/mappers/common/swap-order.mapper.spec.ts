import { SwapOrderMapper } from '@/routes/transactions/mappers/common/swap-order.mapper';
import { SwapsRepository } from '@/domain/swaps/swaps.repository';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { SetPreSignatureDecoder } from '@/domain/swaps/contracts/decoders/set-pre-signature-decoder.helper';
import { faker } from '@faker-js/faker';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { orderBuilder } from '@/domain/swaps/entities/__tests__/order.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { getAddress } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { OrderStatus } from '@/domain/swaps/entities/order.entity';
import { SwapOrderTransactionInfo } from '@/routes/transactions/entities/swap-order-info.entity';

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

  it.each([Object.values(OrderStatus)])(
    'should map %s swap orders successfully',
    async (orderStatus) => {
      const chainId = faker.string.numeric();
      const transaction = multisigTransactionBuilder().build();
      const buyToken = tokenBuilder().build();
      const sellToken = tokenBuilder().build();
      const order = orderBuilder()
        .with('status', orderStatus)
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

      expect(result).toBeInstanceOf(SwapOrderTransactionInfo);
      expect(result).toEqual({
        type: 'SwapOrder',
        uid: order.uid,
        status: order.status,
        kind: order.kind,
        validUntil: order.validTo,
        sellAmount: order.sellAmount.toString(),
        buyAmount: order.buyAmount.toString(),
        executedSellAmount: order.executedSellAmount.toString(),
        executedBuyAmount: order.executedBuyAmount.toString(),
        sellToken: {
          address: sellToken.address,
          decimals: sellToken.decimals,
          logoUri: sellToken.logoUri,
          name: sellToken.name,
          symbol: sellToken.symbol,
          trusted: sellToken.trusted,
        },
        buyToken: {
          address: buyToken.address,
          decimals: buyToken.decimals,
          logoUri: buyToken.logoUri,
          name: buyToken.name,
          symbol: buyToken.symbol,
          trusted: buyToken.trusted,
        },
        explorerUrl: new URL(`${explorerBaseUrl}/orders/${order.uid}`),
        executedSurplusFee: order.executedSurplusFee?.toString() ?? null,
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

  it.each(Object.values(OrderStatus))(
    'should throw if %s order kind is unknown',
    async (status) => {
      const chainId = faker.string.numeric();
      const transaction = multisigTransactionBuilder().build();
      const buyToken = tokenBuilder().with('decimals', 0).build();
      const sellToken = tokenBuilder().build();
      const order = orderBuilder()
        .with('status', status)
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
});
