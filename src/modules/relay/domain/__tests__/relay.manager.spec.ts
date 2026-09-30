// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { Hex } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '@/logging/logging.interface';
import { DelayModifierDecoder } from '@/modules/alerts/domain/contracts/decoders/delay-modifier-decoder.helper';
import { relayerBuilder } from '@/modules/chains/domain/entities/__tests__/relayer.builder';
import { multiSendEncoder } from '@/modules/contracts/domain/__tests__/encoders/multi-send-encoder.builder';
import { execTransactionEncoder } from '@/modules/contracts/domain/__tests__/encoders/safe-encoder.builder';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafeDecoder } from '@/modules/contracts/domain/decoders/safe-decoder.helper';
import { createProxyWithNonceEncoder } from '@/modules/relay/domain/contracts/__tests__/encoders/proxy-factory-encoder.builder';
import { createSignerEncoder } from '@/modules/relay/domain/contracts/__tests__/encoders/signer-factory-encoder.builder';
import { Erc20Decoder } from '@/modules/relay/domain/contracts/decoders/erc-20-decoder.helper';
import { ProxyFactoryDecoder } from '@/modules/relay/domain/contracts/decoders/proxy-factory-decoder.helper';
import { SignerFactoryDecoder } from '@/modules/relay/domain/contracts/decoders/signer-factory-decoder.helper';
import { GasPaymentOption } from '@/modules/relay/domain/entities/gas-payment-option.entity';
import { RelayerType } from '@/modules/relay/domain/entities/relayer-type.entity';
import { NoRelayerDefinedError } from '@/modules/relay/domain/errors/no-relayer-defined.error';
import { RelayerTypeNotImplementedError } from '@/modules/relay/domain/errors/relayer-type-not-implemented.error';
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

    describe('execTransaction with gasPrice > 0', () => {
      it('should route to the relay-fee relayer when PAY_FROM_SAFE is listed', () => {
        const relayer = relayerBuilder()
          .with('gasPaymentOptions', [
            GasPaymentOption.FREE_DAILY_LIMIT,
            GasPaymentOption.PAY_FROM_SAFE,
          ])
          .build();
        const data = refundingExecTransaction();

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
        const data = refundingExecTransaction();

        expect(() => manager.getRelayer({ relayer, data })).toThrow(
          NoRelayerDefinedError,
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
