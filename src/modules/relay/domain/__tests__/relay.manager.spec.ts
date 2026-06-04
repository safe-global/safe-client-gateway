// SPDX-License-Identifier: FSL-1.1-MIT

import type { MockedObject } from 'vitest';
import { createSignerEncoder } from '@/modules/relay/domain/contracts/__tests__/encoders/signer-factory-encoder.builder';
import { SignerFactoryDecoder } from '@/modules/relay/domain/contracts/decoders/signer-factory-decoder.helper';
import { RelayerType } from '@/modules/relay/domain/entities/relayer-type.entity';
import { NoRelayerDefinedError } from '@/modules/relay/domain/errors/no-relayer-defined.error';
import { RelayerTypeNotImplementedError } from '@/modules/relay/domain/errors/relayer-type-not-implemented.error';
import { RelayManager } from '@/modules/relay/domain/relay.manager';
import type { DailyLimitRelayer } from '@/modules/relay/domain/relayers/daily-limit.relayer';
import type { NoFeeCampaignRelayer } from '@/modules/relay/domain/relayers/no-fee-campaign.relayer';
import type { RelayFeeRelayer } from '@/modules/relay/domain/relayers/relay-fee.relayer';

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

const signerFactoryDecoder = new SignerFactoryDecoder();

describe('RelayManager', () => {
  let manager: RelayManager;

  beforeEach(() => {
    vi.resetAllMocks();
    manager = new RelayManager(
      mockDailyLimitRelayer,
      mockNoFeeCampaignRelayer,
      mockRelayFeeRelayer,
      signerFactoryDecoder,
    );
  });

  describe('getRelayer', () => {
    it('should return the relay-fee relayer when relayerType is RELAY_FEE', () => {
      expect(manager.getRelayer(RelayerType.RELAY_FEE)).toBe(
        mockRelayFeeRelayer,
      );
    });

    it('should return the daily-limit relayer when relayerType is DAILY_LIMIT', () => {
      expect(manager.getRelayer(RelayerType.DAILY_LIMIT)).toBe(
        mockDailyLimitRelayer,
      );
    });

    it('should return the no-fee campaign relayer when relayerType is NO_FEE_CAMPAIGN', () => {
      expect(manager.getRelayer(RelayerType.NO_FEE_CAMPAIGN)).toBe(
        mockNoFeeCampaignRelayer,
      );
    });

    it('should throw RelayerTypeNotImplementedError when relayerType is GTF', () => {
      expect(() => manager.getRelayer(RelayerType.GTF)).toThrow(
        RelayerTypeNotImplementedError,
      );
    });

    it('should throw NoRelayerDefinedError when relayerType is null', () => {
      expect(() => manager.getRelayer(null)).toThrow(NoRelayerDefinedError);
    });

    it('should always route createSigner calldata to the daily-limit relayer, bypassing the chain-configured relayer', () => {
      // Even when the chain is configured for RELAY_FEE, createSigner calldata
      // must route to the daily-limit relayer (passkey signer deployment is
      // always sponsored).
      const createSignerData = createSignerEncoder().encode();
      expect(manager.getRelayer(RelayerType.RELAY_FEE, createSignerData)).toBe(
        mockDailyLimitRelayer,
      );
      expect(
        manager.getRelayer(RelayerType.NO_FEE_CAMPAIGN, createSignerData),
      ).toBe(mockDailyLimitRelayer);
      // Bypass also applies when relayerType is null (would otherwise throw).
      expect(manager.getRelayer(null, createSignerData)).toBe(
        mockDailyLimitRelayer,
      );
    });
  });
});
