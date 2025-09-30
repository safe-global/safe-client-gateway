import { ContractAnalysisService } from '@/modules/safe-shield/contract-analysis/contract-analysis.service';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IDataDecoderApi } from '@/domain/interfaces/data-decoder-api.interface';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import { faker } from '@faker-js/faker';
import { LogType } from '@/domain/common/entities/log-type.entity';
import type { Address, Hex } from 'viem';
import { getAddress } from 'viem';
import type { ContractAnalysisResponse } from '@/modules/safe-shield/entities/analysis-responses.entity';
import type { ContractAnalysisResult } from '@/modules/safe-shield/entities/analysis-result.entity';
import type { ContractStatusGroup } from '@/modules/safe-shield/entities/status-group.entity';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import {
  SEVERITY_MAPPING,
  TITLE_MAPPING,
  DESCRIPTION_MAPPING,
} from './contract-analysis.constants';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { contractBuilder } from '@/domain/data-decoder/v2/entities/__tests__/contract.builder';
import { extractContracts } from '@/modules/safe-shield/utils/extraction.utils';

jest.mock('@/modules/safe-shield/utils/extraction.utils', () => ({
  extractContracts: jest.fn(),
}));
const mockExtractContracts = jest.mocked(extractContracts);

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
    mockConfigurationService.getOrThrow.mockReturnValue(3600);

    fakeCacheService = new FakeCacheService();
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
    jest.resetAllMocks();
    fakeCacheService.clear();
  });

  describe('analyze', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const transactions: Array<DecodedTransactionData> = [];

    it('should return cached analysis when available', async () => {
      const contractAddress = getAddress(faker.finance.ethereumAddress());
      const contractPairs: Array<[Address, boolean]> = [
        [contractAddress, false],
      ];
      // set up cache with expected response
      const cachedResponse: ContractAnalysisResponse = {
        [contractAddress]: {
          CONTRACT_VERIFICATION: [],
          CONTRACT_INTERACTION: [],
          DELEGATECALL: [],
        },
      };
      const cacheDir = CacheRouter.getContractAnalysisCacheDir({
        chainId,
        contractPairs,
      });

      await fakeCacheService.hSet(
        cacheDir,
        JSON.stringify(cachedResponse),
        3600,
      );

      mockExtractContracts.mockReturnValue(contractPairs);
      const analyzeContractSpy = jest.spyOn(service, 'analyzeContract');

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(mockExtractContracts).toHaveBeenCalledWith(
        transactions,
        mockErc20Decoder,
      );
      expect(analyzeContractSpy).not.toHaveBeenCalled();
      expect(result).toEqual(cachedResponse);
      expect(mockLoggingService.debug).toHaveBeenCalledWith({
        type: LogType.CacheHit,
        key: cacheDir.key,
        field: cacheDir.field,
      });
    });

    it('should analyze contracts and cache result when cache miss', async () => {
      const contractPairs: Array<[Address, boolean]> = [
        [getAddress(faker.finance.ethereumAddress()), true],
        [getAddress(faker.finance.ethereumAddress()), false],
      ];

      const cacheDir = CacheRouter.getContractAnalysisCacheDir({
        chainId,
        contractPairs,
      });

      mockExtractContracts.mockReturnValue(contractPairs);

      const result1 = {
        CONTRACT_VERIFICATION: [
          {
            severity: SEVERITY_MAPPING.VERIFIED,
            type: 'VERIFIED',
            title: TITLE_MAPPING.VERIFIED,
            description: DESCRIPTION_MAPPING.VERIFIED({
              name: faker.company.name(),
            }),
          },
        ],
        CONTRACT_INTERACTION: [
          {
            severity: SEVERITY_MAPPING.NEW_CONTRACT,
            type: 'NEW_CONTRACT',
            title: TITLE_MAPPING.NEW_CONTRACT,
            description: DESCRIPTION_MAPPING.NEW_CONTRACT(),
          },
        ],
        DELEGATECALL: [],
      } as Record<ContractStatusGroup, Array<ContractAnalysisResult>>;

      const result2 = {
        CONTRACT_VERIFICATION: [
          {
            severity: SEVERITY_MAPPING.NOT_VERIFIED,
            type: 'NOT_VERIFIED',
            title: TITLE_MAPPING.NOT_VERIFIED,
            description: DESCRIPTION_MAPPING.NOT_VERIFIED(),
          },
        ],
        CONTRACT_INTERACTION: [
          {
            severity: SEVERITY_MAPPING.KNOWN_CONTRACT,
            type: 'KNOWN_CONTRACT',
            title: TITLE_MAPPING.KNOWN_CONTRACT,
            description: DESCRIPTION_MAPPING.KNOWN_CONTRACT({
              interactions: 2,
            }),
          },
        ],
        DELEGATECALL: [
          {
            severity: SEVERITY_MAPPING.UNEXPECTED_DELEGATECALL,
            type: 'UNEXPECTED_DELEGATECALL',
            title: TITLE_MAPPING.UNEXPECTED_DELEGATECALL,
            description: DESCRIPTION_MAPPING.UNEXPECTED_DELEGATECALL(),
          },
        ],
      } as Record<ContractStatusGroup, Array<ContractAnalysisResult>>;

      const expectedResponse: ContractAnalysisResponse = {
        [contractPairs[0][0]]: result1,
        [contractPairs[1][0]]: result2,
      };

      const analyzeContractSpy = jest
        .spyOn(service, 'analyzeContract')
        .mockResolvedValueOnce(result1)
        .mockResolvedValueOnce(result2);
      const cacheSetSpy = jest.spyOn(fakeCacheService, 'hSet');

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(mockExtractContracts).toHaveBeenCalledWith(
        transactions,
        mockErc20Decoder,
      );
      expect(analyzeContractSpy).toHaveBeenNthCalledWith(1, {
        chainId,
        safeAddress,
        contract: contractPairs[0][0],
        isDelegateCall: contractPairs[0][1],
      });
      expect(analyzeContractSpy).toHaveBeenNthCalledWith(2, {
        chainId,
        safeAddress,
        contract: contractPairs[1][0],
        isDelegateCall: contractPairs[1][1],
      });

      expect(result).toEqual(expectedResponse);
      expect(cacheSetSpy).toHaveBeenCalledTimes(1);
      expect(cacheSetSpy).toHaveBeenCalledWith(
        cacheDir,
        JSON.stringify(expectedResponse),
        3600,
      );

      await expect(fakeCacheService.hGet(cacheDir)).resolves.toEqual(
        JSON.stringify(expectedResponse),
      );
      expect(mockLoggingService.debug).toHaveBeenCalledWith({
        type: LogType.CacheMiss,
        key: cacheDir.key,
        field: cacheDir.field,
      });
    });
  });

  describe('analyzeContract', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const contractAddress = getAddress(faker.finance.ethereumAddress());
    const interactionCount = faker.number.int({ min: 1, max: 10 });
    const name = faker.company.name();

    it('should return combined analysis results from verification, non-delegateCall and interaction checks', async () => {
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
        isDelegateCall: false,
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

    it('should return combined analysis results from verification, delegateCall and interaction checks', async () => {
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
            .with('trustedForDelegateCall', false)
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
        isDelegateCall: true,
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
        DELEGATECALL: [
          {
            severity: SEVERITY_MAPPING.UNEXPECTED_DELEGATECALL,
            type: 'UNEXPECTED_DELEGATECALL',
            title: TITLE_MAPPING.UNEXPECTED_DELEGATECALL,
            description: DESCRIPTION_MAPPING.UNEXPECTED_DELEGATECALL({
              interactions: interactionCount,
            }),
          },
        ],
      });
    });

    it('should handle errors from parallel operations correctly', async () => {
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
            .with('name', '')
            .with('displayName', '')
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
          isDelegateCall: false,
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
    const chainId = faker.string.numeric();
    const contractAddress = getAddress(faker.finance.ethereumAddress());
    const name = faker.company.name();

    describe('not delegate call', () => {
      it('should return VERIFIED when contract has ABI and displayName', async () => {
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

        const [verification, delegateCall] = await service.verifyContract({
          chainId,
          contract: contractAddress,
          isDelegateCall: false,
        });

        expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
          address: contractAddress,
          chainId,
        });
        expect(verification).toEqual({
          severity: SEVERITY_MAPPING.VERIFIED,
          type: 'VERIFIED',
          title: TITLE_MAPPING.VERIFIED,
          description: DESCRIPTION_MAPPING.VERIFIED({ name: name }),
        });
        expect(delegateCall).toBeUndefined();
      });

      it('should return VERIFIED with name when displayName is not present', async () => {
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

        const [verification, delegateCall] = await service.verifyContract({
          chainId,
          contract: contractAddress,
          isDelegateCall: false,
        });

        expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
          address: contractAddress,
          chainId,
        });

        expect(verification).toEqual({
          severity: SEVERITY_MAPPING.VERIFIED,
          type: 'VERIFIED',
          title: TITLE_MAPPING.VERIFIED,
          description: DESCRIPTION_MAPPING.VERIFIED({ name: name }),
        });
        expect(delegateCall).toBeUndefined();
      });

      it('should return VERIFIED without name when name/displayName are not present', async () => {
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

        const [verification, delegateCall] = await service.verifyContract({
          chainId,
          contract: contractAddress,
          isDelegateCall: false,
        });

        expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
          address: contractAddress,
          chainId,
        });

        expect(verification).toEqual({
          severity: SEVERITY_MAPPING.VERIFIED,
          type: 'VERIFIED',
          title: TITLE_MAPPING.VERIFIED,
          description: 'This contract is verified.',
        });
        expect(delegateCall).toBeUndefined();
      });

      it('should return NOT_VERIFIED when contract exists but has no ABI', async () => {
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

        const [verification, delegateCall] = await service.verifyContract({
          chainId,
          contract: contractAddress,
          isDelegateCall: false,
        });

        expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
          address: contractAddress,
          chainId,
        });

        expect(verification).toEqual({
          severity: SEVERITY_MAPPING.NOT_VERIFIED,
          type: 'NOT_VERIFIED',
          title: TITLE_MAPPING.NOT_VERIFIED,
          description: DESCRIPTION_MAPPING.NOT_VERIFIED(),
        });
        expect(delegateCall).toBeUndefined();
      });

      it('should return NOT_VERIFIED_BY_SAFE when no contracts found', async () => {
        const mockContractPage = pageBuilder()
          .with('count', 0)
          .with('results', [])
          .build();

        mockDataDecoderApi.getContracts.mockResolvedValue(
          rawify(mockContractPage),
        );

        const [verification, delegateCall] = await service.verifyContract({
          chainId,
          contract: contractAddress,
          isDelegateCall: false,
        });

        expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
          address: contractAddress,
          chainId,
        });

        expect(verification).toEqual({
          severity: SEVERITY_MAPPING.NOT_VERIFIED_BY_SAFE,
          type: 'NOT_VERIFIED_BY_SAFE',
          title: TITLE_MAPPING.NOT_VERIFIED_BY_SAFE,
          description: DESCRIPTION_MAPPING.NOT_VERIFIED_BY_SAFE(),
        });
        expect(delegateCall).toBeUndefined();
      });

      it('should return VERIFICATION_UNAVAILABLE when data decoder API fails', async () => {
        const errorMessage = 'Data decoder API error';

        mockDataDecoderApi.getContracts.mockRejectedValue(
          new Error(errorMessage),
        );

        const [verification, delegateCall] = await service.verifyContract({
          chainId,
          contract: contractAddress,
          isDelegateCall: false,
        });

        expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
          address: contractAddress,
          chainId,
        });

        expect(verification).toEqual({
          severity: SEVERITY_MAPPING.VERIFICATION_UNAVAILABLE,
          type: 'VERIFICATION_UNAVAILABLE',
          title: TITLE_MAPPING.VERIFICATION_UNAVAILABLE,
          description: DESCRIPTION_MAPPING.VERIFICATION_UNAVAILABLE(),
        });
        expect(delegateCall).toBeUndefined();
      });

      it('should handle multiple contracts and use first result', async () => {
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

        const [verification, delegateCall] = await service.verifyContract({
          chainId,
          contract: contractAddress,
          isDelegateCall: false,
        });

        // Should use first result
        expect(verification).toEqual({
          severity: SEVERITY_MAPPING.VERIFIED,
          type: 'VERIFIED',
          title: TITLE_MAPPING.VERIFIED,
          description: DESCRIPTION_MAPPING.VERIFIED({ name }),
        });
        expect(delegateCall).toBeUndefined();
      });
    });

    describe('delegate call', () => {
      it('should return UNEXPECTED_DELEGATECALL when contract is not trusted', async () => {
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
              .with('trustedForDelegateCall', false)
              .with('displayName', name)
              .build(),
          ])
          .build();

        mockDataDecoderApi.getContracts.mockResolvedValue(
          rawify(mockContractPage),
        );

        const [verification, delegateCall] = await service.verifyContract({
          chainId,
          contract: contractAddress,
          isDelegateCall: true,
        });

        expect(verification).toEqual({
          severity: SEVERITY_MAPPING.VERIFIED,
          type: 'VERIFIED',
          title: TITLE_MAPPING.VERIFIED,
          description: DESCRIPTION_MAPPING.VERIFIED({ name }),
        });

        expect(delegateCall).toEqual({
          severity: SEVERITY_MAPPING.UNEXPECTED_DELEGATECALL,
          type: 'UNEXPECTED_DELEGATECALL',
          title: TITLE_MAPPING.UNEXPECTED_DELEGATECALL,
          description: DESCRIPTION_MAPPING.UNEXPECTED_DELEGATECALL(),
        });
      });

      it('should return UNEXPECTED_DELEGATECALL when contract is not present', async () => {
        const errorMessage = 'Data decoder API error';

        mockDataDecoderApi.getContracts.mockRejectedValue(
          new Error(errorMessage),
        );

        const [verification, delegateCall] = await service.verifyContract({
          chainId,
          contract: contractAddress,
          isDelegateCall: true,
        });

        expect(verification).toEqual({
          severity: SEVERITY_MAPPING.VERIFICATION_UNAVAILABLE,
          type: 'VERIFICATION_UNAVAILABLE',
          title: TITLE_MAPPING.VERIFICATION_UNAVAILABLE,
          description: DESCRIPTION_MAPPING.VERIFICATION_UNAVAILABLE(),
        });

        expect(delegateCall).toEqual({
          severity: SEVERITY_MAPPING.UNEXPECTED_DELEGATECALL,
          type: 'UNEXPECTED_DELEGATECALL',
          title: TITLE_MAPPING.UNEXPECTED_DELEGATECALL,
          description: DESCRIPTION_MAPPING.UNEXPECTED_DELEGATECALL(),
        });
      });

      it('should return undefined when contract is trusted', async () => {
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
              .with('trustedForDelegateCall', true)
              .build(),
          ])
          .build();

        mockDataDecoderApi.getContracts.mockResolvedValue(
          rawify(mockContractPage),
        );

        const [, delegateCall] = await service.verifyContract({
          chainId,
          contract: contractAddress,
          isDelegateCall: true,
        });

        expect(delegateCall).toBeUndefined();
      });
    });
  });

  describe('analyzeInteractions', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const contractAddress = getAddress(faker.finance.ethereumAddress());

    it('should return NEW_CONTRACT when no interactions exist', async () => {
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
