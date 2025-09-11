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

describe('Status Entities', () => {
  describe('RecipientStatus', () => {
    it('should have all expected values', () => {
      expect(RecipientStatus).toHaveLength(2);
      expect(RecipientStatus).toContain('NEW_RECIPIENT');
      expect(RecipientStatus).toContain('KNOWN_RECIPIENT');
    });

    it.each(RecipientStatus)('should validate with schema = %s', (value) => {
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
      expect(BridgeStatus).toHaveLength(4);
      expect(BridgeStatus).toContain('INCOMPATIBLE_SAFE');
      expect(BridgeStatus).toContain('MISSING_OWNERSHIP');
      expect(BridgeStatus).toContain('UNSUPPORTED_NETWORK');
      expect(BridgeStatus).toContain('DIFFERENT_SAFE_SETUP');
    });

    it.each(BridgeStatus)('should validate with schema = %s', (value) => {
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
      expect(ContractStatus).toHaveLength(7);
      expect(ContractStatus).toContain('VERIFIED');
      expect(ContractStatus).toContain('NOT_VERIFIED');
      expect(ContractStatus).toContain('NOT_VERIFIED_BY_SAFE');
      expect(ContractStatus).toContain('VERIFICATION_UNAVAILABLE');
      expect(ContractStatus).toContain('NEW_CONTRACT');
      expect(ContractStatus).toContain('KNOWN_CONTRACT');
      expect(ContractStatus).toContain('UNEXPECTED_DELEGATECALL');
    });

    it.each(ContractStatus)('should validate with schema = %s', (value) => {
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
      expect(ThreatStatus).toHaveLength(7);
      expect(ThreatStatus).toContain('MALICIOUS');
      expect(ThreatStatus).toContain('MODERATE');
      expect(ThreatStatus).toContain('NO_THREAT');
      expect(ThreatStatus).toContain('FAILED');
      expect(ThreatStatus).toContain('MASTER_COPY_CHANGE');
      expect(ThreatStatus).toContain('OWNERSHIP_CHANGE');
      expect(ThreatStatus).toContain('MODULE_CHANGE');
    });

    it.each(ThreatStatus)('should validate with schema = %s', (value) => {
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
      const allValues = [
        ...RecipientStatus,
        ...BridgeStatus,
        ...ContractStatus,
        ...ThreatStatus,
      ];

      const uniqueValues = new Set(allValues);
      expect(uniqueValues.size).toBe(allValues.length);
    });
  });
});
