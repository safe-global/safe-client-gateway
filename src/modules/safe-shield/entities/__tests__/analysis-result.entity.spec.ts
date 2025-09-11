import {
  AnalysisResultBaseSchema,
  RecipientAnalysisResultSchema,
  ContractAnalysisResultSchema,
  ThreatAnalysisResultSchema,
  AnalysisStatusSchema,
  type ContractAnalysisResult,
} from '../analysis-result.entity';
import { Severity } from '../severity.entity';
import { RecipientStatus } from '../recipient-status.entity';
import { BridgeStatus } from '../bridge-status.entity';
import { ContractStatus } from '../contract-status.entity';
import { ThreatStatus } from '../threat-status.entity';
import {
  recipientAnalysisResultBuilder,
  contractAnalysisResultBuilder,
  threatAnalysisResultBuilder,
} from './builders/analysis-result.builder';

describe('AnalysisResult', () => {
  describe('AnalysisResult interface', () => {
    it('should enforce correct structure for recipient analysis', () => {
      const result = recipientAnalysisResultBuilder()
        .with('severity', Severity.WARN)
        .with('type', 'NEW_RECIPIENT')
        .build();

      expect(result.severity).toBe(Severity.WARN);
      expect(result.type).toBe('NEW_RECIPIENT');
      expect(result.title).toStrictEqual(expect.any(String));
      expect(result.title).not.toHaveLength(0);
      expect(result.description).toStrictEqual(expect.any(String));
      expect(result.description).not.toHaveLength(0);
    });

    it('should enforce correct structure for contract analysis', () => {
      const result = contractAnalysisResultBuilder()
        .with('severity', Severity.CRITICAL)
        .with('type', 'NOT_VERIFIED')
        .build();

      expect(result.severity).toBe(Severity.CRITICAL);
      expect(result.type).toBe('NOT_VERIFIED');
      expect(result.title).toStrictEqual(expect.any(String));
      expect(result.title).not.toHaveLength(0);
      expect(result.description).toStrictEqual(expect.any(String));
      expect(result.description).not.toHaveLength(0);
    });

    it('should enforce correct structure for threat analysis', () => {
      const result = threatAnalysisResultBuilder()
        .with('severity', Severity.CRITICAL)
        .with('type', ThreatStatus.MALICIOUS)
        .build();

      expect(result.severity).toBe(Severity.CRITICAL);
      expect(result.type).toBe(ThreatStatus.MALICIOUS);
      expect(result.title).toStrictEqual(expect.any(String));
      expect(result.title).not.toHaveLength(0);
      expect(result.description).toStrictEqual(expect.any(String));
      expect(result.description).not.toHaveLength(0);
    });
  });

  describe('AnalysisStatusSchema', () => {
    it.each(RecipientStatus)(
      'should validate all recipient status values = %s',
      (value) => {
        expect(() => AnalysisStatusSchema.parse(value)).not.toThrow();
      },
    );

    it.each(BridgeStatus)(
      'should validate all bridge status values = %s',
      (value) => {
        expect(() => AnalysisStatusSchema.parse(value)).not.toThrow();
      },
    );

    it.each(ContractStatus)(
      'should validate all contract status values = %s',
      (value) => {
        expect(() => AnalysisStatusSchema.parse(value)).not.toThrow();
      },
    );

    it('should validate all threat status values', () => {
      expect(() =>
        AnalysisStatusSchema.parse(ThreatStatus.MALICIOUS),
      ).not.toThrow();
      expect(() =>
        AnalysisStatusSchema.parse(ThreatStatus.NO_THREAT),
      ).not.toThrow();
      expect(() =>
        AnalysisStatusSchema.parse(ThreatStatus.MODULE_CHANGE),
      ).not.toThrow();
    });

    it('should reject invalid status values', () => {
      expect(() => AnalysisStatusSchema.parse('INVALID_STATUS')).toThrow();
      expect(() => AnalysisStatusSchema.parse('')).toThrow();
      expect(() => AnalysisStatusSchema.parse(null)).toThrow();
      expect(() => AnalysisStatusSchema.parse(123)).toThrow();
    });
  });

  describe('AnalysisResultBaseSchema', () => {
    const validBaseResult = recipientAnalysisResultBuilder().build();

    it('should validate correct analysis result structure', () => {
      expect(() =>
        AnalysisResultBaseSchema.parse(validBaseResult),
      ).not.toThrow();
    });

    it('should reject missing required fields', () => {
      expect(() => AnalysisResultBaseSchema.parse({})).toThrow();
      expect(() =>
        AnalysisResultBaseSchema.parse({ severity: Severity.OK }),
      ).toThrow();
      expect(() =>
        AnalysisResultBaseSchema.parse({
          severity: Severity.OK,
          type: 'NEW_RECIPIENT',
        }),
      ).toThrow();
    });

    it('should reject empty title or description', () => {
      expect(() =>
        AnalysisResultBaseSchema.parse(
          recipientAnalysisResultBuilder().with('title', '').build(),
        ),
      ).toThrow();

      expect(() =>
        AnalysisResultBaseSchema.parse(
          recipientAnalysisResultBuilder().with('description', '').build(),
        ),
      ).toThrow();
    });

    it('should reject invalid severity', () => {
      expect(() =>
        AnalysisResultBaseSchema.parse({
          ...validBaseResult,
          severity: 'INVALID_SEVERITY',
        }),
      ).toThrow();
    });

    it('should reject invalid status type', () => {
      expect(() =>
        AnalysisResultBaseSchema.parse({
          ...validBaseResult,
          type: 'INVALID_TYPE',
        }),
      ).toThrow();
    });
  });

  describe('RecipientAnalysisResultSchema', () => {
    it('should validate recipient status types', () => {
      const recipientResult = recipientAnalysisResultBuilder().build();

      expect(() =>
        RecipientAnalysisResultSchema.parse(recipientResult),
      ).not.toThrow();
    });

    it('should validate bridge status types', () => {
      const bridgeResult = recipientAnalysisResultBuilder()
        .with('type', 'INCOMPATIBLE_SAFE')
        .build();

      expect(() =>
        RecipientAnalysisResultSchema.parse(bridgeResult),
      ).not.toThrow();
    });

    it('should reject contract status types', () => {
      const contractResult = contractAnalysisResultBuilder().build();

      expect(() =>
        RecipientAnalysisResultSchema.parse(contractResult),
      ).toThrow();
    });

    it('should reject threat status types', () => {
      const threatResult = threatAnalysisResultBuilder().build();

      expect(() => RecipientAnalysisResultSchema.parse(threatResult)).toThrow();
    });
  });

  describe('ContractAnalysisResultSchema', () => {
    it('should validate contract status types', () => {
      const contractResult = contractAnalysisResultBuilder().build();

      expect(() =>
        ContractAnalysisResultSchema.parse(contractResult),
      ).not.toThrow();
    });

    it('should reject recipient status types', () => {
      const recipientResult = recipientAnalysisResultBuilder().build();

      expect(() =>
        ContractAnalysisResultSchema.parse(recipientResult),
      ).toThrow();
    });

    it('should reject threat status types', () => {
      const threatResult = threatAnalysisResultBuilder().build();

      expect(() => ContractAnalysisResultSchema.parse(threatResult)).toThrow();
    });
  });

  describe('ThreatAnalysisResultSchema', () => {
    it('should validate threat status types', () => {
      const threatResult = threatAnalysisResultBuilder().build();

      expect(() =>
        ThreatAnalysisResultSchema.parse(threatResult),
      ).not.toThrow();
    });

    it('should reject contract status types', () => {
      const contractResult = contractAnalysisResultBuilder().build();

      expect(() => ThreatAnalysisResultSchema.parse(contractResult)).toThrow();
    });

    it('should reject recipient status types', () => {
      const recipientResult = recipientAnalysisResultBuilder().build();

      expect(() => ThreatAnalysisResultSchema.parse(recipientResult)).toThrow();
    });
  });

  describe('real-world scenarios', () => {
    it('should handle multiple analysis results correctly', () => {
      const results: Array<ContractAnalysisResult> = [
        contractAnalysisResultBuilder().with('type', 'KNOWN_CONTRACT').build(),
        contractAnalysisResultBuilder().with('type', 'VERIFIED').build(),
        contractAnalysisResultBuilder()
          .with('type', 'UNEXPECTED_DELEGATECALL')
          .build(),
      ];

      // Verify all results have the required structure
      results.forEach((result) => {
        expect(result).toHaveProperty('severity');
        expect(result).toHaveProperty('type');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('description');
        expect(typeof result.title).toBe('string');
        expect(typeof result.description).toBe('string');
      });
    });

    it('should work with sorting by severity', () => {
      const results = [
        contractAnalysisResultBuilder()
          .with('severity', Severity.INFO)
          .with('type', 'KNOWN_CONTRACT')
          .build(),
        contractAnalysisResultBuilder()
          .with('severity', Severity.CRITICAL)
          .with('type', 'UNEXPECTED_DELEGATECALL')
          .build(),
        contractAnalysisResultBuilder()
          .with('severity', Severity.WARN)
          .with('type', 'NOT_VERIFIED_BY_SAFE')
          .build(),
      ];

      const sorted = results.sort((a, b) => b.severity - a.severity);

      expect(sorted[0].severity).toBe(Severity.CRITICAL);
      expect(sorted[1].severity).toBe(Severity.WARN);
      expect(sorted[2].severity).toBe(Severity.INFO);
    });
  });
});
