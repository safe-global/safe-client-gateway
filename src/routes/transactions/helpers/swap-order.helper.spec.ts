import { SwapsRepository } from '@/domain/swaps/swaps.repository';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { SetPreSignatureDecoder } from '@/domain/swaps/contracts/decoders/set-pre-signature-decoder.helper';
import { faker } from '@faker-js/faker';
import { orderBuilder } from '@/domain/swaps/entities/__tests__/order.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { getAddress } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { OrderStatus } from '@/domain/swaps/entities/order.entity';
import { SwapOrderHelper } from '@/routes/transactions/helpers/swap-order.helper';
import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';

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

const multiSendDecoder = {} as jest.Mocked<MultiSendDecoder>;
const multiSendDecoderMock = jest.mocked(multiSendDecoder);

describe('Swap Order Helper tests', () => {
  let target: SwapOrderHelper;
  const explorerBaseUrl = faker.internet.url();

  beforeEach(() => {
    jest.resetAllMocks();
    configurationServiceMock.getOrThrow.mockImplementation((key) => {
      if (key === 'swaps.explorerBaseUri') return explorerBaseUrl;
      throw new Error(`Key ${key} not found.`);
    });
    target = new SwapOrderHelper(
      multiSendDecoderMock,
      setPreSignatureDecoderMock,
      tokenRepositoryMock,
      swapsRepositoryMock,
      configurationServiceMock,
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
      setPreSignatureDecoderMock.getOrderUid.mockReturnValue(
        order.uid as `0x${string}`,
      );
      swapsRepositoryMock.getOrder.mockResolvedValue(order);
      tokenRepositoryMock.getToken.mockImplementation(({ address }) => {
        if (address === order.buyToken) return Promise.resolve(buyToken);
        if (address === order.sellToken) return Promise.resolve(sellToken);
        return Promise.reject(new Error(`Token ${address} not found.`));
      });

      const {
        order: actualOrder,
        sellToken: actualSellToken,
        buyToken: actualBuyToken,
      } = await target.getOrder({
        chainId,
        orderUid: order.uid as `0x${string}`,
      });

      expect(actualSellToken.address).toBe(actualOrder.sellToken);
      expect(actualBuyToken.address).toBe(actualOrder.buyToken);
      expect(actualOrder).toEqual({
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
        executedSurplusFee: order.executedSurplusFee,
        feeAmount: order.feeAmount,
        from: order.from,
        fullAppData: order.fullAppData,
        fullFeeAmount: order.fullFeeAmount,
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

      expect(actualSellToken).toStrictEqual({
        address: sellToken.address,
        decimals: sellToken.decimals,
        logoUri: sellToken.logoUri,
        name: sellToken.name,
        symbol: sellToken.symbol,
        trusted: sellToken.trusted,
        type: sellToken.type,
      });
      expect(actualBuyToken).toStrictEqual({
        address: buyToken.address,
        decimals: buyToken.decimals,
        logoUri: buyToken.logoUri,
        name: buyToken.name,
        symbol: buyToken.symbol,
        trusted: buyToken.trusted,
        type: buyToken.type,
      });
    },
  );

  it(`should throw if repository getOrder throws an error`, async () => {
    const chainId = faker.string.numeric();
    const orderUid = faker.string.hexadecimal({ length: 112 }) as `0x${string}`;
    const error = new Error('Order not found');
    swapsRepositoryMock.getOrder.mockRejectedValue(error);

    await expect(
      target.getOrder({
        chainId,
        orderUid: orderUid as `0x${string}`,
      }),
    ).rejects.toThrow(error);

    expect(swapsRepositoryMock.getOrder).toHaveBeenCalledTimes(1);
    expect(swapsRepositoryMock.getOrder).toHaveBeenCalledWith(
      chainId,
      expect.any(String),
    );
    expect(tokenRepositoryMock.getToken).toHaveBeenCalledTimes(0);
  });

  it('should throw if token data is not available', async () => {
    const chainId = faker.string.numeric();
    const order = orderBuilder().build();
    swapsRepositoryMock.getOrder.mockResolvedValue(order);
    tokenRepositoryMock.getToken.mockRejectedValue(
      new Error('Token not found'),
    );

    await expect(
      target.getOrder({
        chainId,
        orderUid: order.uid as `0x${string}`,
      }),
    ).rejects.toThrow('Token not found');

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
      const buyToken = tokenBuilder().with('decimals', 0).build();
      const sellToken = tokenBuilder().build();
      const order = orderBuilder()
        .with('status', status)
        .with('buyToken', getAddress(buyToken.address))
        .with('sellToken', getAddress(sellToken.address))
        .with('kind', 'unknown')
        .build();
      swapsRepositoryMock.getOrder.mockResolvedValue(order);
      tokenRepositoryMock.getToken.mockImplementation(({ address }) => {
        if (address === order.buyToken) return Promise.resolve(buyToken);
        if (address === order.sellToken) return Promise.resolve(sellToken);
        return Promise.reject(new Error(`Token ${address} not found.`));
      });

      await expect(
        target.getOrder({
          chainId,
          orderUid: order.uid as `0x${string}`,
        }),
      ).rejects.toThrow('Unknown order kind');

      expect(swapsRepositoryMock.getOrder).toHaveBeenCalledTimes(1);
      expect(swapsRepositoryMock.getOrder).toHaveBeenCalledWith(
        chainId,
        order.uid,
      );
    },
  );
});
