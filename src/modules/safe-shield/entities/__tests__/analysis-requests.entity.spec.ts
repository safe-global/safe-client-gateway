import {
  counterpartyAnalysisRequestDtoBuilder,
  threatAnalysisRequestBodyBuilder,
} from './builders/analysis-requests.builder';
import {
  CounterpartyAnalysisRequestSchema,
  ThreatAnalysisRequestSchema,
} from '../analysis-requests.entity';

describe('Analysis Request Schemas', () => {
  describe('CounterpartyAnalysisRequestBodySchema', () => {
    it('should validate correct request body', () => {
      const validRequest = counterpartyAnalysisRequestDtoBuilder().build();

      expect(() =>
        CounterpartyAnalysisRequestSchema.parse(validRequest),
      ).not.toThrow();
    });

    it('should reject invalid address', () => {
      const invalidRequest = {
        ...counterpartyAnalysisRequestDtoBuilder().build(),
        to: 'invalid-address',
      };

      expect(() =>
        CounterpartyAnalysisRequestSchema.parse(invalidRequest),
      ).toThrow();
    });

    it('should reject invalid operation', () => {
      const invalidRequest = {
        ...counterpartyAnalysisRequestDtoBuilder().build(),
        operation: 5,
      };

      expect(() =>
        CounterpartyAnalysisRequestSchema.parse(invalidRequest),
      ).toThrow();
    });
  });

  describe('ThreatAnalysisRequestBodySchema', () => {
    const validThreatRequest = threatAnalysisRequestBodyBuilder().build();

    it('should validate complete threat analysis request', () => {
      expect(() =>
        ThreatAnalysisRequestSchema.parse(validThreatRequest),
      ).not.toThrow();
    });

    it('should validate with delegate call operation', () => {
      const delegatecallRequest = threatAnalysisRequestBodyBuilder()
        .with('operation', 1)
        .build();

      expect(() =>
        ThreatAnalysisRequestSchema.parse(delegatecallRequest),
      ).not.toThrow();
    });

    it('should reject invalid `to` address', () => {
      const invalidAddressRequest = {
        ...validThreatRequest,
        to: 'invalidaddress',
      };

      expect(() =>
        ThreatAnalysisRequestSchema.parse(invalidAddressRequest),
      ).toThrow();
    });

    it('should reject invalid `gasToken` address', () => {
      expect(() =>
        ThreatAnalysisRequestSchema.parse({
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
        ThreatAnalysisRequestSchema.parse(invalidValueRequest),
      ).toThrow();

      expect(() =>
        ThreatAnalysisRequestSchema.parse(invalidNonceRequest),
      ).toThrow();

      expect(() =>
        ThreatAnalysisRequestSchema.parse(invalidSafeTxGasRequest),
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
        ThreatAnalysisRequestSchema.parse(incompleteRequest),
      ).toThrow();
    });
  });
});
