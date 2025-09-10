import {
  StatusGroup,
  StatusGroupSchema,
  RecipientStatusGroup,
  RecipientStatusGroupSchema,
  ContractStatusGroup,
  ContractStatusGroupSchema,
} from '../status-group.entity';

describe('StatusGroup', () => {
  describe('StatusGroup', () => {
    it('should have correct string values', () => {
      expect(StatusGroup.RECIPIENT_INTERACTION).toBe('RECIPIENT_INTERACTION');
      expect(StatusGroup.BRIDGE).toBe('BRIDGE');
      expect(StatusGroup.CONTRACT_VERIFICATION).toBe('CONTRACT_VERIFICATION');
      expect(StatusGroup.CONTRACT_INTERACTION).toBe('CONTRACT_INTERACTION');
      expect(StatusGroup.DELEGATECALL).toBe('DELEGATECALL');
      expect(StatusGroup.THREAT).toBe('THREAT');
    });

    it('should have all expected values', () => {
      const values = Object.values(StatusGroup);
      expect(values).toHaveLength(6);
      expect(values).toContain('RECIPIENT_INTERACTION');
      expect(values).toContain('BRIDGE');
      expect(values).toContain('CONTRACT_VERIFICATION');
      expect(values).toContain('CONTRACT_INTERACTION');
      expect(values).toContain('DELEGATECALL');
      expect(values).toContain('THREAT');
    });

    it('should have consistent naming convention', () => {
      const values = Object.values(StatusGroup);
      values.forEach((value) => {
        // All values should be uppercase with underscores
        expect(value).toMatch(/^[A-Z_]+$/);
        // Should not start or end with underscore
        expect(value).not.toMatch(/^_|_$/);
      });
    });
  });

  describe('RecipientStatusGroup', () => {
    it('should have correct string values', () => {
      expect(RecipientStatusGroup.RECIPIENT_INTERACTION).toBe(
        'RECIPIENT_INTERACTION',
      );
      expect(RecipientStatusGroup.BRIDGE).toBe('BRIDGE');
    });

    it('should have all expected values', () => {
      const values = Object.values(RecipientStatusGroup);
      expect(values).toHaveLength(2);
      expect(values).toContain('RECIPIENT_INTERACTION');
      expect(values).toContain('BRIDGE');
    });
  });

  describe('ContractStatusGroup', () => {
    it('should have correct string values', () => {
      expect(ContractStatusGroup.CONTRACT_VERIFICATION).toBe(
        'CONTRACT_VERIFICATION',
      );
      expect(ContractStatusGroup.CONTRACT_INTERACTION).toBe(
        'CONTRACT_INTERACTION',
      );
      expect(ContractStatusGroup.DELEGATECALL).toBe('DELEGATECALL');
    });

    it('should have all expected values', () => {
      const values = Object.values(ContractStatusGroup);
      expect(values).toHaveLength(3);
      expect(values).toContain('CONTRACT_VERIFICATION');
      expect(values).toContain('CONTRACT_INTERACTION');
      expect(values).toContain('DELEGATECALL');
    });
  });

  describe('StatusGroupSchema', () => {
    it.each([
      'RECIPIENT_INTERACTION',
      'BRIDGE',
      'CONTRACT_VERIFICATION',
      'CONTRACT_INTERACTION',
      'DELEGATECALL',
      'THREAT',
    ] as const)('should validate correct status group value = %s', (value) => {
      expect(() => StatusGroupSchema.parse(value)).not.toThrow();
    });

    it.each([
      StatusGroup.RECIPIENT_INTERACTION,
      StatusGroup.BRIDGE,
      StatusGroup.CONTRACT_VERIFICATION,
      StatusGroup.CONTRACT_INTERACTION,
      StatusGroup.DELEGATECALL,
      StatusGroup.THREAT,
    ] as const)('should accept StatusGroup enum value = %s', (value) => {
      expect(() => StatusGroupSchema.parse(value)).not.toThrow();
    });

    it.each([
      'INVALID_GROUP',
      '',
      'RECIPIENT_ACTIVITY',
      null,
      undefined,
      123,
    ] as const)('should reject invalid value = %s', (invalidValue) => {
      expect(() => StatusGroupSchema.parse(invalidValue)).toThrow();
    });
  });

  it('should return parsed status group values', () => {
    expect(StatusGroupSchema.parse('RECIPIENT_INTERACTION')).toBe(
      StatusGroup.RECIPIENT_INTERACTION,
    );
    expect(StatusGroupSchema.parse('THREAT')).toBe(StatusGroup.THREAT);
  });
});

describe('RecipientStatusGroupSchema', () => {
  it.each(['RECIPIENT_INTERACTION', 'BRIDGE'] as const)(
    'should validate recipient status group = %s',
    (value) => {
      expect(() => RecipientStatusGroupSchema.parse(value)).not.toThrow();
    },
  );
  it.each([
    RecipientStatusGroup.RECIPIENT_INTERACTION,
    RecipientStatusGroup.BRIDGE,
  ] as const)('should accept RecipientStatusGroup enum value = %s', (value) => {
    expect(() => RecipientStatusGroupSchema.parse(value)).not.toThrow();
  });

  it.each(['CONTRACT_VERIFICATION', 'DELEGATECALL', 'THREAT'] as const)(
    'should reject non-recipient status group = %s',
    (invalidValue) => {
      expect(() => RecipientStatusGroupSchema.parse(invalidValue)).toThrow();
    },
  );

  it('should return parsed recipient status group values', () => {
    expect(RecipientStatusGroupSchema.parse('RECIPIENT_INTERACTION')).toBe(
      RecipientStatusGroup.RECIPIENT_INTERACTION,
    );
    expect(RecipientStatusGroupSchema.parse('BRIDGE')).toBe(
      RecipientStatusGroup.BRIDGE,
    );
  });
});

describe('ContractStatusGroupSchema', () => {
  it.each([
    'CONTRACT_VERIFICATION',
    'CONTRACT_INTERACTION',
    'DELEGATECALL',
  ] as const)('should validate contract status group = %s', (value) => {
    expect(() => ContractStatusGroupSchema.parse(value)).not.toThrow();
  });

  it.each([
    ContractStatusGroup.CONTRACT_VERIFICATION,
    ContractStatusGroup.CONTRACT_INTERACTION,
    ContractStatusGroup.DELEGATECALL,
  ] as const)('should accept ContractStatusGroup enum value = %s', (value) => {
    expect(() => ContractStatusGroupSchema.parse(value)).not.toThrow();
  });

  it.each(['RECIPIENT_INTERACTION', 'BRIDGE', 'THREAT'] as const)(
    'should reject non-contract status group = %s',
    (invalidValue) => {
      expect(() => ContractStatusGroupSchema.parse(invalidValue)).toThrow();
    },
  );

  it('should return parsed contract status group values', () => {
    expect(ContractStatusGroupSchema.parse('CONTRACT_VERIFICATION')).toBe(
      ContractStatusGroup.CONTRACT_VERIFICATION,
    );
    expect(ContractStatusGroupSchema.parse('CONTRACT_INTERACTION')).toBe(
      ContractStatusGroup.CONTRACT_INTERACTION,
    );
    expect(ContractStatusGroupSchema.parse('DELEGATECALL')).toBe(
      ContractStatusGroup.DELEGATECALL,
    );
  });
});
