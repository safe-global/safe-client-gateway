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
import { getAddress } from 'viem';

describe('Analysis Response Schemas', () => {
  describe('Response Schemas', () => {
    describe('RecipientAnalysisResponseSchema', () => {
      it('should validate correct recipient analysis response', () => {
        const validResponse = recipientAnalysisResponseBuilder().build();

        const result = RecipientAnalysisResponseSchema.safeParse(validResponse);

        expect(result.success && result.data).toStrictEqual(validResponse);
      });

      it('should validate response with multiple addresses', () => {
        const multiAddressResponse = recipientAnalysisResponseBuilder()
          .with(getAddress(faker.finance.ethereumAddress()), {
            RECIPIENT_INTERACTION: [recipientAnalysisResultBuilder().build()],
            BRIDGE: [recipientAnalysisResultBuilder().build()],
          })
          .build();

        const result =
          RecipientAnalysisResponseSchema.safeParse(multiAddressResponse);

        expect(result.success && result.data).toStrictEqual(
          multiAddressResponse,
        );
      });

      it('should validate empty response', () => {
        const result = RecipientAnalysisResponseSchema.safeParse({});

        expect(result.success && result.data).toStrictEqual({});
      });

      it('should validate response with empty status groups', () => {
        const responseWithEmptyGroups = recipientAnalysisResponseBuilder()
          .with(getAddress(faker.finance.ethereumAddress()), {
            RECIPIENT_INTERACTION: [],
          })
          .build();

        const result = RecipientAnalysisResponseSchema.safeParse(
          responseWithEmptyGroups,
        );

        expect(result.success && result.data).toStrictEqual(
          responseWithEmptyGroups,
        );
      });

      it('should reject invalid address format', () => {
        const invalidAddressResponse = { 'invalid-address': {} };

        const result = RecipientAnalysisResponseSchema.safeParse(
          invalidAddressResponse,
        );

        expect(!result.success && result.error.issues).toStrictEqual([
          {
            code: 'custom',
            message: 'Invalid address',
            path: ['invalid-address'],
          },
        ]);
      });

      it('should reject invalid status group', () => {
        const invalidStatusGroupResponse = recipientAnalysisResponseBuilder()
          .with(getAddress(faker.finance.ethereumAddress()), {
            ['INVALID_STATUS_GROUP' as RecipientStatusGroup]: [
              recipientAnalysisResultBuilder().build(),
            ],
          })
          .build();

        const result = RecipientAnalysisResponseSchema.safeParse(
          invalidStatusGroupResponse,
        );

        expect(!result.success && result.error.issues.length).toBeGreaterThan(
          0,
        );
        expect(result?.error?.issues[0].code).toBe('invalid_enum_value');
      });
    });

    describe('ContractAnalysisResponseSchema', () => {
      it('should validate correct contract analysis response', () => {
        const validResponse = contractAnalysisResponseBuilder().build();

        const result = ContractAnalysisResponseSchema.safeParse(validResponse);

        expect(result.success && result.data).toStrictEqual(validResponse);
      });

      it('should validate response with multiple addresses', () => {
        const multiAddressResponse = contractAnalysisResponseBuilder()
          .with(getAddress(faker.finance.ethereumAddress()), {
            CONTRACT_VERIFICATION: [contractAnalysisResultBuilder().build()],
            CONTRACT_INTERACTION: [contractAnalysisResultBuilder().build()],
            DELEGATECALL: [contractAnalysisResultBuilder().build()],
          })
          .build();

        const result =
          ContractAnalysisResponseSchema.safeParse(multiAddressResponse);

        expect(result.success && result.data).toStrictEqual(
          multiAddressResponse,
        );
      });

      it('should validate empty response', () => {
        const result = ContractAnalysisResponseSchema.safeParse({});

        expect(result.success && result.data).toStrictEqual({});
      });

      it('should validate response with empty status groups', () => {
        const responseWithEmptyGroups = contractAnalysisResponseBuilder()
          .with(getAddress(faker.finance.ethereumAddress()), {
            CONTRACT_VERIFICATION: [],
          })
          .build();

        const result = ContractAnalysisResponseSchema.safeParse(
          responseWithEmptyGroups,
        );

        expect(result.success && result.data).toStrictEqual(
          responseWithEmptyGroups,
        );
      });

      it('should reject invalid address format', () => {
        const invalidAddressResponse = { 'invalid-address': {} };

        const result = ContractAnalysisResponseSchema.safeParse(
          invalidAddressResponse,
        );

        expect(!result.success && result.error.issues).toStrictEqual([
          {
            code: 'custom',
            message: 'Invalid address',
            path: ['invalid-address'],
          },
        ]);
      });

      it('should reject invalid status group', () => {
        const invalidStatusGroupResponse = contractAnalysisResponseBuilder()
          .with(getAddress(faker.finance.ethereumAddress()), {
            ['INVALID_STATUS_GROUP' as ContractStatusGroup]: [
              contractAnalysisResultBuilder().build(),
            ],
          })
          .build();

        const result = ContractAnalysisResponseSchema.safeParse(
          invalidStatusGroupResponse,
        );

        expect(!result.success && result.error.issues.length).toBeGreaterThan(
          0,
        );
        expect(result?.error?.issues[0].code).toBe('invalid_enum_value');
      });
    });

    describe('ThreatAnalysisResponseSchema', () => {
      it('should validate correct threat analysis response', () => {
        const validThreatResponse = threatAnalysisResponseBuilder().build();

        const result =
          ThreatAnalysisResponseSchema.safeParse(validThreatResponse);

        expect(result.success && result.data).toStrictEqual(
          validThreatResponse,
        );
      });

      it('should validate all threat status responses', () => {
        const safeThreats = ThreatStatus.map((threat) =>
          threatAnalysisResponseBuilder(threat).build(),
        );

        safeThreats.forEach((threat) => {
          const result = ThreatAnalysisResponseSchema.safeParse(threat);

          expect(result.success && result.data).toStrictEqual(threat);
        });
      });

      it('should validate empty THREAT and BALANCE_CHANGE arrays', () => {
        const emptyResponse = threatAnalysisResponseBuilder()
          .with('THREAT', [])
          .with('BALANCE_CHANGE', [])
          .build();

        const result = ThreatAnalysisResponseSchema.safeParse(emptyResponse);

        expect(result.success && result.data).toStrictEqual(emptyResponse);
      });

      it('should validate response with balance changes', () => {
        const responseWithBalanceChanges = threatAnalysisResponseBuilder()
          .with('BALANCE_CHANGE', [
            {
              asset: {
                type: 'ERC20',
                symbol: 'USDC',
                address: getAddress(faker.finance.ethereumAddress()),
              },
              in: [{ value: faker.finance.amount() }],
              out: [],
            },
          ])
          .build();

        const result = ThreatAnalysisResponseSchema.safeParse(
          responseWithBalanceChanges,
        );

        expect(result.success && result.data).toStrictEqual(
          responseWithBalanceChanges,
        );
      });

      it('should reject invalid status group', () => {
        const invalidResponse = {
          INVALID_GROUP: [],
        };

        const result = ThreatAnalysisResponseSchema.safeParse(invalidResponse);

        expect(!result.success && result.error.issues.length).toBeGreaterThan(
          0,
        );
        expect(result?.error?.issues[0].code).toBe('invalid_enum_value');
      });
    });

    describe('CounterpartyAnalysisResponseSchema', () => {
      it('should validate counterparty analysis response', () => {
        const response = counterpartyAnalysisResponseBuilder().build();

        const result = CounterpartyAnalysisResponseSchema.safeParse(response);

        expect(result.success && result.data).toStrictEqual(response);
      });

      it('should reject invalid recipient analysis structure', () => {
        const response = {
          ...counterpartyAnalysisResponseBuilder().build(),
          recipient: { invalid: {} },
        } as unknown;

        const result = CounterpartyAnalysisResponseSchema.safeParse(response);

        expect(!result.success && result.error.issues.length).toBeGreaterThan(
          0,
        );
        expect(result?.error?.issues[0].code).toBe('custom');
      });

      it('should reject invalid contract analysis structure', () => {
        const response = {
          ...counterpartyAnalysisResponseBuilder().build(),
          contract: { invalid: {} },
        } as unknown;

        const result = CounterpartyAnalysisResponseSchema.safeParse(response);

        expect(!result.success && result.error.issues.length).toBeGreaterThan(
          0,
        );
        expect(result?.error?.issues[0].code).toBe('custom');
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle multi-send transaction analysis', () => {
      const multiSendResponse = {
        recipient: recipientAnalysisResponseBuilder().build(),
        contract: contractAnalysisResponseBuilder().build(),
        threat: threatAnalysisResponseBuilder().build(),
      };

      const recipientResult = RecipientAnalysisResponseSchema.safeParse(
        multiSendResponse.recipient,
      );
      const contractResult = ContractAnalysisResponseSchema.safeParse(
        multiSendResponse.contract,
      );
      const threatResult = ThreatAnalysisResponseSchema.safeParse(
        multiSendResponse.threat,
      );

      expect(recipientResult.success && recipientResult.data).toStrictEqual(
        multiSendResponse.recipient,
      );
      expect(contractResult.success && contractResult.data).toStrictEqual(
        multiSendResponse.contract,
      );
      expect(threatResult.success && threatResult.data).toStrictEqual(
        multiSendResponse.threat,
      );
    });
  });
});
