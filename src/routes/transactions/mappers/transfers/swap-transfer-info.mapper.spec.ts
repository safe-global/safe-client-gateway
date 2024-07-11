import { erc20TransferBuilder } from '@/domain/safe/entities/__tests__/erc20-transfer.builder';
import { orderBuilder } from '@/domain/swaps/entities/__tests__/order.builder';
import { OrdersSchema } from '@/domain/swaps/entities/order.entity';
import { ISwapsRepository } from '@/domain/swaps/swaps.repository';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { addressInfoBuilder } from '@/routes/common/__tests__/entities/address-info.builder';
import { TransferDirection } from '@/routes/transactions/entities/transfer-transaction-info.entity';
import { Erc20Transfer } from '@/routes/transactions/entities/transfers/erc20-transfer.entity';
import { SwapAppsHelper } from '@/routes/transactions/helpers/swap-apps.helper';
import { SwapOrderHelper } from '@/routes/transactions/helpers/swap-order.helper';
import { getTransferDirection } from '@/routes/transactions/mappers/common/transfer-direction.helper';
import { SwapTransferInfoMapper } from '@/routes/transactions/mappers/transfers/swap-transfer-info.mapper';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

const mockSwapOrderHelper = jest.mocked({
  getToken: jest.fn(),
  getOrderExplorerUrl: jest.fn(),
} as jest.MockedObjectDeep<SwapOrderHelper>);

const mockSwapsRepository = jest.mocked({
  getOrders: jest.fn(),
} as jest.MockedObjectDeep<ISwapsRepository>);

const mockSwapAppsHelper = jest.mocked({
  isAppAllowed: jest.fn(),
} as jest.MockedObjectDeep<SwapAppsHelper>);

describe('SwapTransferInfoMapper', () => {
  let target: SwapTransferInfoMapper;

  const GPv2SettlementAddress = '0x9008D19f58AAbD9eD0D60971565AA8510560ab41';

  beforeEach(() => {
    jest.resetAllMocks();

    target = new SwapTransferInfoMapper(
      mockSwapOrderHelper,
      mockSwapsRepository,
      mockSwapAppsHelper,
    );
  });

  it('it throws if nether the sender and recipient are from the GPv2Settlement contract', async () => {
    const sender = addressInfoBuilder().build();
    const recipient = addressInfoBuilder().build();
    const direction = faker.helpers.arrayElement(
      Object.values(TransferDirection),
    );
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const domainTransfer = erc20TransferBuilder()
      .with('from', getAddress(sender.value))
      .with('to', getAddress(recipient.value))
      .build();
    const token = tokenBuilder()
      .with('address', domainTransfer.tokenAddress)
      .build();
    const transferInfo = new Erc20Transfer(
      token.address,
      domainTransfer.value,
      token.name,
      token.symbol,
      token.logoUri,
      token.decimals,
      token.trusted,
    );
    const order = orderBuilder().with('from', getAddress(sender.value)).build();
    mockSwapsRepository.getOrders.mockResolvedValue([order]);

    await expect(
      target.mapSwapTransferInfo({
        sender,
        recipient,
        direction,
        chainId,
        safeAddress,
        transferInfo,
        domainTransfer,
      }),
    ).rejects.toThrow('Neither sender nor receiver are settlement contract');
  });

  it('maps the SwapTransferTransactionInfo if the sender is the GPv2Settlement contract', async () => {
    const sender = addressInfoBuilder()
      .with('value', GPv2SettlementAddress)
      .build();
    const recipient = addressInfoBuilder().build();
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const direction = getTransferDirection(
      safeAddress,
      sender.value,
      recipient.value,
    );
    const domainTransfer = erc20TransferBuilder()
      .with('from', getAddress(sender.value))
      .with('to', getAddress(recipient.value))
      .build();
    const token = tokenBuilder()
      .with('address', domainTransfer.tokenAddress)
      .build();
    const transferInfo = new Erc20Transfer(
      token.address,
      domainTransfer.value,
      token.name,
      token.symbol,
      token.logoUri,
      token.decimals,
      token.trusted,
    );
    const order = orderBuilder()
      .with('from', getAddress(sender.value))
      .with('owner', safeAddress)
      .with('buyToken', token.address)
      .with('executedBuyAmount', BigInt(domainTransfer.value))
      .build();
    const explorerUrl = faker.internet.url({ appendSlash: true });
    mockSwapsRepository.getOrders.mockResolvedValue([order]);
    mockSwapOrderHelper.getToken.mockResolvedValue({
      ...token,
      decimals: token.decimals!,
    });
    mockSwapOrderHelper.getOrderExplorerUrl.mockReturnValue(
      new URL(explorerUrl),
    );
    mockSwapAppsHelper.isAppAllowed.mockReturnValue(true);

    const actual = await target.mapSwapTransferInfo({
      sender,
      recipient,
      direction,
      chainId,
      safeAddress,
      transferInfo,
      domainTransfer,
    });

    expect(actual).toEqual({
      buyAmount: order.buyAmount.toString(),
      buyToken: token,
      direction: 'UNKNOWN',
      executedBuyAmount: order.executedBuyAmount.toString(),
      executedSellAmount: order.executedSellAmount.toString(),
      executedSurplusFee: order.executedSurplusFee?.toString() ?? null,
      explorerUrl,
      fullAppData: order.fullAppData,
      humanDescription: null,
      kind: order.kind,
      orderClass: order.class,
      owner: safeAddress,
      receiver: order.receiver,
      recipient,
      richDecodedInfo: null,
      sellAmount: order.sellAmount.toString(),
      sellToken: token,
      sender,
      status: order.status,
      transferInfo,
      type: 'SwapTransfer',
      uid: order.uid,
      validUntil: order.validTo,
    });
  });

  it('maps the SwapTransferTransactionInfo if the recipient is the GPv2Settlement contract', async () => {
    const sender = addressInfoBuilder().build();
    const recipient = addressInfoBuilder()
      .with('value', GPv2SettlementAddress)
      .build();
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const direction = getTransferDirection(
      safeAddress,
      sender.value,
      recipient.value,
    );
    const domainTransfer = erc20TransferBuilder()
      .with('from', getAddress(sender.value))
      .with('to', getAddress(recipient.value))
      .build();
    const token = tokenBuilder()
      .with('address', domainTransfer.tokenAddress)
      .build();
    const transferInfo = new Erc20Transfer(
      token.address,
      domainTransfer.value,
      token.name,
      token.symbol,
      token.logoUri,
      token.decimals,
      token.trusted,
    );
    const order = orderBuilder()
      .with('from', getAddress(sender.value))
      .with('owner', safeAddress)
      .with('buyToken', domainTransfer.tokenAddress)
      .with('executedBuyAmount', BigInt(domainTransfer.value))
      .build();
    const explorerUrl = faker.internet.url({ appendSlash: true });
    mockSwapsRepository.getOrders.mockResolvedValue([order]);
    mockSwapOrderHelper.getToken.mockResolvedValue({
      ...token,
      decimals: token.decimals!,
    });
    mockSwapOrderHelper.getOrderExplorerUrl.mockReturnValue(
      new URL(explorerUrl),
    );
    mockSwapAppsHelper.isAppAllowed.mockReturnValue(true);

    const actual = await target.mapSwapTransferInfo({
      sender,
      recipient,
      direction,
      chainId,
      safeAddress,
      transferInfo,
      domainTransfer,
    });

    expect(actual).toEqual({
      buyAmount: order.buyAmount.toString(),
      buyToken: token,
      direction: 'UNKNOWN',
      executedBuyAmount: order.executedBuyAmount.toString(),
      executedSellAmount: order.executedSellAmount.toString(),
      executedSurplusFee: order.executedSurplusFee?.toString() ?? null,
      explorerUrl,
      fullAppData: order.fullAppData,
      humanDescription: null,
      kind: order.kind,
      orderClass: order.class,
      owner: safeAddress,
      receiver: order.receiver,
      recipient,
      richDecodedInfo: null,
      sellAmount: order.sellAmount.toString(),
      sellToken: token,
      sender,
      status: order.status,
      transferInfo,
      type: 'SwapTransfer',
      uid: order.uid,
      validUntil: order.validTo,
    });
  });

  it('maps the correct order if it was executed in a batch', async () => {
    /**
     * https://api.cow.fi/mainnet/api/v1/transactions/0x22fe458f3a70aaf83d42af2040f3b98404526b4ca588624e158c4b1f287ced8c/orders
     */
    const _orders = [
      {
        creationDate: '2024-06-25T12:16:09.646330Z',
        owner: '0x6ecba7527448bb56caba8ca7768d271deaea72a9',
        uid: '0x0229aadcaf2d06d0ccacca0d7739c9e531e89605c61ac5883252c1f3612761ce6ecba7527448bb56caba8ca7768d271deaea72a9667abc04',
        availableBalance: null,
        executedBuyAmount: '3824530054984182297195399559',
        executedSellAmount: '5555000000',
        executedSellAmountBeforeFees: '5555000000',
        executedFeeAmount: '0',
        executedSurplusFee: '5012654',
        invalidated: false,
        status: 'fulfilled',
        class: 'limit',
        settlementContract: '0x9008d19f58aabd9ed0d60971565aa8510560ab41',
        fullFeeAmount: '0',
        solverFee: '0',
        isLiquidityOrder: false,
        fullAppData:
          '{"appCode":"CoW Swap","environment":"production","metadata":{"orderClass":{"orderClass":"market"},"quote":{"slippageBips":50},"utm":{"utmContent":"header-cta-button","utmMedium":"web","utmSource":"cow.fi"}},"version":"1.1.0"}',
        sellToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        buyToken: '0xaaee1a9723aadb7afa2810263653a34ba2c21c7a',
        receiver: '0x6ecba7527448bb56caba8ca7768d271deaea72a9',
        sellAmount: '5555000000',
        buyAmount: '3807681190768269801973105790',
        validTo: 1719319556,
        appData:
          '0x831ef45ca746d6d67482ba7ad19af3ed3d29da441d869cbf1fa8ea6dec3ebc1f',
        feeAmount: '0',
        kind: 'sell',
        partiallyFillable: false,
        sellTokenBalance: 'erc20',
        buyTokenBalance: 'erc20',
        signingScheme: 'eip712',
        signature:
          '0x6904193a1483813d7921585493b7e1a295476c12c9b6e08a430b726ae9a4e05660e309c430e21edcb5b7156e80291510159e1a4c39b736471f6bd4c131231b8c1b',
        interactions: { pre: [], post: [] },
      },
      {
        creationDate: '2024-06-25T12:15:26.924920Z',
        owner: '0x6ecba7527448bb56caba8ca7768d271deaea72a9',
        uid: '0xaaa1348fc7572d408097d069268db0ecb727ead6b525614999f983d5c5f1c1fb6ecba7527448bb56caba8ca7768d271deaea72a9667abbdc',
        availableBalance: null,
        executedBuyAmount: '6990751494894782668981616',
        executedSellAmount: '3000000000',
        executedSellAmountBeforeFees: '3000000000',
        executedFeeAmount: '0',
        executedSurplusFee: '4290918',
        invalidated: false,
        status: 'fulfilled',
        class: 'limit',
        settlementContract: '0x9008d19f58aabd9ed0d60971565aa8510560ab41',
        fullFeeAmount: '0',
        solverFee: '0',
        isLiquidityOrder: false,
        fullAppData:
          '{"appCode":"CoW Swap","environment":"production","metadata":{"orderClass":{"orderClass":"market"},"quote":{"slippageBips":50},"utm":{"utmContent":"header-cta-button","utmMedium":"web","utmSource":"cow.fi"}},"version":"1.1.0"}',
        sellToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        buyToken: '0x594daad7d77592a2b97b725a7ad59d7e188b5bfa',
        receiver: '0x6ecba7527448bb56caba8ca7768d271deaea72a9',
        sellAmount: '3000000000',
        buyAmount: '6961165527651189129024639',
        validTo: 1719319516,
        appData:
          '0x831ef45ca746d6d67482ba7ad19af3ed3d29da441d869cbf1fa8ea6dec3ebc1f',
        feeAmount: '0',
        kind: 'sell',
        partiallyFillable: false,
        sellTokenBalance: 'erc20',
        buyTokenBalance: 'erc20',
        signingScheme: 'eip712',
        signature:
          '0x18c6ea08a69ea97a3a1216038547ccb76c734b6ebc6b216cde32b68f8c2fb0c63c3223b056d2caf5dd0ff440b65821452ec84489b4edff00cbd419058a364e3f1c',
        interactions: { pre: [], post: [] },
      },
    ];

    // In order to appease TypeScript, we parse the data
    const orders = OrdersSchema.parse(_orders);

    const safeAddress = orders[0].owner;
    const sender = addressInfoBuilder().with('value', safeAddress).build();
    const recipient = addressInfoBuilder()
      .with('value', GPv2SettlementAddress)
      .build();
    const chainId = faker.string.numeric();
    const direction = getTransferDirection(
      safeAddress,
      sender.value,
      recipient.value,
    );
    const domainTransfer = erc20TransferBuilder()
      .with('from', getAddress(sender.value))
      .with('to', getAddress(recipient.value))
      .with('value', orders[0].executedSellAmount.toString())
      .with('tokenAddress', orders[0].sellToken)
      .build();
    const token = tokenBuilder()
      .with('address', domainTransfer.tokenAddress)
      .build();
    const transferInfo = new Erc20Transfer(
      token.address,
      domainTransfer.value,
      token.name,
      token.symbol,
      token.logoUri,
      token.decimals,
      token.trusted,
    );
    const explorerUrl = faker.internet.url({ appendSlash: true });
    mockSwapsRepository.getOrders.mockResolvedValue(orders);
    mockSwapOrderHelper.getToken.mockResolvedValue({
      ...token,
      decimals: token.decimals!,
    });
    mockSwapOrderHelper.getOrderExplorerUrl.mockReturnValue(
      new URL(explorerUrl),
    );
    mockSwapAppsHelper.isAppAllowed.mockReturnValue(true);

    const actual = await target.mapSwapTransferInfo({
      sender,
      recipient,
      direction,
      chainId,
      safeAddress,
      transferInfo,
      domainTransfer,
    });

    expect(actual).toEqual({
      buyAmount: orders[0].buyAmount.toString(),
      buyToken: token,
      direction: 'OUTGOING',
      executedBuyAmount: orders[0].executedBuyAmount.toString(),
      executedSellAmount: orders[0].executedSellAmount.toString(),
      executedSurplusFee: orders[0].executedSurplusFee?.toString() ?? null,
      explorerUrl,
      fullAppData: orders[0].fullAppData,
      humanDescription: null,
      kind: orders[0].kind,
      orderClass: orders[0].class,
      owner: orders[0].owner,
      receiver: orders[0].receiver,
      recipient,
      richDecodedInfo: null,
      sellAmount: orders[0].sellAmount.toString(),
      sellToken: token,
      sender,
      status: orders[0].status,
      transferInfo,
      type: 'SwapTransfer',
      uid: orders[0].uid,
      validUntil: orders[0].validTo,
    });
  });

  it('should throw if the app is not allowed', async () => {
    /**
     * https://api.cow.fi/mainnet/api/v1/transactions/0x22fe458f3a70aaf83d42af2040f3b98404526b4ca588624e158c4b1f287ced8c/orders
     */
    const _orders = [
      {
        creationDate: '2024-06-25T12:16:09.646330Z',
        owner: '0x6ecba7527448bb56caba8ca7768d271deaea72a9',
        uid: '0x0229aadcaf2d06d0ccacca0d7739c9e531e89605c61ac5883252c1f3612761ce6ecba7527448bb56caba8ca7768d271deaea72a9667abc04',
        availableBalance: null,
        executedBuyAmount: '3824530054984182297195399559',
        executedSellAmount: '5555000000',
        executedSellAmountBeforeFees: '5555000000',
        executedFeeAmount: '0',
        executedSurplusFee: '5012654',
        invalidated: false,
        status: 'fulfilled',
        class: 'limit',
        settlementContract: '0x9008d19f58aabd9ed0d60971565aa8510560ab41',
        fullFeeAmount: '0',
        solverFee: '0',
        isLiquidityOrder: false,
        fullAppData:
          '{"appCode":"CoW Swap","environment":"production","metadata":{"orderClass":{"orderClass":"market"},"quote":{"slippageBips":50},"utm":{"utmContent":"header-cta-button","utmMedium":"web","utmSource":"cow.fi"}},"version":"1.1.0"}',
        sellToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        buyToken: '0xaaee1a9723aadb7afa2810263653a34ba2c21c7a',
        receiver: '0x6ecba7527448bb56caba8ca7768d271deaea72a9',
        sellAmount: '5555000000',
        buyAmount: '3807681190768269801973105790',
        validTo: 1719319556,
        appData:
          '0x831ef45ca746d6d67482ba7ad19af3ed3d29da441d869cbf1fa8ea6dec3ebc1f',
        feeAmount: '0',
        kind: 'sell',
        partiallyFillable: false,
        sellTokenBalance: 'erc20',
        buyTokenBalance: 'erc20',
        signingScheme: 'eip712',
        signature:
          '0x6904193a1483813d7921585493b7e1a295476c12c9b6e08a430b726ae9a4e05660e309c430e21edcb5b7156e80291510159e1a4c39b736471f6bd4c131231b8c1b',
        interactions: { pre: [], post: [] },
      },
      {
        creationDate: '2024-06-25T12:15:26.924920Z',
        owner: '0x6ecba7527448bb56caba8ca7768d271deaea72a9',
        uid: '0xaaa1348fc7572d408097d069268db0ecb727ead6b525614999f983d5c5f1c1fb6ecba7527448bb56caba8ca7768d271deaea72a9667abbdc',
        availableBalance: null,
        executedBuyAmount: '6990751494894782668981616',
        executedSellAmount: '3000000000',
        executedSellAmountBeforeFees: '3000000000',
        executedFeeAmount: '0',
        executedSurplusFee: '4290918',
        invalidated: false,
        status: 'fulfilled',
        class: 'limit',
        settlementContract: '0x9008d19f58aabd9ed0d60971565aa8510560ab41',
        fullFeeAmount: '0',
        solverFee: '0',
        isLiquidityOrder: false,
        fullAppData:
          '{"appCode":"CoW Swap","environment":"production","metadata":{"orderClass":{"orderClass":"market"},"quote":{"slippageBips":50},"utm":{"utmContent":"header-cta-button","utmMedium":"web","utmSource":"cow.fi"}},"version":"1.1.0"}',
        sellToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        buyToken: '0x594daad7d77592a2b97b725a7ad59d7e188b5bfa',
        receiver: '0x6ecba7527448bb56caba8ca7768d271deaea72a9',
        sellAmount: '3000000000',
        buyAmount: '6961165527651189129024639',
        validTo: 1719319516,
        appData:
          '0x831ef45ca746d6d67482ba7ad19af3ed3d29da441d869cbf1fa8ea6dec3ebc1f',
        feeAmount: '0',
        kind: 'sell',
        partiallyFillable: false,
        sellTokenBalance: 'erc20',
        buyTokenBalance: 'erc20',
        signingScheme: 'eip712',
        signature:
          '0x18c6ea08a69ea97a3a1216038547ccb76c734b6ebc6b216cde32b68f8c2fb0c63c3223b056d2caf5dd0ff440b65821452ec84489b4edff00cbd419058a364e3f1c',
        interactions: { pre: [], post: [] },
      },
    ];

    // In order to appease TypeScript, we parse the data
    const orders = OrdersSchema.parse(_orders);

    const safeAddress = orders[0].owner;
    const sender = addressInfoBuilder().with('value', safeAddress).build();
    const recipient = addressInfoBuilder()
      .with('value', GPv2SettlementAddress)
      .build();
    const chainId = faker.string.numeric();
    const direction = getTransferDirection(
      safeAddress,
      sender.value,
      recipient.value,
    );
    const domainTransfer = erc20TransferBuilder()
      .with('from', getAddress(sender.value))
      .with('to', getAddress(recipient.value))
      .with('value', orders[0].executedSellAmount.toString())
      .with('tokenAddress', orders[0].sellToken)
      .build();
    const token = tokenBuilder()
      .with('address', domainTransfer.tokenAddress)
      .build();
    const transferInfo = new Erc20Transfer(
      token.address,
      domainTransfer.value,
      token.name,
      token.symbol,
      token.logoUri,
      token.decimals,
      token.trusted,
    );
    const explorerUrl = faker.internet.url({ appendSlash: true });
    mockSwapsRepository.getOrders.mockResolvedValue(orders);
    mockSwapOrderHelper.getOrderExplorerUrl.mockReturnValue(
      new URL(explorerUrl),
    );
    mockSwapAppsHelper.isAppAllowed.mockReturnValue(false);

    await expect(
      target.mapSwapTransferInfo({
        sender,
        recipient,
        direction,
        chainId,
        safeAddress,
        transferInfo,
        domainTransfer,
      }),
    ).rejects.toThrow('Unsupported App: CoW Swap');
  });
});
