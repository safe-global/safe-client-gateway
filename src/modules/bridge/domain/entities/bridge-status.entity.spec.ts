import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';
import {
  baseStatusDataBuilder,
  baseTransactionInfoBuilder,
  bridgeStatusBuilder,
  extendedTransactionInfoBuilder,
  failedStatusDataBuilder,
  pendingReceivingInfoBuilder,
  successStatusDataBuilder,
  transferMetadataBuilder,
} from '@/modules/bridge/domain/entities/__tests__/bridge-status.builder';
import {
  BaseStatusDataSchema,
  BaseTransactionInfoSchema,
  BridgeStatusSchema,
  ExtendedTransactionInfoSchema,
  FailedStatusDataSchema,
  PendingReceivingInfoSchema,
  SuccessStatusDataSchema,
  TransferMetadataSchema,
} from '@/modules/bridge/domain/entities/bridge-status.entity';

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
          .with(key, 'not a real status' as unknown as 'DONE')
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

      expect(result.success).toBe(true);
      expect(result.data?.substatusMessage).toBe(null);
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
      'token' as const,
      'timestamp' as const,
      'value' as const,
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

  describe('SuccessStatusDataSchema', () => {
    it('should validate a SuccessStatusData', () => {
      const successStatusData = successStatusDataBuilder().build();

      const result = SuccessStatusDataSchema.safeParse(successStatusData);

      expect(result.success).toBe(true);
    });

    it.each(['fromAddress' as const, 'toAddress' as const])(
      '%s should be checksummed',
      (key) => {
        const nonChecksummedAddress = faker.finance
          .ethereumAddress()
          .toLowerCase();
        const fullStatusData = successStatusDataBuilder()
          .with(key, nonChecksummedAddress as Address)
          .build();

        const result = SuccessStatusDataSchema.safeParse(fullStatusData);

        expect(result.success && result.data[key]).toBe(
          getAddress(nonChecksummedAddress),
        );
      },
    );

    it('should default bridgeExplorerLink to null', () => {
      const fullStatusData = successStatusDataBuilder().build();
      // @ts-expect-error - inferred type expects defined value
      delete fullStatusData.bridgeExplorerLink;

      const result = SuccessStatusDataSchema.safeParse(fullStatusData);

      expect(result.success && result.data.bridgeExplorerLink).toBe(null);
    });
  });

  describe('FailedStatusDataSchema', () => {
    it('should validate a FailedStatusData', () => {
      const failedStatusData = failedStatusDataBuilder().build();

      const result = FailedStatusDataSchema.safeParse(failedStatusData);

      expect(result.success).toBe(true);
    });

    it('should only accept FAILED, INVALID, or NOT_FOUND status', () => {
      const failedStatusData = failedStatusDataBuilder()
        .with('status', 'DONE' as 'FAILED')
        .build();

      const result = FailedStatusDataSchema.safeParse(failedStatusData);

      expect(result.success).toBe(false);

      expect(result.error?.issues).toStrictEqual([
        {
          code: 'invalid_enum_value',
          options: ['FAILED', 'INVALID', 'NOT_FOUND'],
          message:
            "Invalid enum value. Expected 'FAILED' | 'INVALID' | 'NOT_FOUND', received 'DONE'",
          path: ['status'],
          received: 'DONE',
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
