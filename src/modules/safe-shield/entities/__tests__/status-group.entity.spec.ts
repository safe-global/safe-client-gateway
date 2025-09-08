import { StatusGroup, StatusGroupSchema } from '../status-group.entity';

describe('StatusGroup', () => {
  describe('StatusGroup enum', () => {
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

  describe('StatusGroupSchema', () => {
    it('should validate correct status group values', () => {
      expect(() =>
        StatusGroupSchema.parse('RECIPIENT_INTERACTION'),
      ).not.toThrow();
      expect(() => StatusGroupSchema.parse('BRIDGE')).not.toThrow();
      expect(() =>
        StatusGroupSchema.parse('CONTRACT_VERIFICATION'),
      ).not.toThrow();
      expect(() =>
        StatusGroupSchema.parse('CONTRACT_INTERACTION'),
      ).not.toThrow();
      expect(() => StatusGroupSchema.parse('DELEGATECALL')).not.toThrow();
      expect(() => StatusGroupSchema.parse('THREAT')).not.toThrow();
    });

    it('should accept StatusGroup enum values', () => {
      expect(() =>
        StatusGroupSchema.parse(StatusGroup.RECIPIENT_INTERACTION),
      ).not.toThrow();
      expect(() => StatusGroupSchema.parse(StatusGroup.BRIDGE)).not.toThrow();
      expect(() =>
        StatusGroupSchema.parse(StatusGroup.CONTRACT_VERIFICATION),
      ).not.toThrow();
      expect(() =>
        StatusGroupSchema.parse(StatusGroup.CONTRACT_INTERACTION),
      ).not.toThrow();
      expect(() =>
        StatusGroupSchema.parse(StatusGroup.DELEGATECALL),
      ).not.toThrow();
      expect(() => StatusGroupSchema.parse(StatusGroup.THREAT)).not.toThrow();
    });

    it('should reject invalid values', () => {
      expect(() => StatusGroupSchema.parse('INVALID_GROUP')).toThrow();
      expect(() => StatusGroupSchema.parse('')).toThrow();
      expect(() => StatusGroupSchema.parse('ADDRESS_BOOK')).toThrow(); // Removed from spec
      expect(() => StatusGroupSchema.parse('RECIPIENT_ACTIVITY')).toThrow(); // Removed from spec
      expect(() => StatusGroupSchema.parse(null)).toThrow();
      expect(() => StatusGroupSchema.parse(undefined)).toThrow();
      expect(() => StatusGroupSchema.parse(123)).toThrow();
    });

    it('should return parsed status group values', () => {
      expect(StatusGroupSchema.parse('RECIPIENT_INTERACTION')).toBe(
        StatusGroup.RECIPIENT_INTERACTION,
      );
      expect(StatusGroupSchema.parse('THREAT')).toBe(StatusGroup.THREAT);
    });
  });
});
