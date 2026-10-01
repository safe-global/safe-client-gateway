// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { Hex } from 'viem';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '@/logging/logging.interface';
import { DelayModifierDecoder } from '@/modules/alerts/domain/contracts/decoders/delay-modifier-decoder.helper';
import { relayerBuilder } from '@/modules/chains/domain/entities/__tests__/relayer.builder';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/modules/contracts/domain/__tests__/encoders/multi-send-encoder.builder';
import { execTransactionEncoder } from '@/modules/contracts/domain/__tests__/encoders/safe-encoder.builder';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafeDecoder } from '@/modules/contracts/domain/decoders/safe-decoder.helper';
import { QuotaExceededError } from '@/modules/entitlements/domain/errors/quota-exceeded.error';
import { createProxyWithNonceEncoder } from '@/modules/relay/domain/contracts/__tests__/encoders/proxy-factory-encoder.builder';
import { createSignerEncoder } from '@/modules/relay/domain/contracts/__tests__/encoders/signer-factory-encoder.builder';
import { Erc20Decoder } from '@/modules/relay/domain/contracts/decoders/erc-20-decoder.helper';
import { ProxyFactoryDecoder } from '@/modules/relay/domain/contracts/decoders/proxy-factory-decoder.helper';
import { SignerFactoryDecoder } from '@/modules/relay/domain/contracts/decoders/signer-factory-decoder.helper';
import { GasPaymentOption } from '@/modules/relay/domain/entities/gas-payment-option.entity';
import { RelayerType } from '@/modules/relay/domain/entities/relayer-type.entity';
import { GasPaymentOptionUnavailableError } from '@/modules/relay/domain/errors/gas-payment-option-unavailable.error';
import { NoRelayerDefinedError } from '@/modules/relay/domain/errors/no-relayer-defined.error';
import { RelayLimitReachedError } from '@/modules/relay/domain/errors/relay-limit-reached.error';
import { RelayerTypeNotImplementedError } from '@/modules/relay/domain/errors/relayer-type-not-implemented.error';
import type { RelaySubmitter } from '@/modules/relay/domain/interfaces/relayer.interface';
import { RelayManager } from '@/modules/relay/domain/relay.manager';
import { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';
import type { DailyLimitRelayer } from '@/modules/relay/domain/relayers/daily-limit.relayer';
import type { NoFeeCampaignRelayer } from '@/modules/relay/domain/relayers/no-fee-campaign.relayer';
import type { RelayFeeRelayer } from '@/modules/relay/domain/relayers/relay-fee.relayer';
import type { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';

const mockDailyLimitRelayer = {
  canRelay: vi.fn(),
  relay: vi.fn(),
  getRelaysRemaining: vi.fn(),
} as unknown as MockedObject<DailyLimitRelayer>;

const mockNoFeeCampaignRelayer = {
  canRelay: vi.fn(),
  relay: vi.fn(),
  getRelaysRemaining: vi.fn(),
} as unknown as MockedObject<NoFeeCampaignRelayer>;

const mockRelayFeeRelayer = {
  canRelay: vi.fn(),
  relay: vi.fn(),
  getRelaysRemaining: vi.fn(),
} as unknown as MockedObject<RelayFeeRelayer>;

const mockLoggingService = {
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

const mockSafeRepository = {
  getSafe: vi.fn(),
} as unknown as MockedObject<ISafeRepository>;

const NON_GTF_RELAYER_TYPES = [
  RelayerType.RELAY_FEE,
  RelayerType.DAILY_LIMIT,
  RelayerType.NO_FEE_CAMPAIGN,
  null,
];

function refundingExecTransaction(): Hex {
  return execTransactionEncoder()
    .with('gasPrice', faker.number.bigInt({ min: BigInt(1) }))
    .encode();
}

function gaslessExecTransaction(): Hex {
  return execTransactionEncoder().with('gasPrice', BigInt(0)).encode();
}

function gaslessMultiSend(): Hex {
  return multiSendEncoder().encode();
}

function refundingMultiSend(): Hex {
  const safe = getAddress(faker.finance.ethereumAddress());
  return multiSendEncoder()
    .with(
      'transactions',
      multiSendTransactionsEncoder(
        faker.helpers
          .shuffle([gaslessExecTransaction(), refundingExecTransaction()])
          .map((data) => ({ operation: 0, to: safe, value: BigInt(0), data })),
      ),
    )
    .encode();
}

describe('RelayManager', () => {
  let manager: RelayManager;

  beforeEach(() => {
    vi.resetAllMocks();
    manager = new RelayManager(
      mockDailyLimitRelayer,
      mockNoFeeCampaignRelayer,
      mockRelayFeeRelayer,
      new ProxyFactoryDecoder(),
      new RelayTransactionHelper(
        mockSafeRepository,
        mockLoggingService,
        new Erc20Decoder(),
        new SafeDecoder(),
        new MultiSendDecoder(mockLoggingService),
        new ProxyFactoryDecoder(),
        new DelayModifierDecoder(),
        new SignerFactoryDecoder(),
      ),
    );
  });

  describe('getRelayer', () => {
    describe('createSigner', () => {
      it.each([
        ['no relayer', null],
        [
          'no gas payment options',
          relayerBuilder().with('gasPaymentOptions', []).build(),
        ],
        [
          'a GTF relayer',
          relayerBuilder().with('type', RelayerType.GTF).build(),
        ],
      ])('should route to the daily-limit relayer with %s', (_, relayer) => {
        const data = createSignerEncoder().encode();

        expect(manager.getRelayer({ relayer, data })).toBe(
          mockDailyLimitRelayer,
        );
      });
    });

    it('should throw NoRelayerDefinedError for a chain without a relayer', () => {
      const data = gaslessExecTransaction();

      expect(() => manager.getRelayer({ relayer: null, data })).toThrow(
        NoRelayerDefinedError,
      );
    });

    it('should throw RelayerTypeNotImplementedError for a GTF relayer, whatever the list says', () => {
      const relayer = relayerBuilder()
        .with('type', RelayerType.GTF)
        .with(
          'gasPaymentOptions',
          faker.helpers.arrayElements(Object.values(GasPaymentOption)),
        )
        .build();
      const data = gaslessExecTransaction();

      expect(() => manager.getRelayer({ relayer, data })).toThrow(
        new RelayerTypeNotImplementedError(RelayerType.GTF),
      );
    });

    describe('createProxyWithNonce', () => {
      it('should route a sponsored Safe creation to the daily-limit relayer whatever the list says', () => {
        const relayer = relayerBuilder()
          .with('type', faker.helpers.arrayElement(NON_GTF_RELAYER_TYPES))
          .with('safeCreationSponsored', true)
          .with(
            'gasPaymentOptions',
            faker.helpers.arrayElements(
              [
                GasPaymentOption.NO_FEE_CAMPAIGN,
                GasPaymentOption.SUBSCRIPTION,
                GasPaymentOption.PAY_FROM_SAFE,
              ],
              { min: 0, max: 3 },
            ),
          )
          .build();
        const data = createProxyWithNonceEncoder().encode();

        expect(manager.getRelayer({ relayer, data })).toBe(
          mockDailyLimitRelayer,
        );
      });

      it('should refuse a Safe creation the chain does not sponsor', () => {
        const relayer = relayerBuilder()
          .with('safeCreationSponsored', false)
          .with('gasPaymentOptions', [GasPaymentOption.FREE_DAILY_LIMIT])
          .build();
        const data = createProxyWithNonceEncoder().encode();

        expect(() => manager.getRelayer({ relayer, data })).toThrow(
          NoRelayerDefinedError,
        );
      });
    });

    describe.each([
      ['an execTransaction with gasPrice > 0', refundingExecTransaction],
      ['a MultiSend batch carrying one', refundingMultiSend],
    ])('%s', (_, encode) => {
      it('should route to the relay-fee relayer when PAY_FROM_SAFE is listed', () => {
        const relayer = relayerBuilder()
          .with('gasPaymentOptions', [
            GasPaymentOption.FREE_DAILY_LIMIT,
            GasPaymentOption.PAY_FROM_SAFE,
          ])
          .build();
        const data = encode();

        expect(manager.getRelayer({ relayer, data })).toBe(mockRelayFeeRelayer);
      });

      it('should refuse it when PAY_FROM_SAFE is not listed, even with free options', () => {
        const relayer = relayerBuilder()
          .with('gasPaymentOptions', [
            GasPaymentOption.FREE_DAILY_LIMIT,
            GasPaymentOption.NO_FEE_CAMPAIGN,
            GasPaymentOption.SUBSCRIPTION,
          ])
          .build();
        const data = encode();

        expect(() => manager.getRelayer({ relayer, data })).toThrow(
          new GasPaymentOptionUnavailableError({
            requested: GasPaymentOption.PAY_FROM_SAFE,
            reason: 'NOT_LISTED',
            available: relayer.gasPaymentOptions,
          }),
        );
      });

      it('should refuse it on a chain without a relayer', () => {
        const data = encode();

        expect(() => manager.getRelayer({ relayer: null, data })).toThrow(
          new GasPaymentOptionUnavailableError({
            requested: GasPaymentOption.PAY_FROM_SAFE,
            reason: 'NO_RELAYER',
            available: [],
          }),
        );
      });
    });

    describe.each([
      ['a gasless execTransaction', gaslessExecTransaction],
      ['a MultiSend batch', gaslessMultiSend],
    ])('%s', (_, encode) => {
      it('should route to the no-fee campaign relayer when NO_FEE_CAMPAIGN is listed, ahead of the daily limit', () => {
        const relayer = relayerBuilder()
          .with('gasPaymentOptions', [
            GasPaymentOption.FREE_DAILY_LIMIT,
            GasPaymentOption.NO_FEE_CAMPAIGN,
          ])
          .build();

        expect(manager.getRelayer({ relayer, data: encode() })).toBe(
          mockNoFeeCampaignRelayer,
        );
      });

      it('should route to the daily-limit relayer when FREE_DAILY_LIMIT is the only free option', () => {
        const relayer = relayerBuilder()
          .with('gasPaymentOptions', [
            GasPaymentOption.FREE_DAILY_LIMIT,
            GasPaymentOption.PAY_FROM_SAFE,
          ])
          .build();

        expect(manager.getRelayer({ relayer, data: encode() })).toBe(
          mockDailyLimitRelayer,
        );
      });

      it('should refuse it when no free option is listed', () => {
        const relayer = relayerBuilder()
          .with(
            'gasPaymentOptions',
            faker.helpers.arrayElements(
              [GasPaymentOption.PAY_FROM_SAFE, GasPaymentOption.SUBSCRIPTION],
              { min: 0, max: 2 },
            ),
          )
          .build();

        expect(() => manager.getRelayer({ relayer, data: encode() })).toThrow(
          NoRelayerDefinedError,
        );
      });
    });
  });

  describe('getRelayer with a subscription', () => {
    const relaySubmitter = {
      relay: vi.fn(),
    } as MockedObject<RelaySubmitter>;

    function relayArgs(data: Hex): Parameters<RelaySubmitter['relay']>[0] {
      return {
        version: faker.system.semver(),
        chainId: faker.string.numeric(),
        to: getAddress(faker.finance.ethereumAddress()),
        data,
        gasLimit: null,
      };
    }

    function limitReached(): RelayLimitReachedError {
      return new RelayLimitReachedError(
        getAddress(faker.finance.ethereumAddress()),
        faker.number.int({ min: 1 }),
        faker.number.int({ min: 1 }),
      );
    }

    it.each([
      [
        'a transaction on a chain listing no free option',
        gaslessExecTransaction,
        relayerBuilder()
          .with('gasPaymentOptions', [
            GasPaymentOption.SUBSCRIPTION,
            GasPaymentOption.PAY_FROM_SAFE,
          ])
          .build(),
      ],
      [
        'a Safe creation the chain does not sponsor',
        (): Hex => createProxyWithNonceEncoder().encode(),
        relayerBuilder()
          .with('safeCreationSponsored', false)
          .with('gasPaymentOptions', [
            GasPaymentOption.FREE_DAILY_LIMIT,
            GasPaymentOption.SUBSCRIPTION,
          ])
          .build(),
      ],
      [
        'a transaction on a GTF chain',
        gaslessExecTransaction,
        relayerBuilder()
          .with('type', RelayerType.GTF)
          .with('gasPaymentOptions', [
            GasPaymentOption.FREE_DAILY_LIMIT,
            GasPaymentOption.SUBSCRIPTION,
          ])
          .build(),
      ],
    ])('should route %s to the subscription', (_, encode, relayer) => {
      expect(
        manager.getRelayer({ relayer, data: encode(), relaySubmitter }),
      ).toBe(relaySubmitter);
    });

    it('should not fall back on a chain that does not list SUBSCRIPTION', () => {
      const relayer = relayerBuilder()
        .with(
          'gasPaymentOptions',
          faker.helpers.arrayElements([GasPaymentOption.PAY_FROM_SAFE], {
            min: 0,
            max: 1,
          }),
        )
        .build();

      expect(() =>
        manager.getRelayer({
          relayer,
          data: gaslessExecTransaction(),
          relaySubmitter,
        }),
      ).toThrow(NoRelayerDefinedError);
    });

    it('should not fall back on a chain without a relayer', () => {
      expect(() =>
        manager.getRelayer({
          relayer: null,
          data: gaslessExecTransaction(),
          relaySubmitter,
        }),
      ).toThrow(NoRelayerDefinedError);
    });

    describe.each([
      ['an execTransaction with gasPrice > 0', refundingExecTransaction],
      ['a MultiSend batch carrying one', refundingMultiSend],
    ])('%s', (_, encode) => {
      it('should route to the relay-fee relayer when PAY_FROM_SAFE is listed', () => {
        const relayer = relayerBuilder()
          .with('gasPaymentOptions', [
            GasPaymentOption.SUBSCRIPTION,
            GasPaymentOption.PAY_FROM_SAFE,
          ])
          .build();

        expect(
          manager.getRelayer({ relayer, data: encode(), relaySubmitter }),
        ).toBe(mockRelayFeeRelayer);
      });

      it('should never route it to the subscription', () => {
        const relayer = relayerBuilder()
          .with('gasPaymentOptions', [
            GasPaymentOption.FREE_DAILY_LIMIT,
            GasPaymentOption.SUBSCRIPTION,
          ])
          .build();

        expect(() =>
          manager.getRelayer({ relayer, data: encode(), relaySubmitter }),
        ).toThrow(
          new GasPaymentOptionUnavailableError({
            requested: GasPaymentOption.PAY_FROM_SAFE,
            reason: 'NOT_LISTED',
            available: relayer.gasPaymentOptions,
          }),
        );
      });
    });

    describe.each([
      [
        'a signer creation',
        (): Hex => createSignerEncoder().encode(),
        [GasPaymentOption.SUBSCRIPTION],
        mockDailyLimitRelayer,
      ],
      [
        'a sponsored Safe creation',
        (): Hex => createProxyWithNonceEncoder().encode(),
        [GasPaymentOption.SUBSCRIPTION],
        mockDailyLimitRelayer,
      ],
      [
        'a transaction on the daily limit',
        gaslessExecTransaction,
        [GasPaymentOption.FREE_DAILY_LIMIT, GasPaymentOption.SUBSCRIPTION],
        mockDailyLimitRelayer,
      ],
      [
        'a transaction on the no-fee campaign',
        gaslessMultiSend,
        [GasPaymentOption.NO_FEE_CAMPAIGN, GasPaymentOption.SUBSCRIPTION],
        mockNoFeeCampaignRelayer,
      ],
    ])('%s', (_, encode, gasPaymentOptions, freeRelayer) => {
      const relayer = (): NonNullable<Chain['relayer']> =>
        relayerBuilder()
          .with('safeCreationSponsored', true)
          .with('gasPaymentOptions', gasPaymentOptions)
          .build();

      it('should relay on the free quota first', async () => {
        const args = relayArgs(encode());
        const relay = { taskId: faker.string.uuid() };
        freeRelayer.relay.mockResolvedValue(relay);

        await expect(
          manager
            .getRelayer({ relayer: relayer(), data: args.data, relaySubmitter })
            .relay(args),
        ).resolves.toBe(relay);

        expect(freeRelayer.relay).toHaveBeenCalledExactlyOnceWith(args);
        expect(relaySubmitter.relay).not.toHaveBeenCalled();
      });

      it('should fall back to the subscription once the free quota is spent', async () => {
        const args = relayArgs(encode());
        const relay = { taskId: faker.string.uuid() };
        freeRelayer.relay.mockRejectedValue(limitReached());
        relaySubmitter.relay.mockResolvedValue(relay);

        await expect(
          manager
            .getRelayer({ relayer: relayer(), data: args.data, relaySubmitter })
            .relay(args),
        ).resolves.toBe(relay);

        expect(relaySubmitter.relay).toHaveBeenCalledExactlyOnceWith(args);
      });

      it("should answer with the subscription's error once both are spent", async () => {
        const args = relayArgs(encode());
        const quotaExceeded = new QuotaExceededError({
          feature: 'sponsored_transactions',
          quota: faker.number.int({ min: 1 }),
          used: faker.number.int({ min: 1 }),
          resetsAt: faker.date.future(),
        });
        freeRelayer.relay.mockRejectedValue(limitReached());
        relaySubmitter.relay.mockRejectedValue(quotaExceeded);

        await expect(
          manager
            .getRelayer({ relayer: relayer(), data: args.data, relaySubmitter })
            .relay(args),
        ).rejects.toThrow(quotaExceeded);
      });

      it('should not fall back on any other error', async () => {
        const args = relayArgs(encode());
        const failed = new Error(faker.lorem.sentence());
        freeRelayer.relay.mockRejectedValue(failed);

        await expect(
          manager
            .getRelayer({ relayer: relayer(), data: args.data, relaySubmitter })
            .relay(args),
        ).rejects.toThrow(failed);

        expect(relaySubmitter.relay).not.toHaveBeenCalled();
      });
    });

    it('should answer with the free error when SUBSCRIPTION is not listed', async () => {
      const relayer = relayerBuilder()
        .with('gasPaymentOptions', [GasPaymentOption.FREE_DAILY_LIMIT])
        .build();
      const args = relayArgs(gaslessExecTransaction());
      const error = limitReached();
      mockDailyLimitRelayer.relay.mockRejectedValue(error);

      await expect(
        manager
          .getRelayer({ relayer, data: args.data, relaySubmitter })
          .relay(args),
      ).rejects.toThrow(error);

      expect(relaySubmitter.relay).not.toHaveBeenCalled();
    });
  });

  describe('getFreeRelayer', () => {
    it('should throw NoRelayerDefinedError for a chain without a relayer', () => {
      expect(() => manager.getFreeRelayer(null)).toThrow(NoRelayerDefinedError);
    });

    it('should throw RelayerTypeNotImplementedError for a GTF relayer', () => {
      const relayer = relayerBuilder().with('type', RelayerType.GTF).build();

      expect(() => manager.getFreeRelayer(relayer)).toThrow(
        new RelayerTypeNotImplementedError(RelayerType.GTF),
      );
    });

    it('should return the no-fee campaign relayer when NO_FEE_CAMPAIGN is listed, ahead of the daily limit', () => {
      const relayer = relayerBuilder()
        .with('gasPaymentOptions', [
          GasPaymentOption.FREE_DAILY_LIMIT,
          GasPaymentOption.NO_FEE_CAMPAIGN,
        ])
        .build();

      expect(manager.getFreeRelayer(relayer)).toBe(mockNoFeeCampaignRelayer);
    });

    it('should return the daily-limit relayer when FREE_DAILY_LIMIT is the only free option', () => {
      const relayer = relayerBuilder()
        .with('gasPaymentOptions', [
          GasPaymentOption.FREE_DAILY_LIMIT,
          GasPaymentOption.SUBSCRIPTION,
        ])
        .build();

      expect(manager.getFreeRelayer(relayer)).toBe(mockDailyLimitRelayer);
    });

    it('should throw NoRelayerDefinedError when no free option is listed', () => {
      const relayer = relayerBuilder()
        .with(
          'gasPaymentOptions',
          faker.helpers.arrayElements(
            [GasPaymentOption.PAY_FROM_SAFE, GasPaymentOption.SUBSCRIPTION],
            { min: 0, max: 2 },
          ),
        )
        .build();

      expect(() => manager.getFreeRelayer(relayer)).toThrow(
        NoRelayerDefinedError,
      );
    });
  });
});
