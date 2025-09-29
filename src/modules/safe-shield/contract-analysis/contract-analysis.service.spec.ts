import { ContractAnalysisService } from '@/modules/safe-shield/contract-analysis/contract-analysis.service';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IDataDecoderApi } from '@/domain/interfaces/data-decoder-api.interface';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import { faker } from '@faker-js/faker';
import type { Hex } from 'viem';
import { getAddress } from 'viem';
import {
  SEVERITY_MAPPING,
  TITLE_MAPPING,
  DESCRIPTION_MAPPING,
} from './contract-analysis.constants';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { contractBuilder } from '@/domain/data-decoder/v2/entities/__tests__/contract.builder';

const mockDataDecoderApi = {
  getContracts: jest.fn(),
} as jest.MockedObjectDeep<IDataDecoderApi>;

const mockTransactionApi = {
  getMultisigTransactions: jest.fn(),
} as jest.MockedObjectDeep<ITransactionApi>;

const mockTransactionApiManager = {
  getApi: jest.fn(),
} as jest.MockedObjectDeep<ITransactionApiManager>;

const mockConfigurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;

const mockLoggingService = {
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockErc20Decoder = {
  helpers: {
    isTransfer: jest.fn(),
    isTransferFrom: jest.fn(),
  },
} as jest.MockedObjectDeep<Erc20Decoder>;

describe('ContractAnalysisService', () => {
  let service: ContractAnalysisService;
  let fakeCacheService: FakeCacheService;

  beforeEach(() => {
    fakeCacheService = new FakeCacheService();

    mockConfigurationService.getOrThrow.mockReturnValue(3600);

    service = new ContractAnalysisService(
      mockDataDecoderApi,
      mockTransactionApiManager,
      mockErc20Decoder,
      fakeCacheService,
      mockConfigurationService,
      mockLoggingService,
    );

    mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);
  });

  afterEach(() => {
    jest.clearAllMocks();
    fakeCacheService.clear();
  });

  describe('analyzeContract', () => {
    it('should return combined analysis results from verification and interaction checks', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const contractAddress = getAddress(faker.finance.ethereumAddress());
      const interactionCount = faker.number.int({ min: 1, max: 10 });
      const name = faker.company.name();

      const mockContractPage = pageBuilder()
        .with('count', 1)
        .with('results', [
          contractBuilder()
            .with('address', contractAddress)
            .with('abi', {
              abiJson: [{ type: 'function', name: 'test' }],
              abiHash: faker.string.hexadecimal() as Hex,
              modified: faker.date.recent(),
            })
            .with('displayName', name)
            .build(),
        ])
        .build();

      mockDataDecoderApi.getContracts.mockResolvedValue(
        rawify(mockContractPage),
      );

      const mockTransactionPage = pageBuilder()
        .with('count', interactionCount)
        .build();

      mockTransactionApi.getMultisigTransactions.mockResolvedValue(
        rawify(mockTransactionPage),
      );

      const result = await service.analyzeContract({
        chainId,
        safeAddress,
        contract: contractAddress,
      });

      expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
        address: contractAddress,
        chainId,
      });

      expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(chainId);
      expect(mockTransactionApi.getMultisigTransactions).toHaveBeenCalledWith({
        safeAddress,
        to: contractAddress,
        limit: 1,
      });

      expect(result).toEqual({
        CONTRACT_VERIFICATION: [
          {
            severity: SEVERITY_MAPPING.VERIFIED,
            type: 'VERIFIED',
            title: TITLE_MAPPING.VERIFIED,
            description: DESCRIPTION_MAPPING.VERIFIED({ name }),
          },
        ],
        CONTRACT_INTERACTION: [
          {
            severity: SEVERITY_MAPPING.KNOWN_CONTRACT,
            type: 'KNOWN_CONTRACT',
            title: TITLE_MAPPING.KNOWN_CONTRACT,
            description: DESCRIPTION_MAPPING.KNOWN_CONTRACT({
              interactions: interactionCount,
            }),
          },
        ],
        DELEGATECALL: [],
      });
    });

    it('should handle errors from parallel operations correctly', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const contractAddress = getAddress(faker.finance.ethereumAddress());
      const errorMessage = 'Transaction API error';

      const mockContractPage = pageBuilder()
        .with('count', 1)
        .with('results', [
          contractBuilder()
            .with('address', contractAddress)
            .with('abi', {
              abiJson: [{ type: 'function', name: 'test' }],
              abiHash: faker.string.hexadecimal() as Hex,
              modified: faker.date.recent(),
            })
            .build(),
        ])
        .build();

      mockDataDecoderApi.getContracts.mockResolvedValue(
        rawify(mockContractPage),
      );
      mockTransactionApi.getMultisigTransactions.mockRejectedValue(
        new Error(errorMessage),
      );

      await expect(
        service.analyzeContract({
          chainId,
          safeAddress,
          contract: contractAddress,
        }),
      ).rejects.toThrow(errorMessage);

      expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
        address: contractAddress,
        chainId,
      });
      expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(chainId);
    });
  });

  describe('verifyContract', () => {
    it('should return VERIFIED when contract has ABI and displayName', async () => {
      const chainId = faker.string.numeric();
      const contractAddress = getAddress(faker.finance.ethereumAddress());
      const name = faker.company.name();

      const mockContractPage = pageBuilder()
        .with('count', 1)
        .with('results', [
          contractBuilder()
            .with('address', contractAddress)
            .with('abi', {
              abiJson: [{ type: 'function', name: 'test' }],
              abiHash: faker.string.hexadecimal() as Hex,
              modified: faker.date.recent(),
            })
            .with('displayName', name)
            .build(),
        ])
        .build();

      mockDataDecoderApi.getContracts.mockResolvedValue(
        rawify(mockContractPage),
      );

      const result = await service.verifyContract({
        chainId,
        contract: contractAddress,
      });

      expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
        address: contractAddress,
        chainId,
      });

      expect(result).toEqual({
        severity: SEVERITY_MAPPING.VERIFIED,
        type: 'VERIFIED',
        title: TITLE_MAPPING.VERIFIED,
        description: DESCRIPTION_MAPPING.VERIFIED({ name: name }),
      });
    });

    it('should return VERIFIED with name when displayName is not present', async () => {
      const chainId = faker.string.numeric();
      const contractAddress = getAddress(faker.finance.ethereumAddress());
      const name = faker.company.name();

      const mockContractPage = pageBuilder()
        .with('count', 1)
        .with('results', [
          contractBuilder()
            .with('address', contractAddress)
            .with('abi', {
              abiJson: [{ type: 'function', name: 'test' }],
              abiHash: faker.string.hexadecimal() as Hex,
              modified: faker.date.recent(),
            })
            .with('name', name)
            .with('displayName', '')
            .build(),
        ])
        .build();

      mockDataDecoderApi.getContracts.mockResolvedValue(
        rawify(mockContractPage),
      );

      const result = await service.verifyContract({
        chainId,
        contract: contractAddress,
      });

      expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
        address: contractAddress,
        chainId,
      });

      expect(result).toEqual({
        severity: SEVERITY_MAPPING.VERIFIED,
        type: 'VERIFIED',
        title: TITLE_MAPPING.VERIFIED,
        description: DESCRIPTION_MAPPING.VERIFIED({ name: name }),
      });
    });

    it('should return VERIFIED without name when name/displayName are not present', async () => {
      const chainId = faker.string.numeric();
      const contractAddress = getAddress(faker.finance.ethereumAddress());

      const mockContractPage = pageBuilder()
        .with('count', 1)
        .with('results', [
          contractBuilder()
            .with('address', contractAddress)
            .with('abi', {
              abiJson: [{ type: 'function', name: 'test' }],
              abiHash: faker.string.hexadecimal() as Hex,
              modified: faker.date.recent(),
            })
            .with('name', '')
            .with('displayName', '')
            .build(),
        ])
        .build();

      mockDataDecoderApi.getContracts.mockResolvedValue(
        rawify(mockContractPage),
      );

      const result = await service.verifyContract({
        chainId,
        contract: contractAddress,
      });

      expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
        address: contractAddress,
        chainId,
      });

      expect(result).toEqual({
        severity: SEVERITY_MAPPING.VERIFIED,
        type: 'VERIFIED',
        title: TITLE_MAPPING.VERIFIED,
        description: 'This contract is verified.',
      });
    });

    it('should return NOT_VERIFIED when contract exists but has no ABI', async () => {
      const chainId = faker.string.numeric();
      const contractAddress = getAddress(faker.finance.ethereumAddress());

      const mockContractPage = pageBuilder()
        .with('count', 1)
        .with('results', [
          contractBuilder()
            .with('address', contractAddress)
            .with('abi', null)
            .build(),
        ])
        .build();

      mockDataDecoderApi.getContracts.mockResolvedValue(
        rawify(mockContractPage),
      );

      const result = await service.verifyContract({
        chainId,
        contract: contractAddress,
      });

      expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
        address: contractAddress,
        chainId,
      });

      expect(result).toEqual({
        severity: SEVERITY_MAPPING.NOT_VERIFIED,
        type: 'NOT_VERIFIED',
        title: TITLE_MAPPING.NOT_VERIFIED,
        description: DESCRIPTION_MAPPING.NOT_VERIFIED(),
      });
    });

    it('should return NOT_VERIFIED_BY_SAFE when no contracts found', async () => {
      const chainId = faker.string.numeric();
      const contractAddress = getAddress(faker.finance.ethereumAddress());

      const mockContractPage = pageBuilder()
        .with('count', 0)
        .with('results', [])
        .build();

      mockDataDecoderApi.getContracts.mockResolvedValue(
        rawify(mockContractPage),
      );

      const result = await service.verifyContract({
        chainId,
        contract: contractAddress,
      });

      expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
        address: contractAddress,
        chainId,
      });

      expect(result).toEqual({
        severity: SEVERITY_MAPPING.NOT_VERIFIED_BY_SAFE,
        type: 'NOT_VERIFIED_BY_SAFE',
        title: TITLE_MAPPING.NOT_VERIFIED_BY_SAFE,
        description: DESCRIPTION_MAPPING.NOT_VERIFIED_BY_SAFE(),
      });
    });

    it('should return VERIFICATION_UNAVAILABLE when data decoder API fails', async () => {
      const chainId = faker.string.numeric();
      const contractAddress = getAddress(faker.finance.ethereumAddress());
      const errorMessage = 'Data decoder API error';

      mockDataDecoderApi.getContracts.mockRejectedValue(
        new Error(errorMessage),
      );

      const result = await service.verifyContract({
        chainId,
        contract: contractAddress,
      });

      expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
        address: contractAddress,
        chainId,
      });

      expect(result).toEqual({
        severity: SEVERITY_MAPPING.VERIFICATION_UNAVAILABLE,
        type: 'VERIFICATION_UNAVAILABLE',
        title: TITLE_MAPPING.VERIFICATION_UNAVAILABLE,
        description: DESCRIPTION_MAPPING.VERIFICATION_UNAVAILABLE(),
      });
    });

    it('should handle multiple contracts and use first result', async () => {
      const chainId = faker.string.numeric();
      const contractAddress = getAddress(faker.finance.ethereumAddress());
      const name = faker.company.name();

      const mockContractPage = pageBuilder()
        .with('count', 2)
        .with('results', [
          contractBuilder()
            .with('address', contractAddress)
            .with('abi', {
              abiJson: [{ type: 'function', name: 'test' }],
              abiHash: faker.string.hexadecimal() as Hex,
              modified: faker.date.recent(),
            })
            .with('displayName', name)
            .build(),
          contractBuilder()
            .with('address', contractAddress)
            .with('abi', null)
            .build(),
        ])
        .build();

      mockDataDecoderApi.getContracts.mockResolvedValue(
        rawify(mockContractPage),
      );

      const result = await service.verifyContract({
        chainId,
        contract: contractAddress,
      });

      // Should use first result
      expect(result).toEqual({
        severity: SEVERITY_MAPPING.VERIFIED,
        type: 'VERIFIED',
        title: TITLE_MAPPING.VERIFIED,
        description: DESCRIPTION_MAPPING.VERIFIED({ name }),
      });
    });
  });

  describe('analyzeInteractions', () => {
    it('should return NEW_CONTRACT when no interactions exist', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const contractAddress = getAddress(faker.finance.ethereumAddress());

      const mockTransactionPage = pageBuilder().with('count', 0).build();

      mockTransactionApi.getMultisigTransactions.mockResolvedValue(
        rawify(mockTransactionPage),
      );

      const result = await service.analyzeInteractions({
        chainId,
        safeAddress,
        contract: contractAddress,
      });

      expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(chainId);
      expect(mockTransactionApi.getMultisigTransactions).toHaveBeenCalledWith({
        safeAddress,
        to: contractAddress,
        limit: 1,
      });

      expect(result).toEqual({
        severity: SEVERITY_MAPPING.NEW_CONTRACT,
        type: 'NEW_CONTRACT',
        title: TITLE_MAPPING.NEW_CONTRACT,
        description: DESCRIPTION_MAPPING.NEW_CONTRACT(),
      });
    });

    it('should return NEW_CONTRACT when count is null', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const contractAddress = getAddress(faker.finance.ethereumAddress());

      const mockTransactionPage = pageBuilder().with('count', null).build();

      mockTransactionApi.getMultisigTransactions.mockResolvedValue(
        rawify(mockTransactionPage),
      );

      const result = await service.analyzeInteractions({
        chainId,
        safeAddress,
        contract: contractAddress,
      });

      expect(result).toEqual({
        severity: SEVERITY_MAPPING.NEW_CONTRACT,
        type: 'NEW_CONTRACT',
        title: TITLE_MAPPING.NEW_CONTRACT,
        description: DESCRIPTION_MAPPING.NEW_CONTRACT(),
      });
    });

    it('should return KNOWN_CONTRACT and handle single interaction correctly', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const contractAddress = getAddress(faker.finance.ethereumAddress());

      const mockTransactionPage = pageBuilder().with('count', 1).build();

      mockTransactionApi.getMultisigTransactions.mockResolvedValue(
        rawify(mockTransactionPage),
      );

      const result = await service.analyzeInteractions({
        chainId,
        safeAddress,
        contract: contractAddress,
      });

      expect(result).toEqual({
        severity: SEVERITY_MAPPING.KNOWN_CONTRACT,
        type: 'KNOWN_CONTRACT',
        title: TITLE_MAPPING.KNOWN_CONTRACT,
        description: 'You have interacted with this contract 1 time.',
      });
    });

    it('should return KNOWN_CONTRACT and handle multiple interactions correctly', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const contractAddress = getAddress(faker.finance.ethereumAddress());
      const interactionCount = faker.number.int({ min: 2, max: 50 });

      const mockTransactionPage = pageBuilder()
        .with('count', interactionCount)
        .build();

      mockTransactionApi.getMultisigTransactions.mockResolvedValue(
        rawify(mockTransactionPage),
      );

      const result = await service.analyzeInteractions({
        chainId,
        safeAddress,
        contract: contractAddress,
      });

      expect(result).toEqual({
        severity: SEVERITY_MAPPING.KNOWN_CONTRACT,
        type: 'KNOWN_CONTRACT',
        title: TITLE_MAPPING.KNOWN_CONTRACT,
        description: `You have interacted with this contract ${interactionCount} times.`,
      });
    });

    it('should throw error when transaction API manager fails', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const contractAddress = getAddress(faker.finance.ethereumAddress());
      const errorMessage = 'Transaction API manager error';

      mockTransactionApiManager.getApi.mockRejectedValue(
        new Error(errorMessage),
      );

      await expect(
        service.analyzeInteractions({
          chainId,
          safeAddress,
          contract: contractAddress,
        }),
      ).rejects.toThrow(errorMessage);

      expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(chainId);
      expect(mockTransactionApi.getMultisigTransactions).not.toHaveBeenCalled();
    });

    it('should throw error when transaction API fails', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const contractAddress = getAddress(faker.finance.ethereumAddress());
      const errorMessage = 'Transaction API error';

      mockTransactionApi.getMultisigTransactions.mockRejectedValue(
        new Error(errorMessage),
      );

      await expect(
        service.analyzeInteractions({
          chainId,
          safeAddress,
          contract: contractAddress,
        }),
      ).rejects.toThrow(errorMessage);

      expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(chainId);
      expect(mockTransactionApi.getMultisigTransactions).toHaveBeenCalledWith({
        safeAddress,
        to: contractAddress,
        limit: 1,
      });
    });
  });
});
