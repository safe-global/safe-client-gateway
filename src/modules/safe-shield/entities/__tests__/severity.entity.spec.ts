import {
  Severity,
  SeveritySchema,
  compareSeverity,
  compareSeverityString,
} from '../severity.entity';

describe('Severity', () => {
  describe('Severity enum', () => {
    it('should have correct numeric values', () => {
      expect(Severity.OK).toBe(0);
      expect(Severity.INFO).toBe(1);
      expect(Severity.WARN).toBe(2);
      expect(Severity.CRITICAL).toBe(3);
    });
  });

  describe('compareSeverity', () => {
    it('should compare severities correctly', () => {
      // OK < INFO
      expect(compareSeverity(Severity.OK, Severity.INFO)).toBeLessThan(0);
      // INFO < WARN
      expect(compareSeverity(Severity.INFO, Severity.WARN)).toBeLessThan(0);
      // WARN < CRITICAL
      expect(compareSeverity(Severity.WARN, Severity.CRITICAL)).toBeLessThan(0);
      // CRITICAL > OK
      expect(compareSeverity(Severity.CRITICAL, Severity.OK)).toBeGreaterThan(
        0,
      );
      // Same values
      expect(compareSeverity(Severity.INFO, Severity.INFO)).toBe(0);
    });
  });

  describe('compareSeverityStrings', () => {
    it('should compare severities correctly', () => {
      // OK < INFO
      expect(compareSeverityString('OK', 'INFO')).toBeLessThan(0);
      // INFO < WARN
      expect(compareSeverityString('INFO', 'WARN')).toBeLessThan(0);
      // WARN < CRITICAL
      expect(compareSeverityString('WARN', 'CRITICAL')).toBeLessThan(0);
      // CRITICAL > OK
      expect(compareSeverityString('CRITICAL', 'OK')).toBeGreaterThan(0);
      // Same values
      expect(compareSeverityString('INFO', 'INFO')).toBe(0);
    });
  });

  describe('SeveritySchema', () => {
    it.each(['OK', 'INFO', 'WARN', 'CRITICAL'])(
      'should validate correct severity string = %s',
      (severityString) => {
        expect(() => SeveritySchema.parse(severityString)).not.toThrow();
        expect(SeveritySchema.parse(severityString)).toBe(severityString);
      },
    );

    it.each(['INVALID', '', null, undefined, 123, 0, 1, 2, 3] as const)(
      'should reject invalid value = %s',
      (invalidSeverity) => {
        expect(() => SeveritySchema.parse(invalidSeverity)).toThrow();
      },
    );
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
