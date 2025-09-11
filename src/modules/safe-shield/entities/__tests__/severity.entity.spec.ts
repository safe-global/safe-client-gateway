import {
  Severity,
  SeveritySchema,
  SeverityOrder,
  getSeverityOrder,
  compareSeverity,
} from '../severity.entity';

describe('Severity', () => {
  describe('Severity array', () => {
    it('should have correct string values in order', () => {
      expect(Severity).toEqual(['OK', 'INFO', 'WARN', 'CRITICAL']);
    });
  });

  describe('SeverityOrder', () => {
    it('should have correct numeric order values', () => {
      expect(SeverityOrder.OK).toBe(0);
      expect(SeverityOrder.INFO).toBe(1);
      expect(SeverityOrder.WARN).toBe(2);
      expect(SeverityOrder.CRITICAL).toBe(3);
    });
  });

  describe('getSeverityOrder', () => {
    it('should return correct order for each severity', () => {
      expect(getSeverityOrder('OK')).toBe(0);
      expect(getSeverityOrder('INFO')).toBe(1);
      expect(getSeverityOrder('WARN')).toBe(2);
      expect(getSeverityOrder('CRITICAL')).toBe(3);
    });
  });

  describe('compareSeverity', () => {
    it('should compare severities correctly', () => {
      // OK < INFO
      expect(compareSeverity('OK', 'INFO')).toBeLessThan(0);
      // INFO < WARN
      expect(compareSeverity('INFO', 'WARN')).toBeLessThan(0);
      // WARN < CRITICAL
      expect(compareSeverity('WARN', 'CRITICAL')).toBeLessThan(0);
      // CRITICAL > OK
      expect(compareSeverity('CRITICAL', 'OK')).toBeGreaterThan(0);
      // Same values
      expect(compareSeverity('INFO', 'INFO')).toBe(0);
    });
  });

  describe('SeveritySchema', () => {
    it.each(Severity)(
      'should validate correct severity value = %s',
      (severity) => {
        expect(() => SeveritySchema.parse(severity)).not.toThrow();
      },
    );

    it.each(['INVALID', '', null, undefined, 123, 0, 1, 2, 3] as const)(
      'should reject invalid value = %s',
      (invalidSeverity) => {
        expect(() => SeveritySchema.parse(invalidSeverity)).toThrow();
      },
    );

    it.each(Severity)(
      'should return parsed severity values for valid strings = %s',
      (severity) => {
        expect(SeveritySchema.parse(severity)).toBe(severity);
      },
    );
  });

  describe('integration tests', () => {
    it('should work with real-world sorting scenarios', () => {
      const analysisResults = [
        { severity: 'INFO' as const, message: 'Info message' },
        { severity: 'CRITICAL' as const, message: 'Critical alert' },
        { severity: 'OK' as const, message: 'All good' },
        { severity: 'WARN' as const, message: 'Warning message' },
        { severity: 'CRITICAL' as const, message: 'Another critical' },
      ];

      // Sort by severity (highest first)
      const sorted = analysisResults.sort((a, b) =>
        compareSeverity(b.severity, a.severity),
      );

      expect(sorted[0].severity).toBe('CRITICAL');
      expect(sorted[1].severity).toBe('CRITICAL');
      expect(sorted[2].severity).toBe('WARN');
      expect(sorted[3].severity).toBe('INFO');
      expect(sorted[4].severity).toBe('OK');
    });
  });
});
