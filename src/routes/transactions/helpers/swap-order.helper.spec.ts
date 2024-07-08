import { SwapsRepository } from '@/domain/swaps/swaps.repository';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { GPv2Decoder } from '@/domain/swaps/contracts/decoders/gp-v2-decoder.helper';
import { faker } from '@faker-js/faker';
import { orderBuilder } from '@/domain/swaps/entities/__tests__/order.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { getAddress } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { OrderKind, OrderStatus } from '@/domain/swaps/entities/order.entity';
import { SwapOrderHelper } from '@/routes/transactions/helpers/swap-order.helper';
import { TransactionDataFinder } from '@/routes/transactions/helpers/transaction-data-finder.helper';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';

const swapsRepository = {
  getOrder: jest.fn(),
} as jest.MockedObjectDeep<SwapsRepository>;
const swapsRepositoryMock = jest.mocked(swapsRepository);

const gpv2Decoder = {
  getOrderUidFromSetPreSignature: jest.fn(),
} as jest.MockedObjectDeep<GPv2Decoder>;
const gpv2DecoderMock = jest.mocked(gpv2Decoder);

const tokenRepository = {
  getToken: jest.fn(),
} as jest.MockedObjectDeep<ITokenRepository>;

const tokenRepositoryMock = jest.mocked(tokenRepository);

const configurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;
const configurationServiceMock = jest.mocked(configurationService);

const transactionDataFinder = {} as jest.Mocked<TransactionDataFinder>;
const transactionDataFinderMock = jest.mocked(transactionDataFinder);

const chainsRepository = {
  getChain: jest.fn(),
} as jest.MockedObjectDeep<IChainsRepository>;
const chainsRepositoryMock = jest.mocked(chainsRepository);

describe('Swap Order Helper tests', () => {
  let target: SwapOrderHelper;
  const explorerBaseUrl = faker.internet.url();
  const restrictApps = false;
  const allowedApps = [faker.company.buzzNoun()];

  beforeEach(() => {
    jest.resetAllMocks();
    configurationServiceMock.getOrThrow.mockImplementation((key) => {
      if (key === 'swaps.explorerBaseUri') return explorerBaseUrl;
      if (key === 'swaps.restrictApps') return restrictApps;
      throw new Error(`Key ${key} not found.`);
    });

    target = new SwapOrderHelper(
      transactionDataFinderMock,
      gpv2DecoderMock,
      tokenRepositoryMock,
      swapsRepositoryMock,
      configurationServiceMock,
      new Set(allowedApps),
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
        order.uid as `0x${string}`,
      );
      swapsRepositoryMock.getOrder.mockResolvedValue(order);
      tokenRepositoryMock.getToken.mockImplementation(({ address }) => {
        if (address === order.buyToken) return Promise.resolve(buyToken);
        if (address === order.sellToken) return Promise.resolve(sellToken);
        return Promise.reject(new Error(`Token ${address} not found.`));
      });

      const actual = await target.getOrder({
        chainId,
        orderUid: order.uid as `0x${string}`,
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
    },
  );

  it(`should throw if repository getOrder throws an error`, async () => {
    const chainId = faker.string.numeric();
    const orderUid = faker.string.hexadecimal({ length: 112 }) as `0x${string}`;
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

  describe('Allowed Apps', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      configurationServiceMock.getOrThrow.mockImplementation((key) => {
        if (key === 'swaps.explorerBaseUri') return explorerBaseUrl;
        if (key === 'swaps.restrictApps') return true;
        throw new Error(`Key ${key} not found.`);
      });

      target = new SwapOrderHelper(
        transactionDataFinderMock,
        gpv2DecoderMock,
        tokenRepositoryMock,
        swapsRepositoryMock,
        configurationServiceMock,
        new Set(allowedApps),
        chainsRepositoryMock,
      );
    });

    it('should not allow app not in allowedApp', () => {
      const order = orderBuilder().build();

      const actual = target.isAppAllowed(order);

      expect(actual).toBe(false);
    });

    it('should allow app in allowedApps', () => {
      const order = orderBuilder()
        .with('fullAppData', { appCode: allowedApps[0] })
        .build();

      const actual = target.isAppAllowed(order);

      expect(actual).toBe(true);
    });
  });
});
