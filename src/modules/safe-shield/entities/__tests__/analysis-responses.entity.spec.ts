import { ThreatStatus } from '@/modules/safe-shield/entities/threat-status.entity';
import {
  RecipientAnalysisResponseSchema,
  ContractAnalysisResponseSchema,
  CounterpartyAnalysisResponseSchema,
  ThreatAnalysisResponseSchema,
} from '../analysis-responses.entity';
import {
  recipientAnalysisResponseBuilder,
  contractAnalysisResponseBuilder,
  counterpartyAnalysisResponseBuilder,
  threatAnalysisResponseBuilder,
} from './builders/analysis-responses.builder';
import {
  contractAnalysisResultBuilder,
  recipientAnalysisResultBuilder,
} from './builders/analysis-result.builder';
import { faker } from '@faker-js/faker';
import type {
  ContractStatusGroup,
  RecipientStatusGroup,
} from '../status-group.entity';

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
            RECIPIENT_INTERACTION: [recipientAnalysisResultBuilder().build()],
            BRIDGE: [recipientAnalysisResultBuilder().build()],
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
            RECIPIENT_INTERACTION: [],
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

      it('should reject invalid status group', () => {
        const invalidStatusGroupResponse = recipientAnalysisResponseBuilder()
          .with(faker.finance.ethereumAddress() as `0x${string}`, {
            ['INVALID_STATUS_GROUP' as RecipientStatusGroup]: [
              recipientAnalysisResultBuilder().build(),
            ],
          })
          .build();

        expect(() =>
          RecipientAnalysisResponseSchema.parse(invalidStatusGroupResponse),
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

      it('should validate response with multiple addresses', () => {
        const multiAddressResponse = contractAnalysisResponseBuilder()
          .with(faker.finance.ethereumAddress() as `0x${string}`, {
            CONTRACT_VERIFICATION: [contractAnalysisResultBuilder().build()],
            CONTRACT_INTERACTION: [contractAnalysisResultBuilder().build()],
            DELEGATECALL: [contractAnalysisResultBuilder().build()],
          })
          .build();

        expect(() =>
          ContractAnalysisResponseSchema.parse(multiAddressResponse),
        ).not.toThrow();
      });

      it('should validate empty response', () => {
        expect(() => ContractAnalysisResponseSchema.parse({})).not.toThrow();
      });

      it('should validate response with empty status groups', () => {
        const responseWithEmptyGroups = contractAnalysisResponseBuilder()
          .with(faker.finance.ethereumAddress() as `0x${string}`, {
            CONTRACT_VERIFICATION: [],
          })
          .build();

        expect(() =>
          ContractAnalysisResponseSchema.parse(responseWithEmptyGroups),
        ).not.toThrow();
      });

      it('should reject invalid address format', () => {
        const invalidAddressResponse = { 'invalid-address': {} };

        expect(() =>
          ContractAnalysisResponseSchema.parse(invalidAddressResponse),
        ).toThrow();
      });

      it('should reject invalid status group', () => {
        const invalidStatusGroupResponse = contractAnalysisResponseBuilder()
          .with(faker.finance.ethereumAddress() as `0x${string}`, {
            ['INVALID_STATUS_GROUP' as ContractStatusGroup]: [
              contractAnalysisResultBuilder().build(),
            ],
          })
          .build();

        expect(() =>
          ContractAnalysisResponseSchema.parse(invalidStatusGroupResponse),
        ).toThrow();
      });
    });

    describe('ThreatAnalysisResponseSchema', () => {
      it('should validate threat analysis response', () => {
        const validThreatResponse = threatAnalysisResponseBuilder().build();

        expect(() =>
          ThreatAnalysisResponseSchema.parse(validThreatResponse),
        ).not.toThrow();
      });

      it('should validate all threat status responses', () => {
        const safeThreats = ThreatStatus.map((threat) =>
          threatAnalysisResponseBuilder(threat).build(),
        );

        safeThreats.forEach((threat) => {
          expect(() =>
            ThreatAnalysisResponseSchema.parse(threat),
          ).not.toThrow();
        });
      });

      it('should reject invalid threat status', () => {
        const invalidThreatResponse = threatAnalysisResponseBuilder()
          .with('type', 'INVALID_THREAT' as ThreatStatus)
          .build();

        expect(() =>
          ThreatAnalysisResponseSchema.parse(invalidThreatResponse),
        ).toThrow();
      });
    });

    describe('CounterpartyAnalysisResponseSchema', () => {
      it('should validate counterparty analysis response', () => {
        const response = counterpartyAnalysisResponseBuilder().build();

        expect(() =>
          CounterpartyAnalysisResponseSchema.parse(response),
        ).not.toThrow();
      });

      it('should reject invalid recipient analysis structure', () => {
        const response = {
          ...counterpartyAnalysisResponseBuilder().build(),
          recipient: { invalid: {} },
        } as unknown;

        expect(() =>
          CounterpartyAnalysisResponseSchema.parse(response),
        ).toThrow();
      });

      it('should reject invalid contract analysis structure', () => {
        const response = {
          ...counterpartyAnalysisResponseBuilder().build(),
          contract: { invalid: {} },
        } as unknown;

        expect(() =>
          CounterpartyAnalysisResponseSchema.parse(response),
        ).toThrow();
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
