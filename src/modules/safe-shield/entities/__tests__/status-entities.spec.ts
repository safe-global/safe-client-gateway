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
    it('should have correct string values', () => {
      expect(RecipientStatus.NEW_RECIPIENT).toBe('NEW_RECIPIENT');
      expect(RecipientStatus.KNOWN_RECIPIENT).toBe('KNOWN_RECIPIENT');
    });

    it('should have all expected values', () => {
      const values = Object.values(RecipientStatus);
      expect(values).toHaveLength(2);
      expect(values).toContain('NEW_RECIPIENT');
      expect(values).toContain('KNOWN_RECIPIENT');
    });

    it.each(['NEW_RECIPIENT', 'KNOWN_RECIPIENT'] as const)(
      'should validate with schema = %s',
      (value) => {
        expect(() => RecipientStatusSchema.parse(value)).not.toThrow();
      },
    );

    it.each(['INVALID', '', null, undefined, 123] as const)(
      'should reject invalid value = %s',
      (invalidValue) => {
        expect(() => RecipientStatusSchema.parse(invalidValue)).toThrow();
      },
    );
  });

  describe('BridgeStatus', () => {
    it('should have correct string values', () => {
      expect(BridgeStatus.INCOMPATIBLE_SAFE).toBe('INCOMPATIBLE_SAFE');
      expect(BridgeStatus.MISSING_OWNERSHIP).toBe('MISSING_OWNERSHIP');
      expect(BridgeStatus.UNSUPPORTED_NETWORK).toBe('UNSUPPORTED_NETWORK');
      expect(BridgeStatus.DIFFERENT_SAFE_SETUP).toBe('DIFFERENT_SAFE_SETUP');
    });

    it('should have all expected values', () => {
      const values = Object.values(BridgeStatus);
      expect(values).toHaveLength(4);
      expect(values).toContain('INCOMPATIBLE_SAFE');
      expect(values).toContain('MISSING_OWNERSHIP');
      expect(values).toContain('UNSUPPORTED_NETWORK');
      expect(values).toContain('DIFFERENT_SAFE_SETUP');
    });

    it.each([
      'INCOMPATIBLE_SAFE',
      'MISSING_OWNERSHIP',
      'UNSUPPORTED_NETWORK',
      'DIFFERENT_SAFE_SETUP',
    ] as const)('should validate with schema = %s', (value) => {
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
    it('should have correct string values', () => {
      expect(ContractStatus.VERIFIED).toBe('VERIFIED');
      expect(ContractStatus.NOT_VERIFIED).toBe('NOT_VERIFIED');
      expect(ContractStatus.NOT_VERIFIED_BY_SAFE).toBe('NOT_VERIFIED_BY_SAFE');
      expect(ContractStatus.VERIFICATION_UNAVAILABLE).toBe(
        'VERIFICATION_UNAVAILABLE',
      );
      expect(ContractStatus.NEW_CONTRACT).toBe('NEW_CONTRACT');
      expect(ContractStatus.KNOWN_CONTRACT).toBe('KNOWN_CONTRACT');
      expect(ContractStatus.UNEXPECTED_DELEGATECALL).toBe(
        'UNEXPECTED_DELEGATECALL',
      );
    });

    it('should have all expected values', () => {
      const values = Object.values(ContractStatus);
      expect(values).toHaveLength(7);
      expect(values).toContain('VERIFIED');
      expect(values).toContain('NOT_VERIFIED');
      expect(values).toContain('NOT_VERIFIED_BY_SAFE');
      expect(values).toContain('VERIFICATION_UNAVAILABLE');
      expect(values).toContain('NEW_CONTRACT');
      expect(values).toContain('KNOWN_CONTRACT');
      expect(values).toContain('UNEXPECTED_DELEGATECALL');
    });

    it.each([
      'VERIFIED',
      'NOT_VERIFIED',
      'NOT_VERIFIED_BY_SAFE',
      'VERIFICATION_UNAVAILABLE',
      'NEW_CONTRACT',
      'KNOWN_CONTRACT',
      'UNEXPECTED_DELEGATECALL',
    ] as const)('should validate with schema = %s', (value) => {
      expect(() => ContractStatusSchema.parse(value)).not.toThrow();
    });

    it.each(['INVALID', '', null, undefined, 123] as const)(
      'should reject invalid value = %s',
      (invalidValue) => {
        expect(() => ContractStatusSchema.parse(invalidValue)).toThrow();
      },
    );

    it('should group statuses correctly by business logic', () => {
      // Contract verification group
      const verificationStatuses = [
        ContractStatus.VERIFIED,
        ContractStatus.NOT_VERIFIED,
        ContractStatus.NOT_VERIFIED_BY_SAFE,
        ContractStatus.VERIFICATION_UNAVAILABLE,
      ];

      // Contract interaction group
      const interactionStatuses = [
        ContractStatus.NEW_CONTRACT,
        ContractStatus.KNOWN_CONTRACT,
      ];

      // Delegatecall group
      const delegatecallStatuses = [ContractStatus.UNEXPECTED_DELEGATECALL];

      // Ensure all statuses are accounted for
      const allStatuses = [
        ...verificationStatuses,
        ...interactionStatuses,
        ...delegatecallStatuses,
      ];
      expect(allStatuses).toHaveLength(Object.values(ContractStatus).length);
    });
  });

  describe('ThreatStatus', () => {
    it('should have correct string values', () => {
      expect(ThreatStatus.MALICIOUS).toBe('MALICIOUS');
      expect(ThreatStatus.MODERATE).toBe('MODERATE');
      expect(ThreatStatus.NO_THREAT).toBe('NO_THREAT');
      expect(ThreatStatus.FAILED).toBe('FAILED');
      expect(ThreatStatus.MASTER_COPY_CHANGE).toBe('MASTER_COPY_CHANGE');
      expect(ThreatStatus.OWNERSHIP_CHANGE).toBe('OWNERSHIP_CHANGE');
      expect(ThreatStatus.MODULE_CHANGE).toBe('MODULE_CHANGE');
    });

    it('should have all expected values', () => {
      const values = Object.values(ThreatStatus);
      expect(values).toHaveLength(7);
      expect(values).toContain('MALICIOUS');
      expect(values).toContain('MODERATE');
      expect(values).toContain('NO_THREAT');
      expect(values).toContain('FAILED');
      expect(values).toContain('MASTER_COPY_CHANGE');
      expect(values).toContain('OWNERSHIP_CHANGE');
      expect(values).toContain('MODULE_CHANGE');
    });

    it.each([
      'MALICIOUS',
      'MODERATE',
      'NO_THREAT',
      'FAILED',
      'MASTER_COPY_CHANGE',
      'OWNERSHIP_CHANGE',
      'MODULE_CHANGE',
    ] as const)('should validate with schema = %s', (value) => {
      expect(() => ThreatStatusSchema.parse(value)).not.toThrow();
    });

    it.each(['INVALID', '', null, undefined, 123] as const)(
      'should reject invalid value = %s',
      (invalidValue) => {
        expect(() => ThreatStatusSchema.parse(invalidValue)).toThrow();
      },
    );

    it('should categorize threat types correctly', () => {
      // General threat assessment
      const generalThreats = [
        ThreatStatus.MALICIOUS,
        ThreatStatus.MODERATE,
        ThreatStatus.NO_THREAT,
        ThreatStatus.FAILED,
      ];

      // Safe-specific threats
      const safeThreats = [
        ThreatStatus.MASTER_COPY_CHANGE,
        ThreatStatus.OWNERSHIP_CHANGE,
        ThreatStatus.MODULE_CHANGE,
      ];

      // Ensure all statuses are accounted for
      const allStatuses = [...generalThreats, ...safeThreats];
      expect(allStatuses).toHaveLength(Object.values(ThreatStatus).length);
    });
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
        ...Object.values(RecipientStatus),
        ...Object.values(BridgeStatus),
        ...Object.values(ContractStatus),
        ...Object.values(ThreatStatus),
      ];

      const uniqueValues = new Set(allValues);
      expect(uniqueValues.size).toBe(allValues.length);
    });
  });
});
