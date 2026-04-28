// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { RelayManager } from '@/modules/relay/domain/relay.manager';
import { faker } from '@faker-js/faker';
import type { DailyLimitRelayer } from '@/modules/relay/domain/relayers/daily-limit.relayer';
import type { NoFeeCampaignRelayer } from '@/modules/relay/domain/relayers/no-fee-campaign.relayer';
import type { RelayFeeRelayer } from '@/modules/relay/domain/relayers/relay-fee.relayer';
import { SignerFactoryDecoder } from '@/modules/relay/domain/contracts/decoders/signer-factory-decoder.helper';
import { createSignerEncoder } from '@/modules/relay/domain/contracts/__tests__/encoders/signer-factory-encoder.builder';

const mockDailyLimitRelayer = {
  canRelay: jest.fn(),
  relay: jest.fn(),
  getRelaysRemaining: jest.fn(),
} as unknown as jest.MockedObjectDeep<DailyLimitRelayer>;

const mockNoFeeCampaignRelayer = {
  canRelay: jest.fn(),
  relay: jest.fn(),
  getRelaysRemaining: jest.fn(),
} as unknown as jest.MockedObjectDeep<NoFeeCampaignRelayer>;

const mockRelayFeeRelayer = {
  canRelay: jest.fn(),
  relay: jest.fn(),
  getRelaysRemaining: jest.fn(),
} as unknown as jest.MockedObjectDeep<RelayFeeRelayer>;

const signerFactoryDecoder = new SignerFactoryDecoder();

describe('RelayManager', () => {
  let fakeConfigurationService: FakeConfigurationService;

  beforeEach(() => {
    jest.resetAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
  });

  describe('getRelayer', () => {
    it('should return relay-fee relayer when chain is enabled for relay-fee', () => {
      const relayFeeChainId = faker.string.numeric();
      fakeConfigurationService.set('relay.noFeeCampaign', {});
      fakeConfigurationService.set('relay.dailyLimitRelayerChainsIds', [
        relayFeeChainId,
      ]);
      fakeConfigurationService.set('relay.fee', {
        enabledChainIds: [relayFeeChainId],
        baseUri: faker.internet.url(),
      });

      const manager = new RelayManager(
        fakeConfigurationService,
        mockDailyLimitRelayer,
        mockNoFeeCampaignRelayer,
        mockRelayFeeRelayer,
        signerFactoryDecoder,
      );

      // relay-fee takes priority even if chain is also in dailyLimitRelayChainIds
      expect(manager.getRelayer(relayFeeChainId)).toBe(mockRelayFeeRelayer);
    });

    it('should return daily limit relayer when chain is not relay-fee but is in dailyLimitRelayChainIds', () => {
      const dailyLimitChainId = faker.string.numeric();
      fakeConfigurationService.set('relay.noFeeCampaign', {});
      fakeConfigurationService.set('relay.dailyLimitRelayerChainsIds', [
        dailyLimitChainId,
      ]);
      fakeConfigurationService.set('relay.fee', {
        enabledChainIds: [],
        baseUri: '',
      });

      const manager = new RelayManager(
        fakeConfigurationService,
        mockDailyLimitRelayer,
        mockNoFeeCampaignRelayer,
        mockRelayFeeRelayer,
        signerFactoryDecoder,
      );

      expect(manager.getRelayer(dailyLimitChainId)).toBe(mockDailyLimitRelayer);
    });

    it('should return no-fee campaign relayer when chain has campaign config', () => {
      const campaignChainId = '1';
      fakeConfigurationService.set('relay.noFeeCampaign', {
        1: {
          startsAtTimeStamp: 0,
          endsAtTimeStamp: 0,
          maxGasLimit: 0,
          safeTokenAddress: '0x0000000000000000000000000000000000000000',
          relayRules: [],
        },
      });
      fakeConfigurationService.set('relay.dailyLimitRelayerChainsIds', []);
      fakeConfigurationService.set('relay.fee', {
        enabledChainIds: [],
        baseUri: '',
      });

      const manager = new RelayManager(
        fakeConfigurationService,
        mockDailyLimitRelayer,
        mockNoFeeCampaignRelayer,
        mockRelayFeeRelayer,
        signerFactoryDecoder,
      );

      expect(manager.getRelayer(campaignChainId)).toBe(
        mockNoFeeCampaignRelayer,
      );
    });

    it('should fallback to daily limit relayer for unknown chains', () => {
      const unknownChainId = faker.string.numeric({ length: 5 });
      fakeConfigurationService.set('relay.noFeeCampaign', {});
      fakeConfigurationService.set('relay.dailyLimitRelayerChainsIds', []);
      fakeConfigurationService.set('relay.fee', {
        enabledChainIds: [],
        baseUri: '',
      });

      const manager = new RelayManager(
        fakeConfigurationService,
        mockDailyLimitRelayer,
        mockNoFeeCampaignRelayer,
        mockRelayFeeRelayer,
        signerFactoryDecoder,
      );

      expect(manager.getRelayer(unknownChainId)).toBe(mockDailyLimitRelayer);
    });

    it('should prioritize relay-fee over no-fee campaign for same chain', () => {
      const chainId = '1';
      fakeConfigurationService.set('relay.noFeeCampaign', {
        1: {
          startsAtTimeStamp: 0,
          endsAtTimeStamp: 0,
          maxGasLimit: 0,
          safeTokenAddress: '0x0000000000000000000000000000000000000000',
          relayRules: [],
        },
      });
      fakeConfigurationService.set('relay.dailyLimitRelayerChainsIds', []);
      fakeConfigurationService.set('relay.fee', {
        enabledChainIds: [chainId],
        baseUri: faker.internet.url(),
      });

      const manager = new RelayManager(
        fakeConfigurationService,
        mockDailyLimitRelayer,
        mockNoFeeCampaignRelayer,
        mockRelayFeeRelayer,
        signerFactoryDecoder,
      );

      expect(manager.getRelayer(chainId)).toBe(mockRelayFeeRelayer);
    });

    it('should always route createSigner calldata to the daily-limit relayer, bypassing relay-fee and no-fee campaign', () => {
      // Configure both relay-fee and no-fee campaign for the same chain so
      // either would be chosen for non-createSigner calldata. The createSigner
      // override must beat both.
      const chainId = '1';
      fakeConfigurationService.set('relay.noFeeCampaign', {
        1: {
          startsAtTimeStamp: 0,
          endsAtTimeStamp: 0,
          maxGasLimit: 0,
          safeTokenAddress: '0x0000000000000000000000000000000000000000',
          relayRules: [],
        },
      });
      fakeConfigurationService.set('relay.dailyLimitRelayerChainsIds', []);
      fakeConfigurationService.set('relay.fee', {
        enabledChainIds: [chainId],
        baseUri: faker.internet.url(),
      });

      const manager = new RelayManager(
        fakeConfigurationService,
        mockDailyLimitRelayer,
        mockNoFeeCampaignRelayer,
        mockRelayFeeRelayer,
        signerFactoryDecoder,
      );

      const createSignerData = createSignerEncoder().encode();
      expect(manager.getRelayer(chainId, createSignerData)).toBe(
        mockDailyLimitRelayer,
      );
    });
  });
});
