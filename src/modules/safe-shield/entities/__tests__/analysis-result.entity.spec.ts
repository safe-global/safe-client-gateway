import {
  AnalysisResultBaseSchema,
  RecipientAnalysisResultSchema,
  ContractAnalysisResultSchema,
  ThreatAnalysisResultSchema,
  AnalysisStatusSchema,
  type ContractAnalysisResult,
  CommonStatus,
} from '../analysis-result.entity';
import { compareSeverityString } from '../severity.entity';
import { RecipientStatus } from '../recipient-status.entity';
import { BridgeStatus } from '../bridge-status.entity';
import { ContractStatus } from '../contract-status.entity';
import { ThreatStatus } from '../threat-status.entity';
import {
  recipientAnalysisResultBuilder,
  contractAnalysisResultBuilder,
  threatAnalysisResultBuilder,
  masterCopyChangeThreatBuilder,
  maliciousOrModerateThreatBuilder,
} from './builders/analysis-result.builder';
import { omit } from 'lodash';

describe('AnalysisResult', () => {
  describe('AnalysisResult interface', () => {
    it('should enforce correct structure for recipient analysis', () => {
      const result = recipientAnalysisResultBuilder()
        .with('severity', 'WARN')
        .with('type', 'NEW_RECIPIENT')
        .build();

      expect(result.severity).toBe('WARN');
      expect(result.type).toBe('NEW_RECIPIENT');
      expect(result.title).toStrictEqual(expect.any(String));
      expect(result.title).not.toHaveLength(0);
      expect(result.description).toStrictEqual(expect.any(String));
      expect(result.description).not.toHaveLength(0);
    });

    it('should enforce correct structure for contract analysis', () => {
      const result = contractAnalysisResultBuilder()
        .with('severity', 'CRITICAL')
        .with('type', 'NOT_VERIFIED')
        .build();

      expect(result.severity).toBe('CRITICAL');
      expect(result.type).toBe('NOT_VERIFIED');
      expect(result.title).toStrictEqual(expect.any(String));
      expect(result.title).not.toHaveLength(0);
      expect(result.description).toStrictEqual(expect.any(String));
      expect(result.description).not.toHaveLength(0);
    });

    it('should enforce correct structure for threat analysis', () => {
      const result = threatAnalysisResultBuilder()
        .with('severity', 'CRITICAL')
        .with('type', 'MALICIOUS')
        .build();

      expect(result.severity).toBe('CRITICAL');
      expect(result.type).toBe('MALICIOUS');
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

    it.each(ThreatStatus)(
      'should validate all threat status values = %s',
      (value) => {
        expect(() => AnalysisStatusSchema.parse(value)).not.toThrow();
      },
    );

    it.each(CommonStatus)(
      'should validate all recipient status values = %s',
      (value) => {
        expect(() => AnalysisStatusSchema.parse(value)).not.toThrow();
      },
    );

    it.each(['INVALID_STATUS', '', null, undefined, 123] as const)(
      'should reject invalid status values = %s',
      (value) => {
        expect(() => AnalysisStatusSchema.parse(value)).toThrow();
      },
    );
  });

  describe('AnalysisResultBaseSchema', () => {
    const validBaseResult = recipientAnalysisResultBuilder().build();

    it('should validate correct analysis result structure', () => {
      expect(() =>
        AnalysisResultBaseSchema.parse(validBaseResult),
      ).not.toThrow();
    });

    it('should validate common status FAILED across all analysis types', () => {
      const failedRecipientResult = recipientAnalysisResultBuilder()
        .with('type', 'FAILED')
        .build();
      expect(() =>
        AnalysisResultBaseSchema.parse(failedRecipientResult),
      ).not.toThrow();

      const failedContractResult = contractAnalysisResultBuilder()
        .with('type', 'FAILED')
        .build();
      expect(() =>
        AnalysisResultBaseSchema.parse(failedContractResult),
      ).not.toThrow();

      const failedThreatResult = threatAnalysisResultBuilder()
        .with('type', 'FAILED')
        .build();
      expect(() =>
        AnalysisResultBaseSchema.parse(failedThreatResult),
      ).not.toThrow();
    });

    it('should reject missing required fields', () => {
      expect(() => AnalysisResultBaseSchema.parse({})).toThrow();
      expect(() =>
        AnalysisResultBaseSchema.parse({ severity: 'OK' }),
      ).toThrow();
      expect(() =>
        AnalysisResultBaseSchema.parse({
          severity: 'OK',
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

    it('should validate bridge status with targetChainId', () => {
      const bridgeResult = {
        ...recipientAnalysisResultBuilder()
          .with('type', 'INCOMPATIBLE_SAFE')
          .build(),
        targetChainId: '137',
      };

      expect(() =>
        RecipientAnalysisResultSchema.parse(bridgeResult),
      ).not.toThrow();
    });

    it('should validate common status FAILED', () => {
      const failedResult = recipientAnalysisResultBuilder()
        .with('type', 'FAILED')
        .build();

      expect(() =>
        RecipientAnalysisResultSchema.parse(failedResult),
      ).not.toThrow();
    });

    it('should validate common status FAILED with targetChainId', () => {
      const failedResult = {
        ...recipientAnalysisResultBuilder().with('type', 'FAILED').build(),
        targetChainId: '137',
      };

      expect(() =>
        RecipientAnalysisResultSchema.parse(failedResult),
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

    it('should validate common status FAILED', () => {
      const failedResult = contractAnalysisResultBuilder()
        .with('type', 'FAILED')
        .build();

      expect(() =>
        ContractAnalysisResultSchema.parse(failedResult),
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

    it('should validate common status FAILED', () => {
      const failedResult = threatAnalysisResultBuilder()
        .with('type', 'FAILED')
        .build();

      expect(() =>
        ThreatAnalysisResultSchema.parse(failedResult),
      ).not.toThrow();
    });

    it('should validate MASTERCOPY_CHANGE with before and after fields', () => {
      const masterCopyChange = masterCopyChangeThreatBuilder().build();

      expect(() =>
        ThreatAnalysisResultSchema.parse(masterCopyChange),
      ).not.toThrow();

      const parsed = ThreatAnalysisResultSchema.parse(masterCopyChange);
      expect(parsed.type).toBe('MASTERCOPY_CHANGE');
      expect(parsed).toHaveProperty('before');
      expect(parsed).toHaveProperty('after');
    });

    it('should reject MASTERCOPY_CHANGE without before field', () => {
      const invalidWithoutBefore = omit(
        masterCopyChangeThreatBuilder().build(),
        'before',
      );

      expect(() =>
        ThreatAnalysisResultSchema.parse(invalidWithoutBefore),
      ).toThrow();
    });

    it('should reject MASTERCOPY_CHANGE without after field', () => {
      const invalidWithoutAfter = omit(
        masterCopyChangeThreatBuilder().build(),
        'after',
      );

      expect(() =>
        ThreatAnalysisResultSchema.parse(invalidWithoutAfter),
      ).toThrow();
    });

    it('should validate MALICIOUS with optional issues', () => {
      const malicious = maliciousOrModerateThreatBuilder().build();

      expect(() => ThreatAnalysisResultSchema.parse(malicious)).not.toThrow();

      const parsed = ThreatAnalysisResultSchema.parse(malicious);
      expect(parsed.type).toBe('MALICIOUS');
      expect(parsed).toHaveProperty('issues');
    });

    it('should validate MALICIOUS without issues field', () => {
      const maliciousNoIssues = omit(
        maliciousOrModerateThreatBuilder().build(),
        'issues',
      );

      expect(() =>
        ThreatAnalysisResultSchema.parse(maliciousNoIssues),
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
          .with('severity', 'INFO')
          .with('type', 'KNOWN_CONTRACT')
          .build(),
        contractAnalysisResultBuilder()
          .with('severity', 'CRITICAL')
          .with('type', 'UNEXPECTED_DELEGATECALL')
          .build(),
        contractAnalysisResultBuilder()
          .with('severity', 'WARN')
          .with('type', 'NOT_VERIFIED_BY_SAFE')
          .build(),
      ];

      const sorted = results.sort((a, b) =>
        compareSeverityString(b.severity, a.severity),
      );

      expect(sorted[0].severity).toBe('CRITICAL');
      expect(sorted[1].severity).toBe('WARN');
      expect(sorted[2].severity).toBe('INFO');
    });
  });
});
