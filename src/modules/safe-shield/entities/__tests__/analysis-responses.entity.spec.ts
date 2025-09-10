import { RecipientStatusGroup } from '@/modules/safe-shield/entities/status-group.entity';
import {
  RecipientAnalysisResponseSchema,
  ContractAnalysisResponseSchema,
  ThreatAnalysisResponseSchema,
} from '../analysis-responses.entity';
import {
  recipientAnalysisResponseBuilder,
  contractAnalysisResponseBuilder,
  threatAnalysisResponseBuilder,
} from './builders/analysis-responses.builder';
import { recipientAnalysisResultBuilder } from './builders/analysis-result.builder';
import { faker } from '@faker-js/faker';
import { ThreatStatus } from '@/modules/safe-shield/entities/threat-status.entity';

describe('Analysis Response Schemas', () => {
  describe('Response Schemas', () => {
    describe('RecipientAnalysisResponseSchema', () => {
      it('should validate correct recipient analysis response', () => {
        const validResponse = recipientAnalysisResponseBuilder().build();

        expect(() =>
          RecipientAnalysisResponseSchema.parse(validResponse),
        ).not.toThrow();
      });

      it('should validate response with multiple addresses', () => {
        const multiAddressResponse = recipientAnalysisResponseBuilder()
          .with(faker.finance.ethereumAddress() as `0x${string}`, {
            [RecipientStatusGroup.RECIPIENT_INTERACTION]: [
              recipientAnalysisResultBuilder().build(),
            ],
            [RecipientStatusGroup.BRIDGE]: [
              recipientAnalysisResultBuilder().build(),
            ],
          })
          .build();

        expect(() =>
          RecipientAnalysisResponseSchema.parse(multiAddressResponse),
        ).not.toThrow();
      });

      it('should validate empty response', () => {
        expect(() => RecipientAnalysisResponseSchema.parse({})).not.toThrow();
      });

      it('should validate response with empty status groups', () => {
        const responseWithEmptyGroups = recipientAnalysisResponseBuilder()
          .with(faker.finance.ethereumAddress() as `0x${string}`, {
            [RecipientStatusGroup.RECIPIENT_INTERACTION]: [],
          })
          .build();

        expect(() =>
          RecipientAnalysisResponseSchema.parse(responseWithEmptyGroups),
        ).not.toThrow();
      });

      it('should reject invalid address format', () => {
        const invalidAddressResponse = { 'invalid-address': {} };

        expect(() =>
          RecipientAnalysisResponseSchema.parse(invalidAddressResponse),
        ).toThrow();
      });
    });

    describe('ContractAnalysisResponseSchema', () => {
      it('should validate correct contract analysis response', () => {
        const validResponse = contractAnalysisResponseBuilder().build();

        expect(() =>
          ContractAnalysisResponseSchema.parse(validResponse),
        ).not.toThrow();
      });
    });

    describe('ThreatAnalysisResponseSchema', () => {
      it('should validate threat analysis response', () => {
        const validThreatResponse = threatAnalysisResponseBuilder().build();

        expect(() =>
          ThreatAnalysisResponseSchema.parse(validThreatResponse),
        ).not.toThrow();
      });

      it('should validate safe threat responses', () => {
        const safeThreats = [
          threatAnalysisResponseBuilder().build(),
          threatAnalysisResponseBuilder().build(),
          threatAnalysisResponseBuilder().build(),
        ];

        safeThreats.forEach((threat) => {
          expect(() =>
            ThreatAnalysisResponseSchema.parse(threat),
          ).not.toThrow();
        });
      });

      it('should validate no threat response', () => {
        const noThreatResponse = threatAnalysisResponseBuilder()
          .with('type', ThreatStatus.NO_THREAT)
          .build();

        expect(() =>
          ThreatAnalysisResponseSchema.parse(noThreatResponse),
        ).not.toThrow();
      });

      it('should validate failed analysis response', () => {
        const failedResponse = threatAnalysisResponseBuilder()
          .with('type', ThreatStatus.FAILED)
          .build();

        expect(() =>
          ThreatAnalysisResponseSchema.parse(failedResponse),
        ).not.toThrow();
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle multi-send transaction analysis', () => {
      // Simulate a multi-send transaction with multiple recipients and contracts
      const multiSendResponse = {
        // Recipient analysis for multiple addresses
        recipient: recipientAnalysisResponseBuilder().build(),
        // Contract analysis
        contract: contractAnalysisResponseBuilder().build(),
        // Threat analysis
        threat: threatAnalysisResponseBuilder().build(),
      };

      // Validate individual components
      expect(() =>
        RecipientAnalysisResponseSchema.parse(multiSendResponse.recipient),
      ).not.toThrow();
      expect(() =>
        ContractAnalysisResponseSchema.parse(multiSendResponse.contract),
      ).not.toThrow();
      expect(() =>
        ThreatAnalysisResponseSchema.parse(multiSendResponse.threat),
      ).not.toThrow();
    });
  });
});
