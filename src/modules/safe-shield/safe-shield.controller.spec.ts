import { Test } from '@nestjs/testing';
import { faker } from '@faker-js/faker';
import type { Address } from 'viem';
import { getAddress } from 'viem';
import { SafeShieldController } from './safe-shield.controller';
import { SafeShieldService } from './safe-shield.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { counterpartyAnalysisRequestDtoBuilder } from './entities/__tests__/builders/analysis-requests.builder';
import { counterpartyAnalysisResponseBuilder } from './entities/__tests__/builders/analysis-responses.builder';
import {
  contractAnalysisResultBuilder,
  recipientAnalysisResultBuilder,
} from './entities/__tests__/builders/analysis-result.builder';
import type { RecipientInteractionAnalysisResponse } from '@/modules/safe-shield/entities/analysis-responses.entity';
import { CounterpartyAnalysisRequestSchema } from '@/modules/safe-shield/entities/analysis-requests.entity';

describe('SafeShieldController (Unit)', () => {
  let controller: SafeShieldController;
  let safeShieldService: jest.Mocked<SafeShieldService>;

  const mockChainId = faker.number.int({ min: 1, max: 999999 }).toString();
  const mockSafeAddress = getAddress(faker.finance.ethereumAddress());
  const mockRecipientAddress = getAddress(faker.finance.ethereumAddress());

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [SafeShieldController],
      providers: [
        {
          provide: SafeShieldService,
          useValue: {
            analyzeRecipient: jest.fn(),
            analyzeCounterparty: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(SafeShieldController);
    safeShieldService = moduleRef.get(SafeShieldService);
  });

  describe('analyzeRecipient', () => {
    it('should delegate to SafeShieldService and return analysis results', async () => {
      const expectedResponse = {
        RECIPIENT_INTERACTION: [recipientAnalysisResultBuilder().build()],
      } as RecipientInteractionAnalysisResponse;

      safeShieldService.analyzeRecipient.mockResolvedValue(expectedResponse);

      const result = await controller.analyzeRecipient(
        mockChainId,
        mockSafeAddress,
        mockRecipientAddress,
      );

      expect(result).toEqual(expectedResponse);
      expect(safeShieldService.analyzeRecipient).toHaveBeenCalledWith(
        mockChainId,
        mockSafeAddress,
        mockRecipientAddress,
      );
    });

    it('should propagate errors from SafeShieldService', async () => {
      const error = new Error('Network error');

      safeShieldService.analyzeRecipient.mockRejectedValue(error);

      await expect(
        controller.analyzeRecipient(
          mockChainId,
          mockSafeAddress,
          mockRecipientAddress,
        ),
      ).rejects.toThrow(error);
    });
  });

  describe('analyzeCounterparty', () => {
    const requestBody = counterpartyAnalysisRequestDtoBuilder().build();

    it('should call service with the parsed transaction data', async () => {
      const expectedResponse = counterpartyAnalysisResponseBuilder().build();

      safeShieldService.analyzeCounterparty.mockResolvedValue(expectedResponse);

      const result = await controller.analyzeCounterparty(
        mockChainId,
        mockSafeAddress,
        requestBody,
      );

      expect(result).toEqual(expectedResponse);
      expect(safeShieldService.analyzeCounterparty).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        tx: {
          to: requestBody.to,
          data: requestBody.data,
          value: requestBody.value,
          operation: requestBody.operation,
        },
      });
    });

    it('should propagate errors from SafeShieldService', async () => {
      const error = new Error('Analysis failed');

      safeShieldService.analyzeCounterparty.mockRejectedValue(error);

      await expect(
        controller.analyzeCounterparty(
          mockChainId,
          mockSafeAddress,
          requestBody,
        ),
      ).rejects.toThrow(error);
    });

    it('should reject invalid counterparty analysis requests', () => {
      const pipe = new ValidationPipe(CounterpartyAnalysisRequestSchema);
      const invalidRequest = {
        ...counterpartyAnalysisRequestDtoBuilder().build(),
        to: 'invalid-address' as unknown as Address,
      };

      expect(() => pipe.transform(invalidRequest)).toThrow();
    });

    it('should handle both recipient and contract analysis failures in service', async () => {
      const expectedResponse = counterpartyAnalysisResponseBuilder()
        .with('recipient', {
          [requestBody.to]: {
            RECIPIENT_INTERACTION: [
              {
                type: 'FAILED',
                severity: 'CRITICAL',
                title: 'Analysis Failed',
                description: 'Unable to complete analysis',
              },
            ],
          },
        })
        .with('contract', {
          [requestBody.to]: {
            CONTRACT_VERIFICATION: [
              {
                type: 'FAILED',
                severity: 'CRITICAL',
                title: 'Analysis Failed',
                description: 'Unable to complete analysis',
              },
            ],
          },
        })
        .build();

      safeShieldService.analyzeCounterparty.mockResolvedValue(expectedResponse);

      const result = await controller.analyzeCounterparty(
        mockChainId,
        mockSafeAddress,
        requestBody,
      );

      expect(result).toEqual(expectedResponse);
      expect(result.recipient[requestBody.to]?.RECIPIENT_INTERACTION).toEqual([
        expect.objectContaining({ type: 'FAILED' }),
      ]);
      expect(result.contract[requestBody.to]?.CONTRACT_VERIFICATION).toEqual([
        expect.objectContaining({ type: 'FAILED' }),
      ]);
    });

    it('should handle partial success with recipient analysis succeeding but contract failing', async () => {
      const successfulRecipientAnalysis = {
        [requestBody.to]: {
          RECIPIENT_INTERACTION: [
            recipientAnalysisResultBuilder()
              .with('type', 'NEW_RECIPIENT')
              .build(),
          ],
        },
      };
      const expectedResponse = counterpartyAnalysisResponseBuilder()
        .with('recipient', successfulRecipientAnalysis)
        .with('contract', {
          [requestBody.to]: {
            CONTRACT_VERIFICATION: [
              {
                type: 'FAILED',
                severity: 'CRITICAL',
                title: 'Analysis Failed',
                description: 'Unable to complete analysis',
              },
            ],
          },
        })
        .build();

      safeShieldService.analyzeCounterparty.mockResolvedValue(expectedResponse);

      const result = await controller.analyzeCounterparty(
        mockChainId,
        mockSafeAddress,
        requestBody,
      );

      expect(result.recipient[requestBody.to]).toEqual(
        successfulRecipientAnalysis[requestBody.to],
      );
      expect(result.contract[requestBody.to]?.CONTRACT_VERIFICATION).toEqual([
        expect.objectContaining({ type: 'FAILED' }),
      ]);
    });

    it('should handle partial success with contract analysis succeeding but recipient failing', async () => {
      const successfulContractAnalysis = {
        [requestBody.to]: {
          CONTRACT_VERIFICATION: [
            contractAnalysisResultBuilder().with('type', 'VERIFIED').build(),
          ],
        },
      };
      const expectedResponse = counterpartyAnalysisResponseBuilder()
        .with('recipient', {
          [requestBody.to]: {
            RECIPIENT_INTERACTION: [
              {
                type: 'FAILED',
                severity: 'CRITICAL',
                title: 'Analysis Failed',
                description: 'Unable to complete analysis',
              },
            ],
          },
        })
        .with('contract', successfulContractAnalysis)
        .build();

      safeShieldService.analyzeCounterparty.mockResolvedValue(expectedResponse);

      const result = await controller.analyzeCounterparty(
        mockChainId,
        mockSafeAddress,
        requestBody,
      );

      expect(result.contract[requestBody.to]).toEqual(
        successfulContractAnalysis[requestBody.to],
      );
      expect(result.recipient[requestBody.to]?.RECIPIENT_INTERACTION).toEqual([
        expect.objectContaining({ type: 'FAILED' }),
      ]);
    });
  });
});
