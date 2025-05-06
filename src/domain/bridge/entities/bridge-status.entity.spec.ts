import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import {
  baseStatusDataBuilder,
  baseTransactionInfoBuilder,
  bridgeStatusBuilder,
  extendedTransactionInfoBuilder,
  failedStatusDataBuilder,
  fullStatusDataBuilder,
  includedStepBuilder,
  pendingReceivingInfoBuilder,
  setupToolDetailsBuilder,
  statusDataBuilder,
  transferMetadataBuilder,
} from '@/domain/bridge/entities/__tests__/bridge-status.builder';
import {
  BaseStatusDataSchema,
  BaseTransactionInfoSchema,
  BridgeStatusSchema,
  ExtendedTransactionInfoSchema,
  FailedStatusDataSchema,
  FullStatusDataSchema,
  IncludedStepSchema,
  PendingReceivingInfoSchema,
  SetupToolDetailsSchema,
  StatusDataSchema,
  StatusMessages,
  TransferMetadataSchema,
} from '@/domain/bridge/entities/bridge-status.entity';

describe('BridgeStatusSchema', () => {
  describe('BaseStatusDataSchema', () => {
    it('should validate a BaseStatusData', () => {
      const baseStatusData = baseStatusDataBuilder().build();

      const result = BaseStatusDataSchema.safeParse(baseStatusData);

      expect(result.success).toBe(true);
    });

    it.each(['status' as const, 'substatus' as const])(
      '%s should fallback to UNKNOWN',
      (key) => {
        const baseStatusData = baseStatusDataBuilder()
          .with(key, 'not a real status' as 'UNKNOWN')
          .build();

        const result = BaseStatusDataSchema.safeParse(baseStatusData);

        expect(result.success && result.data[key]).toBe('UNKNOWN');
      },
    );

    it('should default substatusMessage to null', () => {
      const baseStatusData = baseStatusDataBuilder().build();
      // @ts-expect-error - inferred type expects defined value
      delete baseStatusData.substatusMessage;

      const result = BaseStatusDataSchema.safeParse(baseStatusData);

      expect(result.success && result.data.substatusMessage).toBe(null);
    });
  });

  describe('BaseTransactionInfoSchema', () => {
    it('should validate a BaseTransactionInfo', () => {
      const baseTransactionInfo = baseTransactionInfoBuilder().build();

      const result = BaseTransactionInfoSchema.safeParse(baseTransactionInfo);

      expect(result.success).toBe(true);
    });

    it('should coerce chainId to string', () => {
      const chainId = faker.number.int();
      const baseTransactionInfo = baseTransactionInfoBuilder()
        .with('chainId', chainId as unknown as string)
        .build();

      const result = BaseTransactionInfoSchema.safeParse(baseTransactionInfo);

      expect(result.success && result.data.chainId).toBe(String(chainId));
    });
  });

  describe('SetupToolDetailsSchema', () => {
    it('should validate a SetupToolDetails', () => {
      const setupToolDetails = setupToolDetailsBuilder().build();

      const result = SetupToolDetailsSchema.safeParse(setupToolDetails);

      expect(result.success).toBe(true);
    });
  });

  describe('IncludedStepSchema', () => {
    it('should validate an IncludedStep', () => {
      const includedStep = includedStepBuilder().build();

      const result = IncludedStepSchema.safeParse(includedStep);

      expect(result.success).toBe(true);
    });

    it('should default bridgedAmount to null', () => {
      const includedStep = includedStepBuilder().build();
      // @ts-expect-error - inferred type expects defined value
      delete includedStep.bridgedAmount;

      const result = IncludedStepSchema.safeParse(includedStep);

      expect(result.success && result.data.bridgedAmount).toBe(null);
    });
  });

  describe('PendingReceivingInfoSchema', () => {
    it('should validate a PendingReceivingInfo', () => {
      const pendingReceivingInfo = pendingReceivingInfoBuilder().build();

      const result = PendingReceivingInfoSchema.safeParse(pendingReceivingInfo);

      expect(result.success).toBe(true);
    });

    it('should coerce chainId to string', () => {
      const chainId = faker.number.int();
      const pendingReceivingInfo = pendingReceivingInfoBuilder()
        .with('chainId', chainId as unknown as string)
        .build();

      const result = PendingReceivingInfoSchema.safeParse(pendingReceivingInfo);

      expect(result.success && result.data.chainId).toBe(String(chainId));
    });
  });

  describe('ExtendedTransactionInfoSchema', () => {
    it('should validate an ExtendedTransactionInfo', () => {
      const extendedTransactionInfo = extendedTransactionInfoBuilder().build();

      const result = ExtendedTransactionInfoSchema.safeParse(
        extendedTransactionInfo,
      );

      expect(result.success).toBe(true);
    });

    it.each([
      'amount' as const,
      'amountUSD' as const,
      'token' as const,
      'timestamp' as const,
      'value' as const,
      'includedSteps' as const,
    ])('%s should default to null', (key) => {
      const extendedTransactionInfo = extendedTransactionInfoBuilder().build();
      delete extendedTransactionInfo[key];

      const result = ExtendedTransactionInfoSchema.safeParse(
        extendedTransactionInfo,
      );

      expect(result.success && result.data[key]).toBe(null);
    });
  });

  describe('TransferMetadataSchema', () => {
    it('should validate a TransferMetadata', () => {
      const transferMetadata = transferMetadataBuilder().build();

      const result = TransferMetadataSchema.safeParse(transferMetadata);

      expect(result.success).toBe(true);
    });
  });

  describe('FullStatusDataSchema', () => {
    it('should validate a FullStatusData', () => {
      const fullStatusData = fullStatusDataBuilder().build();

      const result = FullStatusDataSchema.safeParse(fullStatusData);

      expect(result.success).toBe(true);
    });

    it.each(['fromAddress' as const, 'toAddress' as const])(
      '%s should be checksummed',
      (key) => {
        const nonChecksummedAddress = faker.finance
          .ethereumAddress()
          .toLowerCase();
        const fullStatusData = fullStatusDataBuilder()
          .with(key, nonChecksummedAddress as `0x${string}`)
          .build();

        const result = FullStatusDataSchema.safeParse(fullStatusData);

        expect(result.success && result.data[key]).toBe(
          getAddress(nonChecksummedAddress),
        );
      },
    );

    it('should default bridgeExplorerLink to null', () => {
      const fullStatusData = fullStatusDataBuilder().build();
      // @ts-expect-error - inferred type expects defined value
      delete fullStatusData.bridgeExplorerLink;

      const result = FullStatusDataSchema.safeParse(fullStatusData);

      expect(result.success && result.data.bridgeExplorerLink).toBe(null);
    });
  });

  describe('StatusDataSchema', () => {
    it('should validate a StatusData', () => {
      const statusData = statusDataBuilder().build();

      const result = StatusDataSchema.safeParse(statusData);

      expect(result.success).toBe(true);
    });
  });

  describe('FailedStatusDataSchema', () => {
    it('should validate a FailedStatusData', () => {
      const failedStatusData = failedStatusDataBuilder().build();

      const result = FailedStatusDataSchema.safeParse(failedStatusData);

      expect(result.success).toBe(true);
    });

    it('should only accept FAILED status', () => {
      const status = faker.helpers.arrayElement(
        StatusMessages.filter((status) => status !== 'FAILED'),
      );
      const failedStatusData = failedStatusDataBuilder()
        .with('status', status as 'FAILED')
        .build();

      const result = FailedStatusDataSchema.safeParse(failedStatusData);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_literal',
          expected: 'FAILED',
          message: 'Invalid literal value, expected "FAILED"',
          path: ['status'],
          received: status,
        },
      ]);
    });
  });

  describe('BridgeStatusSchema', () => {
    it('should validate a BridgeStatus', () => {
      const bridgeStatus = bridgeStatusBuilder().build();

      const result = BridgeStatusSchema.safeParse(bridgeStatus);

      expect(result.success).toBe(true);
    });
  });
});
