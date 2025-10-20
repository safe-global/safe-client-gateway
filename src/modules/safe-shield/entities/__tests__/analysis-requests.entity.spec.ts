import {
  counterpartyAnalysisRequestDtoBuilder,
  threatAnalysisRequestBuilder,
} from './builders/analysis-requests.builder';
import {
  CounterpartyAnalysisRequestSchema,
  ThreatAnalysisRequestSchema,
} from '../analysis-requests.entity';
import { faker } from '@faker-js/faker';
import { typedDataBuilder } from '@/routes/messages/entities/__tests__/typed-data.builder';
import type { TypedData } from '@/domain/messages/entities/typed-data.entity';

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

  describe('ThreatAnalysisRequestSchema', () => {
    it('should validate correct EIP-712 typed data request', () => {
      const validRequest = threatAnalysisRequestBuilder().build();

      expect(() =>
        ThreatAnalysisRequestSchema.parse(validRequest),
      ).not.toThrow();
    });

    it('should validate without origin field', () => {
      const request = threatAnalysisRequestBuilder()
        .with('origin', undefined)
        .build();

      expect(() => ThreatAnalysisRequestSchema.parse(request)).not.toThrow();
    });

    it('should reject invalid walletAddress', () => {
      const request = {
        ...threatAnalysisRequestBuilder().build(),
        walletAddress: 'invalid-address',
      };

      expect(() => ThreatAnalysisRequestSchema.parse(request)).toThrow();
    });

    it('should reject missing walletAddress', () => {
      const request = {
        ...threatAnalysisRequestBuilder().build(),
        walletAddress: undefined,
      };

      expect(() => ThreatAnalysisRequestSchema.parse(request)).toThrow();
    });

    it('should validate with all optional domain fields', () => {
      const typedData = typedDataBuilder()
        .with('domain', {
          chainId: 1,
          name: 'TestApp',
          version: '1',
          verifyingContract: faker.finance.ethereumAddress() as `0x${string}`,
          salt: faker.string.hexadecimal({ length: 64 }) as `0x${string}`,
        })
        .build();

      const request = threatAnalysisRequestBuilder()
        .with('data', typedData)
        .build();

      expect(() => ThreatAnalysisRequestSchema.parse(request)).not.toThrow();
    });

    it('should validate with minimal domain fields', () => {
      const typedData = typedDataBuilder()
        .with('domain', {
          chainId: 1,
        })
        .build();

      const request = threatAnalysisRequestBuilder()
        .with('data', typedData)
        .build();

      expect(() => ThreatAnalysisRequestSchema.parse(request)).not.toThrow();
    });

    it('should reject missing data field', () => {
      expect(() => ThreatAnalysisRequestSchema.parse({})).toThrow();
    });

    it('should reject invalid typed data structure', () => {
      const invalidRequest = threatAnalysisRequestBuilder()
        .with('data', {
          domain: {},
        } as unknown as TypedData)
        .build();

      expect(() => ThreatAnalysisRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject typed data with invalid domain', () => {
      const invalidDomainRequest = threatAnalysisRequestBuilder()
        .with(
          'data',
          typedDataBuilder()
            .with('domain', {
              chainId: 'invalid',
            } as Record<string, unknown>)
            .build(),
        )
        .build();

      expect(() =>
        ThreatAnalysisRequestSchema.parse(invalidDomainRequest),
      ).toThrow();
    });

    it('should reject typed data with missing primaryType', () => {
      const typedData = typedDataBuilder().build();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { primaryType, ...invalidTypedData } = typedData;

      const invalidRequest = {
        walletAddress: faker.finance.ethereumAddress() as `0x${string}`,
        data: invalidTypedData,
      };

      expect(() => ThreatAnalysisRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject typed data with missing types', () => {
      const typedData = typedDataBuilder().build();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { types, ...invalidTypedData } = typedData;

      const invalidRequest = {
        walletAddress: faker.finance.ethereumAddress() as `0x${string}`,
        data: invalidTypedData,
      };

      expect(() => ThreatAnalysisRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject typed data with missing message', () => {
      const typedData = typedDataBuilder().build();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { message, ...invalidTypedData } = typedData;

      const invalidRequest = {
        walletAddress: faker.finance.ethereumAddress() as `0x${string}`,
        data: invalidTypedData,
      };

      expect(() => ThreatAnalysisRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject non-object data field', () => {
      const invalidRequest = {
        walletAddress: faker.finance.ethereumAddress() as `0x${string}`,
        data: 'not an object',
      };

      expect(() => ThreatAnalysisRequestSchema.parse(invalidRequest)).toThrow();
    });
  });
});
