import { erc20TransferBuilder } from '@/domain/safe/entities/__tests__/erc20-transfer.builder';
import { orderBuilder } from '@/domain/swaps/entities/__tests__/order.builder';
import { ISwapsRepository } from '@/domain/swaps/swaps.repository';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { addressInfoBuilder } from '@/routes/common/__tests__/entities/address-info.builder';
import { TransferDirection } from '@/routes/transactions/entities/transfer-transaction-info.entity';
import { Erc20Transfer } from '@/routes/transactions/entities/transfers/erc20-transfer.entity';
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

describe('SwapTransferInfoMapper', () => {
  let target: SwapTransferInfoMapper;

  const GPv2SettlementAddress = '0x9008D19f58AAbD9eD0D60971565AA8510560ab41';

  beforeEach(() => {
    jest.resetAllMocks();

    target = new SwapTransferInfoMapper(
      mockSwapOrderHelper,
      mockSwapsRepository,
    );
  });

  it('it returns null if nether the sender and recipient are from the GPv2Settlement contract', async () => {
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

    const actual = await target.mapSwapTransferInfo({
      sender,
      recipient,
      direction,
      chainId,
      safeAddress,
      transferInfo,
      domainTransfer,
    });

    expect(actual).toBe(null);
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

  it.todo('maps the correct order if it was executed in a batch');
});
