import {
  recipientAnalysisRequestBodyBuilder,
  contractAnalysisRequestBodyBuilder,
  threatAnalysisRequestBodyBuilder,
} from './builders/analysis-requests.builder';
import {
  RecipientAnalysisRequestBodySchema,
  ContractAnalysisRequestBodySchema,
  ThreatAnalysisRequestBodySchema,
} from '../analysis-requests.entity';
import { faker } from '@faker-js/faker';

describe('Analysis Request Schemas', () => {
  describe('RecipientAnalysisRequestBodySchema', () => {
    it('should validate correct request body', () => {
      const validRequest = recipientAnalysisRequestBodyBuilder().build();

      expect(() =>
        RecipientAnalysisRequestBodySchema.parse(validRequest),
      ).not.toThrow();
    });

    it('should validate empty data', () => {
      const requestWithEmptyData = recipientAnalysisRequestBodyBuilder()
        .with('data', '0x')
        .build();

      expect(() =>
        RecipientAnalysisRequestBodySchema.parse(requestWithEmptyData),
      ).not.toThrow();
    });

    it('should reject invalid hex data', () => {
      const invalidHexRequest = {
        ...recipientAnalysisRequestBodyBuilder().build(),
        data: 'invalidhex',
      };

      expect(() =>
        RecipientAnalysisRequestBodySchema.parse(invalidHexRequest),
      ).toThrow();
    });

    it('should reject missing data field', () => {
      expect(() => RecipientAnalysisRequestBodySchema.parse({})).toThrow();
    });
  });

  describe('ContractAnalysisRequestBodySchema', () => {
    it('should validate correct request body', () => {
      const validRequest = contractAnalysisRequestBodyBuilder().build();

      expect(() =>
        ContractAnalysisRequestBodySchema.parse(validRequest),
      ).not.toThrow();
    });

    it('should validate delegatecall operation', () => {
      const delegatecallRequest = contractAnalysisRequestBodyBuilder()
        .with('operation', 1)
        .build();

      expect(() =>
        ContractAnalysisRequestBodySchema.parse(delegatecallRequest),
      ).not.toThrow();
    });

    it('should reject invalid operation values', () => {
      const invalidOperationRequest = contractAnalysisRequestBodyBuilder()
        .with('operation', 5)
        .build();

      expect(() =>
        ContractAnalysisRequestBodySchema.parse(invalidOperationRequest),
      ).toThrow();
    });

    it('should reject missing fields', () => {
      expect(() =>
        ContractAnalysisRequestBodySchema.parse({
          data: faker.string.hexadecimal({ length: 128 }),
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
    const validThreatRequest = threatAnalysisRequestBodyBuilder().build();

    it('should validate complete threat analysis request', () => {
      expect(() =>
        ThreatAnalysisRequestBodySchema.parse(validThreatRequest),
      ).not.toThrow();
    });

    it('should validate with delegate call operation', () => {
      const delegatecallRequest = threatAnalysisRequestBodyBuilder()
        .with('operation', 1)
        .build();

      expect(() =>
        ThreatAnalysisRequestBodySchema.parse(delegatecallRequest),
      ).not.toThrow();
    });

    it('should reject invalid `to` address', () => {
      const invalidAddressRequest = {
        ...validThreatRequest,
        to: 'invalidaddress',
      };

      expect(() =>
        ThreatAnalysisRequestBodySchema.parse(invalidAddressRequest),
      ).toThrow();
    });

    it('should reject invalid `gasToken` address', () => {
      expect(() =>
        ThreatAnalysisRequestBodySchema.parse({
          ...validThreatRequest,
          gasToken: '0xinvalid',
        }),
      ).toThrow();
    });

    it('should reject invalid numeric strings', () => {
      const invalidValueRequest = {
        ...validThreatRequest,
        value: 'notanumber',
      };

      const invalidNonceRequest = {
        ...validThreatRequest,
        nonce: 'notanumber',
      };

      const invalidSafeTxGasRequest = {
        ...validThreatRequest,
        safeTxGas: '',
      };

      expect(() =>
        ThreatAnalysisRequestBodySchema.parse(invalidValueRequest),
      ).toThrow();

      expect(() =>
        ThreatAnalysisRequestBodySchema.parse(invalidNonceRequest),
      ).toThrow();

      expect(() =>
        ThreatAnalysisRequestBodySchema.parse(invalidSafeTxGasRequest),
      ).toThrow();
    });

    it.each([
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
    ] as const)('should reject missing required field = %s', (field) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [field]: _, ...incompleteRequest } = validThreatRequest;

      expect(() =>
        ThreatAnalysisRequestBodySchema.parse(incompleteRequest),
      ).toThrow();
    });
  });
});
