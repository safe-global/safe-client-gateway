import {
  RecipientStatus,
  RecipientStatusSchema,
} from '../recipient-status.entity';
import { BridgeStatus, BridgeStatusSchema } from '../bridge-status.entity';
import {
  ContractStatus,
  ContractStatusSchema,
} from '../contract-status.entity';
import { ThreatStatus, ThreatStatusSchema } from '../threat-status.entity';
import { CommonStatus } from '@/modules/safe-shield/entities/analysis-result.entity';

describe('Status Entities', () => {
  const recipientStatus = Object.values(RecipientStatus);
  const bridgeStatus = Object.values(BridgeStatus);
  const contractStatus = Object.values(ContractStatus);
  const threatStatus = Object.values(ThreatStatus);

  describe('RecipientStatus', () => {
    it('should have all expected values', () => {
      expect(recipientStatus).toHaveLength(3);
      expect(recipientStatus).toContain('NEW_RECIPIENT');
      expect(recipientStatus).toContain('RECURRING_RECIPIENT');
      expect(recipientStatus).toContain('LOW_ACTIVITY');
    });

    it.each(recipientStatus)('should validate with schema = %s', (value) => {
      expect(() => RecipientStatusSchema.parse(value)).not.toThrow();
    });

    it.each(['INVALID', '', null, undefined, 123] as const)(
      'should reject invalid value = %s',
      (invalidValue) => {
        expect(() => RecipientStatusSchema.parse(invalidValue)).toThrow();
      },
    );
  });

  describe('BridgeStatus', () => {
    it('should have all expected values', () => {
      expect(bridgeStatus).toHaveLength(4);
      expect(bridgeStatus).toContain('INCOMPATIBLE_SAFE');
      expect(bridgeStatus).toContain('MISSING_OWNERSHIP');
      expect(bridgeStatus).toContain('UNSUPPORTED_NETWORK');
      expect(bridgeStatus).toContain('DIFFERENT_SAFE_SETUP');
    });

    it.each(bridgeStatus)('should validate with schema = %s', (value) => {
      expect(() => BridgeStatusSchema.parse(value)).not.toThrow();
    });

    it.each(['INVALID', '', null, undefined, 123] as const)(
      'should reject invalid value = %s',
      (invalidValue) => {
        expect(() => BridgeStatusSchema.parse(invalidValue)).toThrow();
      },
    );
  });

  describe('ContractStatus', () => {
    it('should have all expected values', () => {
      expect(contractStatus).toHaveLength(8);
      expect(contractStatus).toContain('VERIFIED');
      expect(contractStatus).toContain('NOT_VERIFIED');
      expect(contractStatus).toContain('NOT_VERIFIED_BY_SAFE');
      expect(contractStatus).toContain('VERIFICATION_UNAVAILABLE');
      expect(contractStatus).toContain('NEW_CONTRACT');
      expect(contractStatus).toContain('KNOWN_CONTRACT');
      expect(contractStatus).toContain('UNEXPECTED_DELEGATECALL');
      expect(contractStatus).toContain('UNOFFICIAL_FALLBACK_HANDLER');
    });

    it.each(contractStatus)('should validate with schema = %s', (value) => {
      expect(() => ContractStatusSchema.parse(value)).not.toThrow();
    });

    it.each(['INVALID', '', null, undefined, 123] as const)(
      'should reject invalid value = %s',
      (invalidValue) => {
        expect(() => ContractStatusSchema.parse(invalidValue)).toThrow();
      },
    );
  });

  describe('ThreatStatus', () => {
    it('should have all expected values', () => {
      expect(threatStatus).toHaveLength(6);
      expect(threatStatus).toContain('MALICIOUS');
      expect(threatStatus).toContain('MODERATE');
      expect(threatStatus).toContain('NO_THREAT');
      expect(threatStatus).toContain('MASTERCOPY_CHANGE');
      expect(threatStatus).toContain('OWNERSHIP_CHANGE');
      expect(threatStatus).toContain('MODULE_CHANGE');
    });

    it.each(threatStatus)('should validate with schema = %s', (value) => {
      expect(() => ThreatStatusSchema.parse(value)).not.toThrow();
    });

    it.each(['INVALID', '', null, undefined, 123] as const)(
      'should reject invalid value = %s',
      (invalidValue) => {
        expect(() => ThreatStatusSchema.parse(invalidValue)).toThrow();
      },
    );
  });

  describe('cross-entity consistency', () => {
    it('should maintain consistent naming patterns', () => {
      const allStatusEnums = [
        RecipientStatus,
        BridgeStatus,
        ContractStatus,
        ThreatStatus,
        CommonStatus,
      ];

      allStatusEnums.forEach((statusEnum) => {
        Object.values(statusEnum).forEach((value) => {
          // All status values should be uppercase with underscores
          expect(value).toMatch(/^[A-Z_]+$/);
          // Should not start or end with underscore
          expect(value).not.toMatch(/^_|_$/);
        });
      });
    });

    it('should have unique values across different status types', () => {
      const allValues = {
        ...RecipientStatus,
        ...BridgeStatus,
        ...ContractStatus,
        ...ThreatStatus,
        ...CommonStatus,
      };

      const uniqueValues = new Set(Object.values(allValues));
      expect(uniqueValues.size).toBe(Object.values(allValues).length);
    });
  });
});
