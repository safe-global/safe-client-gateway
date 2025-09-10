import {
  RecipientAnalysisRequestBodySchema,
  ContractAnalysisRequestBodySchema,
  ThreatAnalysisRequestBodySchema,
} from '../analysis-requests.entity';
import {
  RecipientAnalysisResponseSchema,
  ContractAnalysisResponseSchema,
  ThreatAnalysisResponseSchema,
} from '../analysis-responses.entity';
import { Severity } from '../severity.entity';
import { StatusGroup } from '../status-group.entity';
import { RecipientStatus } from '../recipient-status.entity';
import { ContractStatus } from '../contract-status.entity';
import { ThreatStatus } from '../threat-status.entity';
import { faker } from '@faker-js/faker';

describe('API Schemas', () => {
  describe('Request Schemas', () => {
    describe('RecipientAnalysisRequestBodySchema', () => {
      it('should validate correct request body', () => {
        const validRequest = {
          data: faker.string.hexadecimal({ length: 128 }),
        };

        expect(() =>
          RecipientAnalysisRequestBodySchema.parse(validRequest),
        ).not.toThrow();
      });

      it('should validate empty data', () => {
        const requestWithEmptyData = {
          data: '0x',
        };

        expect(() =>
          RecipientAnalysisRequestBodySchema.parse(requestWithEmptyData),
        ).not.toThrow();
      });

      it('should reject invalid hex data', () => {
        expect(() =>
          RecipientAnalysisRequestBodySchema.parse({
            data: 'invalid-hex',
          }),
        ).toThrow();

        expect(() =>
          RecipientAnalysisRequestBodySchema.parse({
            data: '1234567890abcdef', // missing 0x prefix
          }),
        ).toThrow();
      });

      it('should reject missing data field', () => {
        expect(() => RecipientAnalysisRequestBodySchema.parse({})).toThrow();
      });
    });

    describe('ContractAnalysisRequestBodySchema', () => {
      it('should validate correct request body', () => {
        const validRequest = {
          data: faker.string.hexadecimal({ length: 128 }),
          operation: 0,
        };

        expect(() =>
          ContractAnalysisRequestBodySchema.parse(validRequest),
        ).not.toThrow();
      });

      it('should validate delegatecall operation', () => {
        const delegatecallRequest = {
          data: '0x1234567890abcdef',
          operation: 1,
        };

        expect(() =>
          ContractAnalysisRequestBodySchema.parse(delegatecallRequest),
        ).not.toThrow();
      });

      it('should reject invalid operation values', () => {
        expect(() =>
          ContractAnalysisRequestBodySchema.parse({
            data: '0x1234567890abcdef',
            operation: 2, // Only 0 and 1 are valid
          }),
        ).toThrow();

        expect(() =>
          ContractAnalysisRequestBodySchema.parse({
            data: '0x1234567890abcdef',
            operation: -1,
          }),
        ).toThrow();
      });

      it('should reject missing fields', () => {
        expect(() =>
          ContractAnalysisRequestBodySchema.parse({
            data: '0x1234567890abcdef',
            // missing operation
          }),
        ).toThrow();

        expect(() =>
          ContractAnalysisRequestBodySchema.parse({
            operation: 0,
            // missing data
          }),
        ).toThrow();
      });
    });

    describe('ThreatAnalysisRequestBodySchema', () => {
      const validThreatRequest = {
        to: faker.finance.ethereumAddress(),
        value: '1000000000000000000',
        data: faker.string.hexadecimal({ length: 128 }),
        operation: 0,
        safeTxGas: '100000',
        baseGas: '21000',
        gasPrice: '20000000000',
        gasToken: '0x0000000000000000000000000000000000000000',
        refundReceiver: '0x0000000000000000000000000000000000000000',
        nonce: '1',
      };

      it('should validate complete threat analysis request', () => {
        expect(() =>
          ThreatAnalysisRequestBodySchema.parse(validThreatRequest),
        ).not.toThrow();
      });

      it('should validate with different operation type', () => {
        const delegatecallRequest = {
          ...validThreatRequest,
          operation: 1,
        };

        expect(() =>
          ThreatAnalysisRequestBodySchema.parse(delegatecallRequest),
        ).not.toThrow();
      });

      it('should reject invalid addresses', () => {
        expect(() =>
          ThreatAnalysisRequestBodySchema.parse({
            ...validThreatRequest,
            to: 'invalid-address',
          }),
        ).toThrow();

        expect(() =>
          ThreatAnalysisRequestBodySchema.parse({
            ...validThreatRequest,
            gasToken: '0xinvalid',
          }),
        ).toThrow();
      });

      it('should reject invalid numeric strings', () => {
        expect(() =>
          ThreatAnalysisRequestBodySchema.parse({
            ...validThreatRequest,
            value: 'not-a-number',
          }),
        ).toThrow();

        expect(() =>
          ThreatAnalysisRequestBodySchema.parse({
            ...validThreatRequest,
            nonce: 'abc123',
          }),
        ).toThrow();

        expect(() =>
          ThreatAnalysisRequestBodySchema.parse({
            ...validThreatRequest,
            safeTxGas: '',
          }),
        ).toThrow();
      });

      it('should reject missing required fields', () => {
        const requiredFields = [
          'to',
          'value',
          'data',
          'operation',
          'safeTxGas',
          'baseGas',
          'gasPrice',
          'gasToken',
          'refundReceiver',
          'nonce',
        ] as const;

        requiredFields.forEach((field) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [field]: _, ...incompleteRequest } = validThreatRequest;

          expect(() =>
            ThreatAnalysisRequestBodySchema.parse(incompleteRequest),
          ).toThrow();
        });
      });
    });
  });

  describe('Response Schemas', () => {
    describe('RecipientAnalysisResponseSchema', () => {
      it('should validate correct recipient analysis response', () => {
        const validResponse = {
          [faker.finance.ethereumAddress()]: {
            [StatusGroup.RECIPIENT_INTERACTION]: [
              {
                severity: Severity.INFO,
                type: RecipientStatus.KNOWN_RECIPIENT,
                title: 'Known recipient',
                description: 'You have interacted with this address before',
              },
            ],
          },
        };

        expect(() =>
          RecipientAnalysisResponseSchema.parse(validResponse),
        ).not.toThrow();
      });

      it('should validate response with multiple addresses', () => {
        const multiAddressResponse = {
          [faker.finance.ethereumAddress()]: {
            [StatusGroup.RECIPIENT_INTERACTION]: [
              {
                severity: Severity.INFO,
                type: RecipientStatus.KNOWN_RECIPIENT,
                title: 'Known recipient',
                description: 'Previously interacted',
              },
            ],
          },
          [faker.finance.ethereumAddress()]: {
            [StatusGroup.BRIDGE]: [
              {
                severity: Severity.WARN,
                type: 'INCOMPATIBLE_SAFE',
                title: 'Incompatible Safe',
                description: 'Target Safe version incompatible',
              },
            ],
          },
        };

        expect(() =>
          RecipientAnalysisResponseSchema.parse(multiAddressResponse),
        ).not.toThrow();
      });

      it('should validate empty response', () => {
        expect(() => RecipientAnalysisResponseSchema.parse({})).not.toThrow();
      });

      it('should validate response with empty status groups', () => {
        const responseWithEmptyGroups = {
          [faker.finance.ethereumAddress()]: {},
        };

        expect(() =>
          RecipientAnalysisResponseSchema.parse(responseWithEmptyGroups),
        ).not.toThrow();
      });

      it('should reject invalid address format', () => {
        const invalidAddressResponse = {
          'invalid-address': {
            [StatusGroup.RECIPIENT_INTERACTION]: [
              {
                severity: Severity.INFO,
                type: RecipientStatus.KNOWN_RECIPIENT,
                title: 'Known recipient',
                description: 'Previously interacted',
              },
            ],
          },
        };

        expect(() =>
          RecipientAnalysisResponseSchema.parse(invalidAddressResponse),
        ).toThrow();
      });
    });

    describe('ContractAnalysisResponseSchema', () => {
      it('should validate correct contract analysis response', () => {
        const validResponse = {
          [faker.finance.ethereumAddress()]: {
            [StatusGroup.CONTRACT_VERIFICATION]: [
              {
                severity: Severity.WARN,
                type: ContractStatus.NOT_VERIFIED,
                title: 'Unverified contract',
                description: 'Contract source code is not verified',
              },
            ],
            [StatusGroup.CONTRACT_INTERACTION]: [
              {
                severity: Severity.INFO,
                type: ContractStatus.KNOWN_CONTRACT,
                title: 'Known contract',
                description: 'You have interacted with this contract before',
              },
            ],
          },
        };

        expect(() =>
          ContractAnalysisResponseSchema.parse(validResponse),
        ).not.toThrow();
      });

      it('should validate response with delegatecall detection', () => {
        const delegatecallResponse = {
          [faker.finance.ethereumAddress()]: {
            [StatusGroup.DELEGATECALL]: [
              {
                severity: Severity.CRITICAL,
                type: ContractStatus.UNEXPECTED_DELEGATECALL,
                title: 'Unexpected delegatecall',
                description: 'Potentially dangerous delegatecall detected',
              },
            ],
          },
        };

        expect(() =>
          ContractAnalysisResponseSchema.parse(delegatecallResponse),
        ).not.toThrow();
      });
    });

    describe('ThreatAnalysisResponseSchema', () => {
      it('should validate threat analysis response', () => {
        const validThreatResponse = {
          severity: Severity.CRITICAL,
          type: ThreatStatus.MALICIOUS,
          title: 'Malicious transaction detected',
          description: 'This transaction contains known malicious patterns',
        };

        expect(() =>
          ThreatAnalysisResponseSchema.parse(validThreatResponse),
        ).not.toThrow();
      });

      it('should validate safe threat responses', () => {
        const safeThreats = [
          {
            severity: Severity.CRITICAL,
            type: ThreatStatus.OWNERSHIP_CHANGE,
            title: 'Ownership change',
            description: 'Transaction modifies Safe ownership',
          },
          {
            severity: Severity.WARN,
            type: ThreatStatus.MODULE_CHANGE,
            title: 'Module change',
            description: 'Transaction modifies Safe modules',
          },
          {
            severity: Severity.CRITICAL,
            type: ThreatStatus.MASTER_COPY_CHANGE,
            title: 'Master copy change',
            description: 'Transaction changes Safe implementation',
          },
        ];

        safeThreats.forEach((threat) => {
          expect(() =>
            ThreatAnalysisResponseSchema.parse(threat),
          ).not.toThrow();
        });
      });

      it('should validate no threat response', () => {
        const noThreatResponse = {
          severity: Severity.OK,
          type: ThreatStatus.NO_THREAT,
          title: 'No threats detected',
          description: 'Transaction appears safe',
        };

        expect(() =>
          ThreatAnalysisResponseSchema.parse(noThreatResponse),
        ).not.toThrow();
      });

      it('should validate failed analysis response', () => {
        const failedResponse = {
          severity: Severity.INFO,
          type: ThreatStatus.FAILED,
          title: 'Analysis failed',
          description: 'Threat analysis service unavailable',
        };

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
        recipient: {
          [faker.finance.ethereumAddress()]: {
            [StatusGroup.RECIPIENT_INTERACTION]: [
              {
                severity: Severity.WARN,
                type: RecipientStatus.NEW_RECIPIENT,
                title: 'New recipient',
                description: 'First time interacting with this address',
              },
            ],
          },
          [faker.finance.ethereumAddress()]: {
            [StatusGroup.RECIPIENT_INTERACTION]: [
              {
                severity: Severity.INFO,
                type: RecipientStatus.KNOWN_RECIPIENT,
                title: 'Known recipient',
                description: 'Previously interacted with this address',
              },
            ],
          },
        },
        // Contract analysis
        contract: {
          [faker.finance.ethereumAddress()]: {
            [StatusGroup.CONTRACT_VERIFICATION]: [
              {
                severity: Severity.CRITICAL,
                type: ContractStatus.NOT_VERIFIED,
                title: 'Unverified contract',
                description: 'Contract source code not verified',
              },
            ],
          },
        },
        // Threat analysis
        threat: {
          severity: Severity.OK,
          type: ThreatStatus.NO_THREAT,
          title: 'No threats detected',
          description: 'Transaction analysis completed without threats',
        },
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
