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
  describe('StatusGroup', () => {
    it('should have all expected values', () => {
      expect(StatusGroup).toHaveLength(9);
      expect(StatusGroup).toContain('RECIPIENT_INTERACTION');
      expect(StatusGroup).toContain('RECIPIENT_ACTIVITY');
      expect(StatusGroup).toContain('BRIDGE');
      expect(StatusGroup).toContain('CONTRACT_VERIFICATION');
      expect(StatusGroup).toContain('CONTRACT_INTERACTION');
      expect(StatusGroup).toContain('DELEGATECALL');
      expect(StatusGroup).toContain('THREAT');
      expect(StatusGroup).toContain('BALANCE_CHANGE');
      expect(StatusGroup).toContain('FALLBACK_HANDLER');
    });

    it('should have consistent naming convention', () => {
      StatusGroup.forEach((value) => {
        // All values should be uppercase with underscores
        expect(value).toMatch(/^[A-Z_]+$/);
        // Should not start or end with underscore
        expect(value).not.toMatch(/^_|_$/);
      });
    });
  });

  describe('RecipientStatusGroup', () => {
    it('should have all expected values', () => {
      expect(RecipientStatusGroup).toHaveLength(3);
      expect(RecipientStatusGroup).toContain('RECIPIENT_INTERACTION');
      expect(RecipientStatusGroup).toContain('RECIPIENT_ACTIVITY');
      expect(RecipientStatusGroup).toContain('BRIDGE');
    });
  });

  describe('ContractStatusGroup', () => {
    it('should have all expected values', () => {
      expect(ContractStatusGroup).toHaveLength(4);
      expect(ContractStatusGroup).toContain('CONTRACT_VERIFICATION');
      expect(ContractStatusGroup).toContain('CONTRACT_INTERACTION');
      expect(ContractStatusGroup).toContain('DELEGATECALL');
      expect(ContractStatusGroup).toContain('FALLBACK_HANDLER');
    });
  });

  describe('ThreatStatusGroup', () => {
    it('should have all expected values', () => {
      expect(ThreatStatusGroup).toHaveLength(2);
      expect(ThreatStatusGroup).toContain('THREAT');
      expect(ThreatStatusGroup).toContain('BALANCE_CHANGE');
    });
  });

  describe('StatusGroupSchema', () => {
    it.each(StatusGroup)(
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
});

describe('RecipientStatusGroupSchema', () => {
  it.each(RecipientStatusGroup)(
    'should validate recipient status group = %s',
    (value) => {
      expect(() => RecipientStatusGroupSchema.parse(value)).not.toThrow();
    },
  );

  it.each([...ContractStatusGroup, ...ThreatStatusGroup] as const)(
    'should reject non-recipient status group = %s',
    (invalidValue) => {
      expect(() => RecipientStatusGroupSchema.parse(invalidValue)).toThrow();
    },
  );
});

describe('ContractStatusGroupSchema', () => {
  it.each(ContractStatusGroup)(
    'should validate contract status group = %s',
    (value) => {
      expect(() => ContractStatusGroupSchema.parse(value)).not.toThrow();
    },
  );

  it.each([...RecipientStatusGroup, ...ThreatStatusGroup] as const)(
    'should reject non-contract status group = %s',
    (invalidValue) => {
      expect(() => ContractStatusGroupSchema.parse(invalidValue)).toThrow();
    },
  );
});

describe('ThreatStatusGroupSchema', () => {
  it.each(ThreatStatusGroup)(
    'should validate threat status group = %s',
    (value) => {
      expect(() => ThreatStatusGroupSchema.parse(value)).not.toThrow();
    },
  );

  it.each([...RecipientStatusGroup, ...ContractStatusGroup] as const)(
    'should reject non-threat status group = %s',
    (invalidValue) => {
      expect(() => ThreatStatusGroupSchema.parse(invalidValue)).toThrow();
    },
  );
});
