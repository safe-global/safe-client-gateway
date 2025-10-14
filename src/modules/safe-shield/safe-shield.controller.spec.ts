import { Test } from '@nestjs/testing';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { SafeShieldController } from './safe-shield.controller';
import { SafeShieldService } from './safe-shield.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import {
  CounterpartyAnalysisRequestSchema,
  type CounterpartyAnalysisRequestDto,
} from './entities/analysis-requests.entity';
import { counterpartyAnalysisRequestDtoBuilder } from './entities/__tests__/builders/analysis-requests.builder';
import { counterpartyAnalysisResponseBuilder } from './entities/__tests__/builders/analysis-responses.builder';
import { recipientAnalysisResultBuilder } from './entities/__tests__/builders/analysis-result.builder';

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
      };

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
    it('should call SafeShieldService with the parsed transaction', async () => {
      const requestBody = counterpartyAnalysisRequestDtoBuilder().build();
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
      const requestBody = counterpartyAnalysisRequestDtoBuilder().build();
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
  });

  describe('validation', () => {
    it('should reject invalid Safe addresses', () => {
      const pipe = new ValidationPipe(AddressSchema);

      expect(() => pipe.transform('invalid-address')).toThrow();
    });

    it('should reject invalid counterparty analysis requests', () => {
      const pipe = new ValidationPipe(CounterpartyAnalysisRequestSchema);
      const invalidRequest = {
        ...counterpartyAnalysisRequestDtoBuilder().build(),
        to: 'invalid-address' as unknown as CounterpartyAnalysisRequestDto['to'],
      };

      expect(() => pipe.transform(invalidRequest)).toThrow();
    });
  });
});
