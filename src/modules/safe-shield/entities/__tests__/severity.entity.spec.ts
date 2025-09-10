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
    it.each(['OK', 'INFO', 'WARN', 'CRITICAL'] as const)(
      'should validate correct severity value = %s',
      (severity) => {
        expect(() => SeveritySchema.parse(severity)).not.toThrow();
      },
    );

    it.each([
      Severity.OK,
      Severity.INFO,
      Severity.WARN,
      Severity.CRITICAL,
    ] as const)('should accept Severity enum value = %s', (severity) => {
      expect(() => SeveritySchema.parse(severity)).not.toThrow();
    });

    it.each(['INVALID', '', null, undefined, 123] as const)(
      'should reject invalid value = %s',
      (invalidSeverity) => {
        expect(() => SeveritySchema.parse(invalidSeverity)).toThrow();
      },
    );

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
