import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import {
  actionBuilder,
  callActionBuilder,
  crossStepBuilder,
  customStepBuilder,
  estimateBuilder,
  protocolStepBuilder,
  stepBaseBuilder,
  stepBuilder,
  stepToolDetailsBuilder,
  swapStepBuilder,
  transactionRequestBuilder,
} from '@/domain/bridge/entities/__tests__/bridge-step.builder';
import {
  ActionSchema,
  CallActionSchema,
  CrossStepSchema,
  CustomStepSchema,
  EstimateSchema,
  ProtocolStepSchema,
  StepBaseSchema,
  StepSchema,
  StepToolDetailsSchema,
  StepTypes,
  SwapStepSchema,
  TransactionRequestSchema,
} from '@/domain/bridge/entities/bridge-step.entity';

describe('StepSchema', () => {
  describe('ActionSchema', () => {
    it('should validate an Action', () => {
      const action = actionBuilder().build();

      const result = ActionSchema.safeParse(action);

      expect(result.success).toBe(true);
    });

    it('should coerce fromChainId to string', () => {
      const fromChainId = faker.number.int();
      const action = actionBuilder()
        .with('fromChainId', fromChainId as unknown as string)
        .build();

      const result = ActionSchema.safeParse(action);

      expect(result.success && result.data.fromChainId).toBe(
        String(fromChainId),
      );
    });

    it.each([
      'fromAddress' as const,
      'toAddress' as const,
      'slippage' as const,
    ])('should default %s to null', (key) => {
      const action = actionBuilder().with(key, faker.number.int()).build();
      delete action[key];

      const result = ActionSchema.safeParse(action);

      expect(result.success && result.data[key]).toBe(null);
    });

    it.each(['fromAddress' as const, 'toAddress' as const])(
      'should checksum %s',
      (key) => {
        const nonChecksummedAddress = faker.finance
          .ethereumAddress()
          .toLowerCase();
        const action = actionBuilder()
          .with(key, nonChecksummedAddress as `0x${string}`)
          .build();

        const result = ActionSchema.safeParse(action);

        expect(result.success && result.data[key]).toBe(
          getAddress(nonChecksummedAddress),
        );
      },
    );
  });

  describe('EstimateSchema', () => {
    it.each([
      'fromAmountUSD' as const,
      'toAmountUSD' as const,
      'feeCosts' as const,
      'gasCosts' as const,
    ])('should default %s to null', (key) => {
      const estimate = estimateBuilder().build();
      delete estimate[key];

      const result = EstimateSchema.safeParse(estimate);

      expect(result.success && result.data[key]).toBe(null);
    });
  });

  describe('StepToolDetailsSchema', () => {
    it('should validate a StepToolDetails', () => {
      const stepToolDetails = stepToolDetailsBuilder().build();

      const result = StepToolDetailsSchema.safeParse(stepToolDetails);

      expect(result.success).toBe(true);
    });
  });

  describe('TransactionRequestSchema', () => {
    it('should validate a TransactionRequest', () => {
      const transactionRequest = transactionRequestBuilder().build();

      const result = TransactionRequestSchema.safeParse(transactionRequest);

      expect(result.success).toBe(true);
    });

    it.each(['to' as const, 'from' as const])('should checksum %s', (key) => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const transactionRequest = transactionRequestBuilder()
        .with(key, nonChecksummedAddress as `0x${string}`)
        .build();

      const result = TransactionRequestSchema.safeParse(transactionRequest);

      expect(result.success && result.data[key]).toBe(
        getAddress(nonChecksummedAddress),
      );
    });

    it('should checksum accessList[number].address', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const transactionRequest = transactionRequestBuilder()
        .with('accessList', [
          {
            address: nonChecksummedAddress as `0x${string}`,
            storageKeys: [],
          },
        ])
        .build();

      const result = TransactionRequestSchema.safeParse(transactionRequest);

      expect(result.success && result.data.accessList![0].address).toBe(
        getAddress(nonChecksummedAddress),
      );
    });

    it.each([
      'to' as const,
      'from' as const,
      'nonce' as const,
      'gasLimit' as const,
      'gasPrice' as const,
      'data' as const,
      'value' as const,
      'chainId' as const,
      'type' as const,
      'accessList' as const,
      'maxPriorityFeePerGas' as const,
      'maxFeePerGas' as const,
      'customData' as const,
      'ccipReadEnabled' as const,
    ])('should default %s to null', (key) => {
      const transactionRequest = transactionRequestBuilder().build();
      delete transactionRequest[key];

      const result = TransactionRequestSchema.safeParse(transactionRequest);

      expect(result.success && result.data[key]).toBe(null);
    });

    it('should not allow non-hex data', () => {
      const transactionRequest = transactionRequestBuilder()
        .with('data', 'not hex' as `0x${string}`)
        .build();

      const result = TransactionRequestSchema.safeParse(transactionRequest);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: 'Invalid "0x" notated hex string',
          path: ['data'],
        },
      ]);
    });

    it('should coerce chainId to string', () => {
      const chainId = faker.number.int();
      const transactionRequest = transactionRequestBuilder()
        .with('chainId', chainId as unknown as string)
        .build();

      const result = TransactionRequestSchema.safeParse(transactionRequest);

      expect(result.success && result.data.chainId).toBe(String(chainId));
    });
  });

  describe('StepBaseSchema', () => {
    it('should validate a StepBase', () => {
      const stepBase = stepBaseBuilder().build();

      const result = StepBaseSchema.safeParse(stepBase);

      expect(result.success).toBe(true);
    });

    it('type should default to unknown', () => {
      const stepBase = stepBaseBuilder()
        .with(
          'type',
          'not a type' as Exclude<(typeof StepTypes)[number], 'lifi'>,
        )
        .build();

      const result = StepBaseSchema.safeParse(stepBase);

      expect(result.success && result.data.type).toBe('unknown');
    });

    it.each([
      'integrator' as const,
      'referrer' as const,
      'estimate' as const,
      'transactionRequest' as const,
      'typedData' as const,
    ])('should default %s to null', (key) => {
      const stepBase = stepBaseBuilder().build();
      delete stepBase[key];

      const result = StepBaseSchema.safeParse(stepBase);

      expect(result.success && result.data[key]).toBe(null);
    });
  });

  describe('SwapStepSchema', () => {
    it('should validate a SwapStep', () => {
      const swapStep = swapStepBuilder().build();

      const result = SwapStepSchema.safeParse(swapStep);

      expect(result.success).toBe(true);
    });

    it('should only accept swap type', () => {
      const type = faker.helpers.arrayElement(
        StepTypes.filter((type) => type !== 'swap'),
      );
      const swapStep = swapStepBuilder()
        .with('type', type as 'swap')
        .build();

      const result = SwapStepSchema.safeParse(swapStep);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_literal',
          expected: 'swap',
          message: 'Invalid literal value, expected "swap"',
          path: ['type'],
          received: type,
        },
      ]);
    });
  });

  describe('CrossStepSchema', () => {
    it('should validate a CrossStep', () => {
      const crossStep = crossStepBuilder().build();

      const result = CrossStepSchema.safeParse(crossStep);

      expect(result.success).toBe(true);
    });

    it('should only accept cross type', () => {
      const type = faker.helpers.arrayElement(
        StepTypes.filter((type) => type !== 'cross'),
      );
      const crossStep = crossStepBuilder()
        .with('type', type as 'cross')
        .build();

      const result = CrossStepSchema.safeParse(crossStep);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_literal',
          expected: 'cross',
          message: 'Invalid literal value, expected "cross"',
          path: ['type'],
          received: type,
        },
      ]);
    });
  });

  describe('ProtocolStepSchema', () => {
    it('should validate a ProtocolStep', () => {
      const protocolStep = protocolStepBuilder().build();

      const result = ProtocolStepSchema.safeParse(protocolStep);

      expect(result.success).toBe(true);
    });

    it('should only accept protocol type', () => {
      const type = faker.helpers.arrayElement(
        StepTypes.filter((type) => type !== 'protocol'),
      );
      const protocolStep = protocolStepBuilder()
        .with('type', type as 'protocol')
        .build();

      const result = ProtocolStepSchema.safeParse(protocolStep);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_literal',
          expected: 'protocol',
          message: 'Invalid literal value, expected "protocol"',
          path: ['type'],
          received: type,
        },
      ]);
    });
  });

  describe('CallActionSchema', () => {
    it('should validate a CallAction', () => {
      const callAction = callActionBuilder().build();

      const result = CallActionSchema.safeParse(callAction);

      expect(result.success).toBe(true);
    });

    it.each(['toContractAddress' as const, 'toFallbackAddress' as const])(
      'should checksum %s',
      (key) => {
        const nonChecksummedAddress = faker.finance
          .ethereumAddress()
          .toLowerCase();
        const callAction = callActionBuilder()
          .with(key, nonChecksummedAddress as `0x${string}`)
          .build();

        const result = CallActionSchema.safeParse(callAction);

        expect(result.success && result.data[key]).toBe(
          getAddress(nonChecksummedAddress),
        );
      },
    );

    it('should not allow non-hex toContractCallData', () => {
      const callAction = callActionBuilder()
        .with('toContractCallData', 'not hex' as `0x${string}`)
        .build();

      const result = CallActionSchema.safeParse(callAction);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: 'Invalid "0x" notated hex string',
          path: ['toContractCallData'],
        },
      ]);
    });
  });

  describe('CustomStepSchema', () => {
    it('should validate a CustomStep', () => {
      const customStep = customStepBuilder().build();

      const result = CustomStepSchema.safeParse(customStep);

      expect(result.success).toBe(true);
    });

    it('should only accept custom type', () => {
      const type = faker.helpers.arrayElement(
        StepTypes.filter((type) => type !== 'custom'),
      );
      const customStep = customStepBuilder()
        .with('type', type as 'custom')
        .build();

      const result = CustomStepSchema.safeParse(customStep);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_literal',
          expected: 'custom',
          message: 'Invalid literal value, expected "custom"',
          path: ['type'],
          received: type,
        },
      ]);
    });
  });

  describe('StepSchema', () => {
    it('should validate a Step', () => {
      const step = stepBuilder().build();

      const result = StepSchema.safeParse(step);

      expect(result.success).toBe(true);
    });

    it('should only accept known types', () => {
      const type = faker.word.sample();
      const step = stepBuilder()
        .with('type', type as 'swap')
        .build();

      const result = StepSchema.safeParse(step);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_union_discriminator',
          message:
            "Invalid discriminator value. Expected 'swap' | 'cross' | 'protocol' | 'custom'",
          options: ['swap', 'cross', 'protocol', 'custom'],
          path: ['type'],
        },
      ]);
    });
  });
});
