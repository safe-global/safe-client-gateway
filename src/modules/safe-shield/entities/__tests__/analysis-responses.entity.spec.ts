import {
  RecipientAnalysisResponseSchema,
  ContractAnalysisResponseSchema,
  ThreatAnalysisResponseSchema,
} from '../analysis-responses.entity';
import {
  RecipientAnalysisResponseBuilder,
  ContractAnalysisResponseBuilder,
  ThreatAnalysisResponseBuilder,
} from './builders';

describe('Analysis Response Schemas', () => {
  describe('Response Schemas', () => {
    describe('RecipientAnalysisResponseSchema', () => {
      it('should validate correct recipient analysis response', () => {
        const validResponse = RecipientAnalysisResponseBuilder.new()
          .withRandomAddress()
          .withKnownRecipient()
          .build();

        expect(() =>
          RecipientAnalysisResponseSchema.parse(validResponse),
        ).not.toThrow();
      });

      it('should validate response with multiple addresses', () => {
        const multiAddressResponse = RecipientAnalysisResponseBuilder.new()
          .withRandomAddress()
          .withKnownRecipient()
          .and()
          .withRandomAddress()
          .withIncompatibleSafe()
          .build();

        expect(() =>
          RecipientAnalysisResponseSchema.parse(multiAddressResponse),
        ).not.toThrow();
      });

      it('should validate empty response', () => {
        expect(() => RecipientAnalysisResponseSchema.parse({})).not.toThrow();
      });

      it('should validate response with empty status groups', () => {
        const responseWithEmptyGroups = RecipientAnalysisResponseBuilder.new()
          .withRandomAddress()
          .build();

        expect(() =>
          RecipientAnalysisResponseSchema.parse(responseWithEmptyGroups),
        ).not.toThrow();
      });

      it('should reject invalid address format', () => {
        const invalidAddressResponse = RecipientAnalysisResponseBuilder.new()
          .withAddress('invalid-address')
          .withIncompatibleSafe()
          .build();

        expect(() =>
          RecipientAnalysisResponseSchema.parse(invalidAddressResponse),
        ).toThrow();
      });
    });

    describe('ContractAnalysisResponseSchema', () => {
      it('should validate correct contract analysis response', () => {
        const validResponse = ContractAnalysisResponseBuilder.new()
          .withRandomAddress()
          .withNotVerified()
          .withKnownContract()
          .build();

        expect(() =>
          ContractAnalysisResponseSchema.parse(validResponse),
        ).not.toThrow();
      });

      it('should validate response with delegatecall detection', () => {
        const delegatecallResponse = ContractAnalysisResponseBuilder.new()
          .withRandomAddress()
          .withUnexpectedDelegatecall()
          .build();

        expect(() =>
          ContractAnalysisResponseSchema.parse(delegatecallResponse),
        ).not.toThrow();
      });
    });

    describe('ThreatAnalysisResponseSchema', () => {
      it('should validate threat analysis response', () => {
        const validThreatResponse = ThreatAnalysisResponseBuilder.new()
          .malicious()
          .build();

        expect(() =>
          ThreatAnalysisResponseSchema.parse(validThreatResponse),
        ).not.toThrow();
      });

      it('should validate safe threat responses', () => {
        const safeThreats = [
          ThreatAnalysisResponseBuilder.new().ownershipChange().build(),
          ThreatAnalysisResponseBuilder.new().moduleChange().build(),
          ThreatAnalysisResponseBuilder.new().masterCopyChange().build(),
        ];

        safeThreats.forEach((threat) => {
          expect(() =>
            ThreatAnalysisResponseSchema.parse(threat),
          ).not.toThrow();
        });
      });

      it('should validate no threat response', () => {
        const noThreatResponse = ThreatAnalysisResponseBuilder.new()
          .noThreat()
          .build();

        expect(() =>
          ThreatAnalysisResponseSchema.parse(noThreatResponse),
        ).not.toThrow();
      });

      it('should validate failed analysis response', () => {
        const failedResponse = ThreatAnalysisResponseBuilder.new()
          .failed()
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
        recipient: RecipientAnalysisResponseBuilder.new()
          .withRandomAddress()
          .withIncompatibleSafe()
          .and()
          .withRandomAddress()
          .withNewRecipient()
          .build(),
        // Contract analysis
        contract: ContractAnalysisResponseBuilder.new()
          .withRandomAddress()
          .withNotVerified()
          .withKnownContract()
          .build(),
        // Threat analysis
        threat: ThreatAnalysisResponseBuilder.new().noThreat().build(),
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
