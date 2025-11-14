import {
  counterpartyAnalysisRequestDtoBuilder,
  threatAnalysisRequestBuilder,
} from './builders/analysis-requests.builder';
import {
  CounterpartyAnalysisRequestSchema,
  ThreatAnalysisRequestSchema,
} from '../analysis-requests.entity';
import { faker } from '@faker-js/faker';
import { typedDataBuilder } from '@/modules/messages/routes/entities/__tests__/typed-data.builder';
import type { TypedData } from '@/modules/messages/domain/entities/typed-data.entity';
import { getAddress } from 'viem';

describe('Analysis Request Schemas', () => {
  describe('CounterpartyAnalysisRequestBodySchema', () => {
    it('should validate correct request body', () => {
      const validRequest = counterpartyAnalysisRequestDtoBuilder().build();

      const result = CounterpartyAnalysisRequestSchema.safeParse(validRequest);

      expect(result.success && result.data).toStrictEqual(validRequest);
    });

    it('should reject invalid address', () => {
      const invalidRequest = {
        ...counterpartyAnalysisRequestDtoBuilder().build(),
        to: 'invalid-address',
      };

      const result =
        CounterpartyAnalysisRequestSchema.safeParse(invalidRequest);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: 'Invalid address',
          path: ['to'],
        },
      ]);
    });

    it('should reject invalid operation', () => {
      const invalidRequest = {
        ...counterpartyAnalysisRequestDtoBuilder().build(),
        operation: 5,
      };

      const result =
        CounterpartyAnalysisRequestSchema.safeParse(invalidRequest);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_enum_value',
          message: "Invalid enum value. Expected 0 | 1, received '5'",
          options: [0, 1],
          path: ['operation'],
          received: 5,
        },
      ]);
    });
  });

  describe('ThreatAnalysisRequestSchema', () => {
    it('should validate correct EIP-712 typed data request', () => {
      const validRequest = threatAnalysisRequestBuilder().build();

      const result = ThreatAnalysisRequestSchema.safeParse(validRequest);

      expect(result.success && result.data).toStrictEqual(validRequest);
    });

    it('should validate without origin field', () => {
      const request = threatAnalysisRequestBuilder().build();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { origin, ...requestWoOrigin } = request;

      const result = ThreatAnalysisRequestSchema.safeParse(requestWoOrigin);

      expect(result.success && result.data).toStrictEqual(requestWoOrigin);
    });

    it('should reject invalid walletAddress', () => {
      const request = {
        ...threatAnalysisRequestBuilder().build(),
        walletAddress: 'invalid-address',
      };

      const result = ThreatAnalysisRequestSchema.safeParse(request);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: 'Invalid address',
          path: ['walletAddress'],
        },
      ]);
    });

    it('should reject missing walletAddress', () => {
      const request = threatAnalysisRequestBuilder().build();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { walletAddress, ...requestWoAddress } = request;

      const result = ThreatAnalysisRequestSchema.safeParse(requestWoAddress);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['walletAddress'],
          received: 'undefined',
        },
      ]);
    });

    it('should validate with all optional domain fields', () => {
      const typedData = typedDataBuilder()
        .with('domain', {
          chainId: 1,
          name: 'TestApp',
          version: '1',
          verifyingContract: getAddress(faker.finance.ethereumAddress()),
          salt: faker.string.hexadecimal({ length: 64 }) as `0x${string}`,
        })
        .build();

      const request = threatAnalysisRequestBuilder()
        .with('data', typedData)
        .build();

      const result = ThreatAnalysisRequestSchema.safeParse(request);

      expect(result.success && result.data).toStrictEqual(request);
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

      const result = ThreatAnalysisRequestSchema.safeParse(request);

      expect(result.success && result.data).toStrictEqual(request);
    });

    it('should reject missing data field', () => {
      const result = ThreatAnalysisRequestSchema.safeParse({});

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'object',
          message: 'Required',
          path: ['data'],
          received: 'undefined',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['walletAddress'],
          received: 'undefined',
        },
      ]);
    });

    it('should reject invalid typed data structure', () => {
      const invalidRequest = threatAnalysisRequestBuilder()
        .with('data', {
          domain: {},
        } as unknown as TypedData)
        .build();

      const result = ThreatAnalysisRequestSchema.safeParse(invalidRequest);

      expect(!result.success && result.error.issues.length).toBeGreaterThan(0);
      expect(result?.error?.issues[0].path).toEqual(['data', 'primaryType']);
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

      const result =
        ThreatAnalysisRequestSchema.safeParse(invalidDomainRequest);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'number',
          message: 'Expected number, received nan',
          path: ['data', 'domain', 'chainId'],
          received: 'nan',
        },
      ]);
    });

    it('should reject typed data with missing primaryType', () => {
      const typedData = typedDataBuilder().build();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { primaryType, ...invalidTypedData } = typedData;

      const invalidRequest = {
        walletAddress: faker.finance.ethereumAddress() as `0x${string}`,
        data: invalidTypedData,
      };

      const result = ThreatAnalysisRequestSchema.safeParse(invalidRequest);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Required',
          path: ['data', 'primaryType'],
          received: 'undefined',
        },
      ]);
    });

    it('should reject typed data with missing types', () => {
      const typedData = typedDataBuilder().build();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { types, ...invalidTypedData } = typedData;

      const invalidRequest = {
        walletAddress: faker.finance.ethereumAddress() as `0x${string}`,
        data: invalidTypedData,
      };

      const result = ThreatAnalysisRequestSchema.safeParse(invalidRequest);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'object',
          message: 'Required',
          path: ['data', 'types'],
          received: 'undefined',
        },
      ]);
    });

    it('should reject typed data with missing message', () => {
      const typedData = typedDataBuilder().build();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { message, ...invalidTypedData } = typedData;

      const invalidRequest = {
        walletAddress: faker.finance.ethereumAddress() as `0x${string}`,
        data: invalidTypedData,
      };

      const result = ThreatAnalysisRequestSchema.safeParse(invalidRequest);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'object',
          message: 'Required',
          path: ['data', 'message'],
          received: 'undefined',
        },
      ]);
    });

    it('should reject non-object data field', () => {
      const invalidRequest = {
        walletAddress: faker.finance.ethereumAddress() as `0x${string}`,
        data: 'not an object',
      };

      const result = ThreatAnalysisRequestSchema.safeParse(invalidRequest);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'object',
          message: 'Expected object, received string',
          path: ['data'],
          received: 'string',
        },
      ]);
    });
  });
});
