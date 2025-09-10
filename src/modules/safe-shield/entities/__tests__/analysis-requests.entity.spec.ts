import {
  RecipientAnalysisRequestBodySchema,
  ContractAnalysisRequestBodySchema,
  ThreatAnalysisRequestBodySchema,
} from '../analysis-requests.entity';
import {
  RecipientAnalysisRequestBuilder,
  ContractAnalysisRequestBuilder,
  ThreatAnalysisRequestBuilder,
} from './builders';

describe('Analysis Request Schemas', () => {
  describe('RecipientAnalysisRequestBodySchema', () => {
    it('should validate correct request body', () => {
      const validRequest = RecipientAnalysisRequestBuilder.new().build();

      expect(() =>
        RecipientAnalysisRequestBodySchema.parse(validRequest),
      ).not.toThrow();
    });

    it('should validate empty data', () => {
      const requestWithEmptyData = RecipientAnalysisRequestBuilder.new()
        .withEmptyData()
        .build();

      expect(() =>
        RecipientAnalysisRequestBodySchema.parse(requestWithEmptyData),
      ).not.toThrow();
    });

    it('should reject invalid hex data', () => {
      const invalidHexRequest = RecipientAnalysisRequestBuilder.new()
        .withInvalidData()
        .build();

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
      const validRequest = ContractAnalysisRequestBuilder.new().build();

      expect(() =>
        ContractAnalysisRequestBodySchema.parse(validRequest),
      ).not.toThrow();
    });

    it('should validate delegatecall operation', () => {
      const delegatecallRequest = ContractAnalysisRequestBuilder.new()
        .withDelegatecall()
        .build();

      expect(() =>
        ContractAnalysisRequestBodySchema.parse(delegatecallRequest),
      ).not.toThrow();
    });

    it('should reject invalid operation values', () => {
      const invalidOperationRequest = ContractAnalysisRequestBuilder.new()
        .withInvalidOperation()
        .build();

      expect(() =>
        ContractAnalysisRequestBodySchema.parse(invalidOperationRequest),
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
    const validThreatRequest = ThreatAnalysisRequestBuilder.new().build();

    it('should validate complete threat analysis request', () => {
      expect(() =>
        ThreatAnalysisRequestBodySchema.parse(validThreatRequest),
      ).not.toThrow();
    });

    it('should validate with different operation type', () => {
      const delegatecallRequest = ThreatAnalysisRequestBuilder.new()
        .withDelegatecall()
        .build();

      expect(() =>
        ThreatAnalysisRequestBodySchema.parse(delegatecallRequest),
      ).not.toThrow();
    });

    it('should reject invalid `to` address', () => {
      const invalidAddressRequest = ThreatAnalysisRequestBuilder.new()
        .withInvalidAddress()
        .build();

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
      const invalidValueRequest = ThreatAnalysisRequestBuilder.new()
        .withInvalidValue()
        .build();

      const invalidNonceRequest = ThreatAnalysisRequestBuilder.new()
        .withInvalidNonce()
        .build();

      expect(() =>
        ThreatAnalysisRequestBodySchema.parse(invalidValueRequest),
      ).toThrow();

      expect(() =>
        ThreatAnalysisRequestBodySchema.parse(invalidNonceRequest),
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
