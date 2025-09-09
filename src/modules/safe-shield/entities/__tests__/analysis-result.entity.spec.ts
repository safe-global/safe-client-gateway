import {
  AnalysisResultBaseSchema,
  RecipientAnalysisResultSchema,
  ContractAnalysisResultSchema,
  ThreatAnalysisResultSchema,
  AnyStatusSchema,
  type AnalysisResult,
  type RecipientAnalysisResult,
  type ContractAnalysisResult,
  type ThreatAnalysisResult,
  type AnyStatus,
} from '../analysis-result.entity';
import { Severity } from '../severity.entity';
import { RecipientStatus } from '../recipient-status.entity';
import { BridgeStatus } from '../bridge-status.entity';
import { ContractStatus } from '../contract-status.entity';
import { ThreatStatus } from '../threat-status.entity';

describe('AnalysisResult', () => {
  describe('AnalysisResult interface', () => {
    it('should enforce correct structure for recipient analysis', () => {
      const result: RecipientAnalysisResult = {
        severity: Severity.WARN,
        type: RecipientStatus.NEW_RECIPIENT,
        title: 'New recipient detected',
        description: 'This is the first time interacting with this address',
      };

      expect(result.severity).toBe(Severity.WARN);
      expect(result.type).toBe(RecipientStatus.NEW_RECIPIENT);
      expect(result.title).toBe('New recipient detected');
      expect(result.description).toBe(
        'This is the first time interacting with this address',
      );
    });

    it('should enforce correct structure for contract analysis', () => {
      const result: ContractAnalysisResult = {
        severity: Severity.CRITICAL,
        type: ContractStatus.NOT_VERIFIED,
        title: 'Unverified contract',
        description: 'Contract source code is not verified',
      };

      expect(result.severity).toBe(Severity.CRITICAL);
      expect(result.type).toBe(ContractStatus.NOT_VERIFIED);
    });

    it('should enforce correct structure for threat analysis', () => {
      const result: ThreatAnalysisResult = {
        severity: Severity.CRITICAL,
        type: ThreatStatus.MALICIOUS,
        title: 'Malicious transaction detected',
        description: 'This transaction contains known malicious patterns',
      };

      expect(result.severity).toBe(Severity.CRITICAL);
      expect(result.type).toBe(ThreatStatus.MALICIOUS);
    });
  });

  describe('AnyStatusSchema', () => {
    it('should validate all recipient status values', () => {
      expect(() =>
        AnyStatusSchema.parse(RecipientStatus.NEW_RECIPIENT),
      ).not.toThrow();
      expect(() =>
        AnyStatusSchema.parse(RecipientStatus.KNOWN_RECIPIENT),
      ).not.toThrow();
    });

    it('should validate all bridge status values', () => {
      expect(() =>
        AnyStatusSchema.parse(BridgeStatus.INCOMPATIBLE_SAFE),
      ).not.toThrow();
      expect(() =>
        AnyStatusSchema.parse(BridgeStatus.MISSING_OWNERSHIP),
      ).not.toThrow();
      expect(() =>
        AnyStatusSchema.parse(BridgeStatus.UNSUPPORTED_NETWORK),
      ).not.toThrow();
      expect(() =>
        AnyStatusSchema.parse(BridgeStatus.DIFFERENT_SAFE_SETUP),
      ).not.toThrow();
    });

    it('should validate all contract status values', () => {
      expect(() =>
        AnyStatusSchema.parse(ContractStatus.VERIFIED),
      ).not.toThrow();
      expect(() =>
        AnyStatusSchema.parse(ContractStatus.NOT_VERIFIED),
      ).not.toThrow();
      expect(() =>
        AnyStatusSchema.parse(ContractStatus.UNEXPECTED_DELEGATECALL),
      ).not.toThrow();
    });

    it('should validate all threat status values', () => {
      expect(() => AnyStatusSchema.parse(ThreatStatus.MALICIOUS)).not.toThrow();
      expect(() => AnyStatusSchema.parse(ThreatStatus.NO_THREAT)).not.toThrow();
      expect(() =>
        AnyStatusSchema.parse(ThreatStatus.MODULE_CHANGE),
      ).not.toThrow();
    });

    it('should reject invalid status values', () => {
      expect(() => AnyStatusSchema.parse('INVALID_STATUS')).toThrow();
      expect(() => AnyStatusSchema.parse('')).toThrow();
      expect(() => AnyStatusSchema.parse(null)).toThrow();
      expect(() => AnyStatusSchema.parse(123)).toThrow();
    });
  });

  describe('AnalysisResultBaseSchema', () => {
    const validBaseResult = {
      severity: Severity.WARN,
      type: RecipientStatus.NEW_RECIPIENT,
      title: 'Test title',
      description: 'Test description',
    };

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
          type: RecipientStatus.NEW_RECIPIENT,
        }),
      ).toThrow();
    });

    it('should reject empty title or description', () => {
      expect(() =>
        AnalysisResultBaseSchema.parse({
          ...validBaseResult,
          title: '',
        }),
      ).toThrow();

      expect(() =>
        AnalysisResultBaseSchema.parse({
          ...validBaseResult,
          description: '',
        }),
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
      const recipientResult = {
        severity: Severity.INFO,
        type: RecipientStatus.KNOWN_RECIPIENT,
        title: 'Known recipient',
        description: 'You have interacted with this address before',
      };

      expect(() =>
        RecipientAnalysisResultSchema.parse(recipientResult),
      ).not.toThrow();
    });

    it('should validate bridge status types', () => {
      const bridgeResult = {
        severity: Severity.CRITICAL,
        type: BridgeStatus.INCOMPATIBLE_SAFE,
        title: 'Incompatible Safe',
        description: 'Target Safe version is incompatible',
      };

      expect(() =>
        RecipientAnalysisResultSchema.parse(bridgeResult),
      ).not.toThrow();
    });

    it('should reject contract status types', () => {
      const contractResult = {
        severity: Severity.WARN,
        type: ContractStatus.NOT_VERIFIED,
        title: 'Unverified contract',
        description: 'Contract is not verified',
      };

      expect(() =>
        RecipientAnalysisResultSchema.parse(contractResult),
      ).toThrow();
    });

    it('should reject threat status types', () => {
      const threatResult = {
        severity: Severity.CRITICAL,
        type: ThreatStatus.MALICIOUS,
        title: 'Malicious transaction',
        description: 'Transaction contains malicious patterns',
      };

      expect(() => RecipientAnalysisResultSchema.parse(threatResult)).toThrow();
    });
  });

  describe('ContractAnalysisResultSchema', () => {
    it('should validate contract status types', () => {
      const contractResult = {
        severity: Severity.WARN,
        type: ContractStatus.NOT_VERIFIED,
        title: 'Unverified contract',
        description: 'Contract source code is not verified',
      };

      expect(() =>
        ContractAnalysisResultSchema.parse(contractResult),
      ).not.toThrow();
    });

    it('should reject recipient status types', () => {
      const recipientResult = {
        severity: Severity.INFO,
        type: RecipientStatus.KNOWN_RECIPIENT,
        title: 'Known recipient',
        description: 'You have interacted with this address before',
      };

      expect(() =>
        ContractAnalysisResultSchema.parse(recipientResult),
      ).toThrow();
    });

    it('should reject threat status types', () => {
      const threatResult = {
        severity: Severity.CRITICAL,
        type: ThreatStatus.MALICIOUS,
        title: 'Malicious transaction',
        description: 'Transaction contains malicious patterns',
      };

      expect(() => ContractAnalysisResultSchema.parse(threatResult)).toThrow();
    });
  });

  describe('ThreatAnalysisResultSchema', () => {
    it('should validate threat status types', () => {
      const threatResult = {
        severity: Severity.CRITICAL,
        type: ThreatStatus.OWNERSHIP_CHANGE,
        title: 'Ownership change detected',
        description: 'This transaction attempts to modify Safe ownership',
      };

      expect(() =>
        ThreatAnalysisResultSchema.parse(threatResult),
      ).not.toThrow();
    });

    it('should reject contract status types', () => {
      const contractResult = {
        severity: Severity.WARN,
        type: ContractStatus.NOT_VERIFIED,
        title: 'Unverified contract',
        description: 'Contract source code is not verified',
      };

      expect(() => ThreatAnalysisResultSchema.parse(contractResult)).toThrow();
    });

    it('should reject recipient status types', () => {
      const recipientResult = {
        severity: Severity.INFO,
        type: RecipientStatus.KNOWN_RECIPIENT,
        title: 'Known recipient',
        description: 'You have interacted with this address before',
      };

      expect(() => ThreatAnalysisResultSchema.parse(recipientResult)).toThrow();
    });
  });

  describe('real-world scenarios', () => {
    it('should handle multiple analysis results correctly', () => {
      const results: Array<AnalysisResult<AnyStatus>> = [
        {
          severity: Severity.CRITICAL,
          type: ThreatStatus.MALICIOUS,
          title: 'Malicious transaction',
          description: 'Transaction flagged as malicious',
        },
        {
          severity: Severity.WARN,
          type: ContractStatus.NOT_VERIFIED,
          title: 'Unverified contract',
          description: 'Contract source not verified',
        },
        {
          severity: Severity.INFO,
          type: RecipientStatus.KNOWN_RECIPIENT,
          title: 'Known recipient',
          description: 'Previously interacted with',
        },
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
        {
          severity: Severity.INFO,
          type: RecipientStatus.KNOWN_RECIPIENT,
          title: 'Info',
          description: 'Info desc',
        },
        {
          severity: Severity.CRITICAL,
          type: ThreatStatus.MALICIOUS,
          title: 'Critical',
          description: 'Critical desc',
        },
        {
          severity: Severity.WARN,
          type: ContractStatus.NOT_VERIFIED,
          title: 'Warn',
          description: 'Warn desc',
        },
      ];

      // This would be done using the compareSeverity function in practice
      const severityOrder = { OK: 0, INFO: 1, WARN: 2, CRITICAL: 3 };
      const sorted = results.sort(
        (a, b) => severityOrder[b.severity] - severityOrder[a.severity],
      );

      expect(sorted[0].severity).toBe(Severity.CRITICAL);
      expect(sorted[1].severity).toBe(Severity.WARN);
      expect(sorted[2].severity).toBe(Severity.INFO);
    });
  });
});
