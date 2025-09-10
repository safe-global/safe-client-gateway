import { Severity, SeveritySchema } from '../severity.entity';

describe('Severity', () => {
  describe('Severity enum', () => {
    it('should have correct numeri values', () => {
      expect(Severity.OK).toBe(0);
      expect(Severity.INFO).toBe(1);
      expect(Severity.WARN).toBe(2);
      expect(Severity.CRITICAL).toBe(3);
    });

    it('should have all expected values', () => {
      const values = Object.values(Severity);
      expect(values).toHaveLength(8);
      expect(values).toContain(0);
      expect(values).toContain(1);
      expect(values).toContain(2);
      expect(values).toContain(3);
      expect(values).toContain('OK');
      expect(values).toContain('INFO');
      expect(values).toContain('WARN');
      expect(values).toContain('CRITICAL');
    });
  });

  describe('SeveritySchema', () => {
    it('should validate correct severity values', () => {
      expect(() => SeveritySchema.parse('OK')).not.toThrow();
      expect(() => SeveritySchema.parse('INFO')).not.toThrow();
      expect(() => SeveritySchema.parse('WARN')).not.toThrow();
      expect(() => SeveritySchema.parse('CRITICAL')).not.toThrow();
    });

    it('should accept Severity enum values', () => {
      expect(() => SeveritySchema.parse(Severity.OK)).not.toThrow();
      expect(() => SeveritySchema.parse(Severity.INFO)).not.toThrow();
      expect(() => SeveritySchema.parse(Severity.WARN)).not.toThrow();
      expect(() => SeveritySchema.parse(Severity.CRITICAL)).not.toThrow();
    });

    it('should reject invalid values', () => {
      expect(() => SeveritySchema.parse('INVALID')).toThrow();
      expect(() => SeveritySchema.parse('')).toThrow();
      expect(() => SeveritySchema.parse(null)).toThrow();
      expect(() => SeveritySchema.parse(undefined)).toThrow();
      expect(() => SeveritySchema.parse(123)).toThrow();
    });

    it('should return parsed severity values', () => {
      expect(SeveritySchema.parse('OK')).toBe(Severity.OK);
      expect(SeveritySchema.parse('INFO')).toBe(Severity.INFO);
      expect(SeveritySchema.parse('WARN')).toBe(Severity.WARN);
      expect(SeveritySchema.parse('CRITICAL')).toBe(Severity.CRITICAL);
      expect(SeveritySchema.parse(0)).toBe(Severity.OK);
      expect(SeveritySchema.parse(1)).toBe(Severity.INFO);
      expect(SeveritySchema.parse(2)).toBe(Severity.WARN);
      expect(SeveritySchema.parse(3)).toBe(Severity.CRITICAL);
    });
  });

  describe('integration tests', () => {
    it('should work with real-world sorting scenarios', () => {
      const analysisResults = [
        { severity: Severity.INFO, message: 'Info message' },
        { severity: Severity.CRITICAL, message: 'Critical alert' },
        { severity: Severity.OK, message: 'All good' },
        { severity: Severity.WARN, message: 'Warning message' },
        { severity: Severity.CRITICAL, message: 'Another critical' },
      ];

      // Sort by severity (highest first)
      const sorted = analysisResults.sort((a, b) => b.severity - a.severity);

      expect(sorted[0].severity).toBe(Severity.CRITICAL);
      expect(sorted[1].severity).toBe(Severity.CRITICAL);
      expect(sorted[2].severity).toBe(Severity.WARN);
      expect(sorted[3].severity).toBe(Severity.INFO);
      expect(sorted[4].severity).toBe(Severity.OK);
    });
  });
});
