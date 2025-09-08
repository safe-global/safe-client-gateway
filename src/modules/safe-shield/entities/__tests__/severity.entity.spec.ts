import {
  Severity,
  SeveritySchema,
  SeverityOrder,
  getSeverityOrder,
  compareSeverity,
} from '../severity.entity';

describe('Severity', () => {
  describe('Severity enum', () => {
    it('should have correct string values', () => {
      expect(Severity.OK).toBe('OK');
      expect(Severity.INFO).toBe('INFO');
      expect(Severity.WARN).toBe('WARN');
      expect(Severity.CRITICAL).toBe('CRITICAL');
    });

    it('should have all expected values', () => {
      const values = Object.values(Severity);
      expect(values).toHaveLength(4);
      expect(values).toContain('OK');
      expect(values).toContain('INFO');
      expect(values).toContain('WARN');
      expect(values).toContain('CRITICAL');
    });
  });

  describe('SeverityOrder', () => {
    it('should have correct numeric ordering', () => {
      expect(SeverityOrder[Severity.OK]).toBe(0);
      expect(SeverityOrder[Severity.INFO]).toBe(1);
      expect(SeverityOrder[Severity.WARN]).toBe(2);
      expect(SeverityOrder[Severity.CRITICAL]).toBe(3);
    });

    it('should maintain ascending order relationship', () => {
      expect(SeverityOrder[Severity.OK]).toBeLessThan(
        SeverityOrder[Severity.INFO],
      );
      expect(SeverityOrder[Severity.INFO]).toBeLessThan(
        SeverityOrder[Severity.WARN],
      );
      expect(SeverityOrder[Severity.WARN]).toBeLessThan(
        SeverityOrder[Severity.CRITICAL],
      );
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
      expect(SeveritySchema.parse('CRITICAL')).toBe(Severity.CRITICAL);
    });
  });

  describe('getSeverityOrder', () => {
    it('should return correct numeric values', () => {
      expect(getSeverityOrder(Severity.OK)).toBe(0);
      expect(getSeverityOrder(Severity.INFO)).toBe(1);
      expect(getSeverityOrder(Severity.WARN)).toBe(2);
      expect(getSeverityOrder(Severity.CRITICAL)).toBe(3);
    });
  });

  describe('compareSeverity', () => {
    it('should compare severities correctly', () => {
      // Higher severity should return positive
      expect(compareSeverity(Severity.CRITICAL, Severity.WARN)).toBeGreaterThan(
        0,
      );
      expect(compareSeverity(Severity.WARN, Severity.INFO)).toBeGreaterThan(0);
      expect(compareSeverity(Severity.INFO, Severity.OK)).toBeGreaterThan(0);

      // Lower severity should return negative
      expect(compareSeverity(Severity.OK, Severity.INFO)).toBeLessThan(0);
      expect(compareSeverity(Severity.INFO, Severity.WARN)).toBeLessThan(0);
      expect(compareSeverity(Severity.WARN, Severity.CRITICAL)).toBeLessThan(0);

      // Same severity should return zero
      expect(compareSeverity(Severity.OK, Severity.OK)).toBe(0);
      expect(compareSeverity(Severity.CRITICAL, Severity.CRITICAL)).toBe(0);
    });

    it('should work correctly for array sorting', () => {
      const severities = [
        Severity.INFO,
        Severity.CRITICAL,
        Severity.OK,
        Severity.WARN,
      ];

      // Sort ascending (lowest first)
      const ascending = [...severities].sort(compareSeverity);
      expect(ascending).toEqual([
        Severity.OK,
        Severity.INFO,
        Severity.WARN,
        Severity.CRITICAL,
      ]);

      // Sort descending (highest first)
      const descending = [...severities].sort((a, b) => compareSeverity(b, a));
      expect(descending).toEqual([
        Severity.CRITICAL,
        Severity.WARN,
        Severity.INFO,
        Severity.OK,
      ]);
    });

    it('should handle extreme cases', () => {
      expect(compareSeverity(Severity.OK, Severity.CRITICAL)).toBe(-3);
      expect(compareSeverity(Severity.CRITICAL, Severity.OK)).toBe(3);
    });
  });

  describe('integration tests', () => {
    it('should maintain consistency between enum, order mapping, and functions', () => {
      const allSeverities = Object.values(Severity);

      // Ensure all severities have order mappings
      allSeverities.forEach((severity) => {
        expect(SeverityOrder[severity]).toBeDefined();
        expect(typeof SeverityOrder[severity]).toBe('number');
        expect(getSeverityOrder(severity)).toBe(SeverityOrder[severity]);
      });
    });

    it('should work with real-world sorting scenarios', () => {
      const analysisResults = [
        { severity: Severity.INFO, message: 'Info message' },
        { severity: Severity.CRITICAL, message: 'Critical alert' },
        { severity: Severity.OK, message: 'All good' },
        { severity: Severity.WARN, message: 'Warning message' },
        { severity: Severity.CRITICAL, message: 'Another critical' },
      ];

      // Sort by severity (highest first)
      const sorted = analysisResults.sort((a, b) =>
        compareSeverity(b.severity, a.severity),
      );

      expect(sorted[0].severity).toBe(Severity.CRITICAL);
      expect(sorted[1].severity).toBe(Severity.CRITICAL);
      expect(sorted[2].severity).toBe(Severity.WARN);
      expect(sorted[3].severity).toBe(Severity.INFO);
      expect(sorted[4].severity).toBe(Severity.OK);
    });
  });
});
