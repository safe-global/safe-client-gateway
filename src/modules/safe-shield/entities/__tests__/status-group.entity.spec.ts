import {
  StatusGroup,
  StatusGroupSchema,
  RecipientStatusGroup,
  RecipientStatusGroupSchema,
  ContractStatusGroup,
  ContractStatusGroupSchema,
  ThreatStatusGroup,
  ThreatStatusGroupSchema,
} from '../status-group.entity';

describe('StatusGroup', () => {
  const statusGroup = Object.values(StatusGroup);
  const recipientStatusGroup = Object.values(RecipientStatusGroup);
  const contractStatusGroup = Object.values(ContractStatusGroup);
  const threatStatusGroup = Object.values(ThreatStatusGroup);

  describe('StatusGroup', () => {
    it('should have all expected values', () => {
      expect(statusGroup).toHaveLength(9);
      expect(statusGroup).toContain('RECIPIENT_INTERACTION');
      expect(statusGroup).toContain('RECIPIENT_ACTIVITY');
      expect(statusGroup).toContain('BRIDGE');
      expect(statusGroup).toContain('CONTRACT_VERIFICATION');
      expect(statusGroup).toContain('CONTRACT_INTERACTION');
      expect(statusGroup).toContain('DELEGATECALL');
      expect(statusGroup).toContain('THREAT');
      expect(statusGroup).toContain('BALANCE_CHANGE');
      expect(statusGroup).toContain('FALLBACK_HANDLER');
    });

    it('should have consistent naming convention', () => {
      statusGroup.forEach((value) => {
        // All values should be uppercase with underscores
        expect(value).toMatch(/^[A-Z_]+$/);
        // Should not start or end with underscore
        expect(value).not.toMatch(/^_|_$/);
      });
    });
  });

  describe('RecipientStatusGroup', () => {
    it('should have all expected values', () => {
      expect(recipientStatusGroup).toHaveLength(3);
      expect(recipientStatusGroup).toContain('RECIPIENT_INTERACTION');
      expect(recipientStatusGroup).toContain('RECIPIENT_ACTIVITY');
      expect(recipientStatusGroup).toContain('BRIDGE');
    });
  });

  describe('ContractStatusGroup', () => {
    it('should have all expected values', () => {
      expect(contractStatusGroup).toHaveLength(4);
      expect(contractStatusGroup).toContain('CONTRACT_VERIFICATION');
      expect(contractStatusGroup).toContain('CONTRACT_INTERACTION');
      expect(contractStatusGroup).toContain('DELEGATECALL');
      expect(contractStatusGroup).toContain('FALLBACK_HANDLER');
    });
  });

  describe('ThreatStatusGroup', () => {
    it('should have all expected values', () => {
      expect(threatStatusGroup).toHaveLength(2);
      expect(threatStatusGroup).toContain('THREAT');
      expect(threatStatusGroup).toContain('BALANCE_CHANGE');
    });
  });

  describe('StatusGroupSchema', () => {
    it.each(statusGroup)(
      'should validate correct status group value = %s',
      (value) => {
        expect(() => StatusGroupSchema.parse(value)).not.toThrow();
      },
    );

    it.each(['INVALID_GROUP', '', null, undefined, 123] as const)(
      'should reject invalid value = %s',
      (invalidValue) => {
        expect(() => StatusGroupSchema.parse(invalidValue)).toThrow();
      },
    );
  });

  describe('RecipientStatusGroupSchema', () => {
    it.each(recipientStatusGroup)(
      'should validate recipient status group = %s',
      (value) => {
        expect(() => RecipientStatusGroupSchema.parse(value)).not.toThrow();
      },
    );

    it.each([...contractStatusGroup, ...threatStatusGroup] as const)(
      'should reject non-recipient status group = %s',
      (invalidValue) => {
        expect(() => RecipientStatusGroupSchema.parse(invalidValue)).toThrow();
      },
    );
  });

  describe('ContractStatusGroupSchema', () => {
    it.each(contractStatusGroup)(
      'should validate contract status group = %s',
      (value) => {
        expect(() => ContractStatusGroupSchema.parse(value)).not.toThrow();
      },
    );

    it.each([...recipientStatusGroup, ...threatStatusGroup] as const)(
      'should reject non-contract status group = %s',
      (invalidValue) => {
        expect(() => ContractStatusGroupSchema.parse(invalidValue)).toThrow();
      },
    );
  });

  describe('ThreatStatusGroupSchema', () => {
    it.each(threatStatusGroup)(
      'should validate threat status group = %s',
      (value) => {
        expect(() => ThreatStatusGroupSchema.parse(value)).not.toThrow();
      },
    );

    it.each([...recipientStatusGroup, ...contractStatusGroup] as const)(
      'should reject non-threat status group = %s',
      (invalidValue) => {
        expect(() => ThreatStatusGroupSchema.parse(invalidValue)).toThrow();
      },
    );
  });
});
