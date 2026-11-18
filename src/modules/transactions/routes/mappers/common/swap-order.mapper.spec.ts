// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import type { ILoggingService } from '#/logging/logging.interface';
import { setPreSignatureEncoder } from '#/modules/swaps/domain/contracts/__tests__/encoders/gp-v2-encoder.builder';
import { GPv2Decoder } from '#/modules/swaps/domain/contracts/decoders/gp-v2-decoder.helper';
import { orderBuilder } from '#/modules/swaps/domain/entities/__tests__/order.builder';
import { OrderKind } from '#/modules/swaps/domain/entities/order.entity';
import { tokenBuilder } from '#/modules/tokens/domain/__tests__/token.builder';
import { SwapAppsHelper } from '#/modules/transactions/routes/helpers/swap-apps.helper';
import type {
  SwapOrderCalls,
  SwapOrderHelper,
} from '#/modules/transactions/routes/helpers/swap-order.helper';
import { SwapOrderMapper } from '#/modules/transactions/routes/mappers/common/swap-order.mapper';

const loggingService = {
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

const swapOrderHelper = {
  getOrder: vi.fn(),
  getToken: vi.fn(),
  getOrderExplorerUrl: vi.fn(),
} as MockedObject<SwapOrderHelper>;
const swapOrderHelperMock = vi.mocked(swapOrderHelper);

describe('SwapOrderMapper', () => {
  const configurationService = new FakeConfigurationService();
  configurationService.set('swaps.restrictApps', false);
  const target = new SwapOrderMapper(
    new GPv2Decoder(loggingService),
    swapOrderHelperMock,
    new SwapAppsHelper(configurationService, new Set()),
  );
  const chainId = faker.string.numeric();

  const randomAddress = (): Address =>
    getAddress(faker.finance.ethereumAddress());

  const setUp = (args: { sellTokenTrusted: boolean }) => {
    const preSignature = setPreSignatureEncoder().with('signed', true);
    const order = orderBuilder()
      .with('uid', preSignature.build().orderUid)
      .with('kind', OrderKind.Sell)
      .with('sellAmount', faker.number.bigInt({ min: 2, max: 10n ** 18n }))
      .with('feeAmount', faker.number.bigInt({ min: 1, max: 10n ** 16n }))
      .build();
    const sellToken = tokenBuilder()
      .with('address', order.sellToken)
      .with('trusted', args.sellTokenTrusted)
      .build();
    const buyToken = tokenBuilder().with('address', order.buyToken).build();
    swapOrderHelperMock.getOrder.mockResolvedValue({
      ...order,
      kind: OrderKind.Sell,
    });
    swapOrderHelperMock.getToken.mockImplementation(({ address }) =>
      Promise.resolve(address === order.sellToken ? sellToken : buyToken),
    );
    swapOrderHelperMock.getOrderExplorerUrl.mockReturnValue(
      new URL(faker.internet.url()),
    );
    return { order, preSignature: preSignature.encode() };
  };

  const orderCalls = (
    preSignature: SwapOrderCalls['preSignature'],
    calls: Partial<SwapOrderCalls> = {},
  ): SwapOrderCalls => ({
    preSignature,
    approvedTokens: [],
    wraps: [],
    ...calls,
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('maps an order whose approvals and wraps are for its trusted sell token', async () => {
    const { order, preSignature } = setUp({ sellTokenTrusted: true });

    const actual = await target.mapSwapOrder(
      chainId,
      orderCalls(preSignature, {
        approvedTokens: [order.sellToken],
        wraps: [{ token: order.sellToken, value: order.sellAmount }],
      }),
    );

    expect(actual.uid).toBe(order.uid);
  });

  it('throws for an approval of a token other than the sell token', async () => {
    const { preSignature } = setUp({ sellTokenTrusted: true });

    await expect(
      target.mapSwapOrder(
        chainId,
        orderCalls(preSignature, { approvedTokens: [randomAddress()] }),
      ),
    ).rejects.toThrow('Approval is not for the order sell token');
  });

  it('throws for a wrap of a token other than the sell token', async () => {
    const { preSignature } = setUp({ sellTokenTrusted: true });

    await expect(
      target.mapSwapOrder(
        chainId,
        orderCalls(preSignature, {
          wraps: [{ token: randomAddress(), value: BigInt(1) }],
        }),
      ),
    ).rejects.toThrow('Wrap does not match the order sell token');
  });

  it('maps an order whose wraps cover the sell amount plus the fee and 1%', async () => {
    const { order, preSignature } = setUp({ sellTokenTrusted: true });
    const limit =
      ((order.sellAmount + order.feeAmount) * BigInt(101)) / BigInt(100);

    const actual = await target.mapSwapOrder(
      chainId,
      orderCalls(preSignature, {
        wraps: [{ token: order.sellToken, value: limit }],
      }),
    );

    expect(actual.uid).toBe(order.uid);
  });

  it('throws for wraps adding up to more than the sell amount plus the fee and 1%', async () => {
    const { order, preSignature } = setUp({ sellTokenTrusted: true });
    const overLimit =
      ((order.sellAmount + order.feeAmount) * BigInt(101)) / BigInt(100) +
      BigInt(1);
    const firstWrap = overLimit / BigInt(2);

    await expect(
      target.mapSwapOrder(
        chainId,
        orderCalls(preSignature, {
          wraps: [
            { token: order.sellToken, value: firstWrap },
            { token: order.sellToken, value: overLimit - firstWrap },
          ],
        }),
      ),
    ).rejects.toThrow('Wrap does not match the order sell token');
  });

  it('throws for a wrap of an untrusted sell token', async () => {
    const { order, preSignature } = setUp({ sellTokenTrusted: false });

    await expect(
      target.mapSwapOrder(
        chainId,
        orderCalls(preSignature, {
          wraps: [{ token: order.sellToken, value: BigInt(1) }],
        }),
      ),
    ).rejects.toThrow('Wrap does not match the order sell token');
  });
});
