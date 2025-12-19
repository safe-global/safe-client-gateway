import { ContractAnalysisService } from '@/modules/safe-shield/contract-analysis/contract-analysis.service';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IDataDecoderApi } from '@/domain/interfaces/data-decoder-api.interface';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { Erc20Decoder } from '@/modules/relay/domain/contracts/decoders/erc-20-decoder.helper';
import { faker } from '@faker-js/faker';
import { LogType } from '@/domain/common/entities/log-type.entity';
import type { Hex } from 'viem';
import { getAddress } from 'viem';
import type { ContractAnalysisResponse } from '@/modules/safe-shield/entities/analysis-responses.entity';
import type { ContractAnalysisResult } from '@/modules/safe-shield/entities/analysis-result.entity';
import type { ContractStatusGroup } from '@/modules/safe-shield/entities/status-group.entity';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import {
  SEVERITY_MAPPING,
  TITLE_MAPPING,
  DESCRIPTION_MAPPING,
  TWAP_FALLBACK_HANDLER,
} from './contract-analysis.constants';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { contractBuilder } from '@/modules/data-decoder/domain/v2/entities/__tests__/contract.builder';
import type { ExtractedContract } from '@/modules/safe-shield/entities/extracted-contract.entity';
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
  warn: jest.fn(),
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

    it('should return empty object when extractContracts returns empty array', async () => {
      mockExtractContracts.mockReturnValue([]);

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result).toEqual({});
      expect(mockExtractContracts).toHaveBeenCalledWith(
        transactions,
        mockErc20Decoder,
      );

      // Verify that no caching occurs
      const cacheDir = CacheRouter.getContractAnalysisCacheDir({
        chainId,
        contracts: [],
      });
      const cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(cacheContent).toBeUndefined();

      const analyzeContractSpy = jest.spyOn(service, 'analyzeContract');
      expect(analyzeContractSpy).not.toHaveBeenCalled();
    });

    it('should return cached analysis when available', async () => {
      const contractAddress = getAddress(faker.finance.ethereumAddress());
      const contracts = [
        {
          address: contractAddress,
          isDelegateCall: false,
        },
      ];
      // set up cache with expected response
      const cachedResponse: ContractAnalysisResponse = {
        [contractAddress]: {
          logoUrl: faker.image.url(),
          name: faker.company.name(),
          CONTRACT_VERIFICATION: [],
          CONTRACT_INTERACTION: [],
          DELEGATECALL: [],
        },
      };
      const cacheDir = CacheRouter.getContractAnalysisCacheDir({
        chainId,
        contracts,
      });

      await fakeCacheService.hSet(
        cacheDir,
        JSON.stringify(cachedResponse),
        3600,
      );

      mockExtractContracts.mockReturnValue(contracts);
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

    it('should handle JSON parsing errors in cached data gracefully', async () => {
      const contractAddress = getAddress(faker.finance.ethereumAddress());
      const contracts: Array<ExtractedContract> = [
        { address: contractAddress, isDelegateCall: false },
      ];

      const cacheDir = CacheRouter.getContractAnalysisCacheDir({
        chainId,
        contracts,
      });

      const invalidCachedData = 'invalid json data';
      await fakeCacheService.hSet(cacheDir, invalidCachedData, 3600);

      mockExtractContracts.mockReturnValue(contracts);

      // Mock analyzeContract to return a result when cache parsing fails
      const mockAnalysisResult = {
        CONTRACT_VERIFICATION: [],
        CONTRACT_INTERACTION: [],
        DELEGATECALL: [],
        FALLBACK_HANDLER: [],
      } as Record<ContractStatusGroup, Array<ContractAnalysisResult>>;

      jest
        .spyOn(service, 'analyzeContract')
        .mockResolvedValue(mockAnalysisResult);

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions: [],
      });

      // Should handle JSON parsing error gracefully and return fresh analysis
      expect(result).toBeDefined();
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to parse cached contract analysis results',
        ),
      );

      expect(mockLoggingService.debug).toHaveBeenCalledWith({
        type: 'CACHE_MISS',
        key: expect.any(String),
        field: expect.any(String),
      });
    });

    it('should analyze contracts and cache result when cache miss', async () => {
      const contracts: Array<ExtractedContract> = [
        {
          address: getAddress(faker.finance.ethereumAddress()),
          isDelegateCall: false,
        },
        {
          address: getAddress(faker.finance.ethereumAddress()),
          isDelegateCall: true,
        },
      ];

      const cacheDir = CacheRouter.getContractAnalysisCacheDir({
        chainId,
        contracts,
      });

      mockExtractContracts.mockReturnValue(contracts);

      const result1 = {
        CONTRACT_VERIFICATION: [
          {
            severity: SEVERITY_MAPPING.VERIFIED,
            type: 'VERIFIED' as const,
            title: TITLE_MAPPING.VERIFIED,
            description: DESCRIPTION_MAPPING.VERIFIED({
              name: faker.company.name(),
            }),
          },
        ],
        CONTRACT_INTERACTION: [],
        DELEGATECALL: [],
        FALLBACK_HANDLER: [
          {
            severity: SEVERITY_MAPPING.UNOFFICIAL_FALLBACK_HANDLER,
            type: 'UNOFFICIAL_FALLBACK_HANDLER' as const,
            title: TITLE_MAPPING.UNOFFICIAL_FALLBACK_HANDLER,
            description: DESCRIPTION_MAPPING.UNOFFICIAL_FALLBACK_HANDLER(),
            fallbackHandler: {
              address: getAddress(faker.finance.ethereumAddress()),
              name: faker.company.name(),
              logoUrl: faker.internet.url(),
            },
          },
        ],
      };

      const result2 = {
        CONTRACT_VERIFICATION: [
          {
            severity: SEVERITY_MAPPING.NOT_VERIFIED,
            type: 'NOT_VERIFIED' as const,
            title: TITLE_MAPPING.NOT_VERIFIED,
            description: DESCRIPTION_MAPPING.NOT_VERIFIED(),
          },
        ],
        CONTRACT_INTERACTION: [
          {
            severity: SEVERITY_MAPPING.KNOWN_CONTRACT,
            type: 'KNOWN_CONTRACT' as const,
            title: TITLE_MAPPING.KNOWN_CONTRACT,
            description: DESCRIPTION_MAPPING.KNOWN_CONTRACT(),
          },
        ],
        DELEGATECALL: [
          {
            severity: SEVERITY_MAPPING.UNEXPECTED_DELEGATECALL,
            type: 'UNEXPECTED_DELEGATECALL' as const,
            title: TITLE_MAPPING.UNEXPECTED_DELEGATECALL,
            description: DESCRIPTION_MAPPING.UNEXPECTED_DELEGATECALL(),
          },
        ],
      };

      const expectedResponse: ContractAnalysisResponse = {
        [contracts[0].address]: result1,
        [contracts[1].address]: result2,
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
        contract: contracts[0],
      });
      expect(analyzeContractSpy).toHaveBeenNthCalledWith(2, {
        chainId,
        safeAddress,
        contract: contracts[1],
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

    it('should throw error if any of the downstream contract analysis fails', async () => {
      const contracts: Array<ExtractedContract> = [
        {
          address: getAddress(faker.finance.ethereumAddress()),
          isDelegateCall: false,
        },

        {
          address: getAddress(faker.finance.ethereumAddress()),
          isDelegateCall: true,
        },
      ];
      mockExtractContracts.mockReturnValue(contracts);

      const analyzeContractSpy = jest
        .spyOn(service, 'analyzeContract')
        .mockResolvedValue({
          CONTRACT_VERIFICATION: [],
          CONTRACT_INTERACTION: [],
          DELEGATECALL: [],
          FALLBACK_HANDLER: [],
        })
        .mockRejectedValueOnce(new Error('Transaction API error'));

      await expect(
        service.analyze({
          chainId,
          safeAddress,
          transactions,
        }),
      ).rejects.toThrow('Transaction API error');

      expect(mockExtractContracts).toHaveBeenCalledWith(
        transactions,
        mockErc20Decoder,
      );
      expect(analyzeContractSpy).toHaveBeenNthCalledWith(1, {
        chainId,
        safeAddress,
        contract: contracts[0],
      });
      expect(analyzeContractSpy).toHaveBeenNthCalledWith(2, {
        chainId,
        safeAddress,
        contract: contracts[1],
      });
    });
  });

  describe('analyzeContract', () => {
    let chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const contractAddress = getAddress(faker.finance.ethereumAddress());
    const fallbackHandlerAddress = getAddress(faker.finance.ethereumAddress());
    const interactionCount = faker.number.int({ min: 1, max: 10 });
    const name = faker.company.name();

    it('should return combined analysis results from verification, non-delegateCall, fallback handler and interaction checks', async () => {
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
            .with('logoUrl', undefined)
            .build(),
        ])
        .build();

      const mockFallbackContractPage = pageBuilder()
        .with('count', 1)
        .with('results', [
          contractBuilder()
            .with('address', fallbackHandlerAddress)
            .with('displayName', name)
            .with('logoUrl', undefined)
            .build(),
        ])
        .build();

      mockDataDecoderApi.getContracts
        .mockResolvedValueOnce(rawify(mockContractPage))
        .mockResolvedValueOnce(rawify(mockFallbackContractPage));

      const mockTransactionPage = pageBuilder()
        .with('count', interactionCount)
        .build();

      mockTransactionApi.getMultisigTransactions.mockResolvedValue(
        rawify(mockTransactionPage),
      );

      const result = await service.analyzeContract({
        chainId,
        safeAddress,
        contract: {
          address: contractAddress,
          isDelegateCall: false,
          fallbackHandler: fallbackHandlerAddress,
        },
      });

      expect(mockDataDecoderApi.getContracts).toHaveBeenNthCalledWith(1, {
        address: contractAddress,
        chainId,
      });
      expect(mockDataDecoderApi.getContracts).toHaveBeenNthCalledWith(2, {
        address: fallbackHandlerAddress,
        chainId,
      });

      expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(chainId);
      expect(mockTransactionApi.getMultisigTransactions).toHaveBeenCalledWith({
        safeAddress,
        to: contractAddress,
        executed: true,
        limit: 1,
      });

      expect(result).toEqual({
        logoUrl: undefined,
        name,
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
            description: DESCRIPTION_MAPPING.KNOWN_CONTRACT(),
          },
        ],
        FALLBACK_HANDLER: [
          {
            severity: SEVERITY_MAPPING.UNOFFICIAL_FALLBACK_HANDLER,
            type: 'UNOFFICIAL_FALLBACK_HANDLER',
            title: TITLE_MAPPING.UNOFFICIAL_FALLBACK_HANDLER,
            description: DESCRIPTION_MAPPING.UNOFFICIAL_FALLBACK_HANDLER(),
            fallbackHandler: {
              address: fallbackHandlerAddress,
              name,
            },
          },
        ],
      });
    });

    it('should return combined analysis results from verification, delegateCall and interaction checks', async () => {
      const logoUrl = faker.image.url();
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
            .with('logoUrl', logoUrl)
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
        contract: { address: contractAddress, isDelegateCall: true },
      });

      expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
        address: contractAddress,
        chainId,
      });

      expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(chainId);
      expect(mockTransactionApi.getMultisigTransactions).toHaveBeenCalledWith({
        safeAddress,
        to: contractAddress,
        executed: true,
        limit: 1,
      });

      expect(result).toEqual({
        logoUrl,
        name,
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
            description: DESCRIPTION_MAPPING.KNOWN_CONTRACT(),
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
            .with('logoUrl', undefined)
            .build(),
        ])
        .build();

      mockDataDecoderApi.getContracts.mockResolvedValue(
        rawify(mockContractPage),
      );
      mockTransactionApi.getMultisigTransactions.mockRejectedValue(
        new Error(errorMessage),
      );

      const result = await service.analyzeContract({
        chainId,
        safeAddress,
        contract: { address: contractAddress, isDelegateCall: false },
      });

      expect(result).toEqual({
        name: undefined,
        logoUrl: undefined,
        CONTRACT_VERIFICATION: [
          {
            severity: SEVERITY_MAPPING.VERIFIED,
            type: 'VERIFIED',
            title: TITLE_MAPPING.VERIFIED,
            description: DESCRIPTION_MAPPING.VERIFIED(),
          },
        ],
        CONTRACT_INTERACTION: [
          {
            severity: SEVERITY_MAPPING.FAILED,
            type: 'FAILED',
            title: TITLE_MAPPING.FAILED,
            description:
              'The analysis failed: contract interactions unavailable. Please try again later.',
          },
        ],
      });

      expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
        address: contractAddress,
        chainId,
      });
      expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(chainId);
    });

    it('should return only CONTRACT_VERIFICATION group when delegateCallResult, fallbackHandlerResult and interactionResult are undefined', async () => {
      chainId = '1';
      const logoUrl = faker.image.url();
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
            .with('logoUrl', logoUrl)
            .with('trustedForDelegateCall', true)
            .build(),
        ])
        .build();

      mockDataDecoderApi.getContracts.mockResolvedValue(
        rawify(mockContractPage),
      );
      const mockTransactionPage = pageBuilder().with('count', 0).build();
      mockTransactionApi.getMultisigTransactions.mockResolvedValue(
        rawify(mockTransactionPage),
      );

      const result = await service.analyzeContract({
        chainId,
        safeAddress,
        contract: {
          address: contractAddress,
          isDelegateCall: true,
          fallbackHandler: TWAP_FALLBACK_HANDLER,
        },
      });

      expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
        address: contractAddress,
        chainId,
      });

      expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(chainId);
      expect(mockTransactionApi.getMultisigTransactions).toHaveBeenCalledWith({
        safeAddress,
        to: contractAddress,
        executed: true,
        limit: 1,
      });

      expect(result).toEqual({
        logoUrl,
        name,
        CONTRACT_VERIFICATION: [
          {
            severity: SEVERITY_MAPPING.VERIFIED,
            type: 'VERIFIED',
            title: TITLE_MAPPING.VERIFIED,
            description: DESCRIPTION_MAPPING.VERIFIED({ name }),
          },
        ],
      });
    });
  });

  describe('verifyContract', () => {
    const chainId = faker.string.numeric();
    const contractAddress = getAddress(faker.finance.ethereumAddress());
    const name = faker.company.name();
    const logoUrl = faker.image.url();

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
              .with('logoUrl', logoUrl)
              .build(),
          ])
          .build();

        mockDataDecoderApi.getContracts.mockResolvedValue(
          rawify(mockContractPage),
        );

        const result = await service.verifyContract({
          chainId,
          contract: { address: contractAddress, isDelegateCall: false },
        });

        expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
          address: contractAddress,
          chainId,
        });
        expect(result).toEqual({
          logoUrl,
          name,
          CONTRACT_VERIFICATION: [
            {
              severity: SEVERITY_MAPPING.VERIFIED,
              type: 'VERIFIED',
              title: TITLE_MAPPING.VERIFIED,
              description: DESCRIPTION_MAPPING.VERIFIED({ name: name }),
            },
          ],
        });
      });

      it('should return VERIFIED with name when displayName is not present', async () => {
        const logoUrl = faker.image.url();
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
              .with('logoUrl', logoUrl)
              .build(),
          ])
          .build();

        mockDataDecoderApi.getContracts.mockResolvedValue(
          rawify(mockContractPage),
        );

        const result = await service.verifyContract({
          chainId,
          contract: { address: contractAddress, isDelegateCall: false },
        });

        expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
          address: contractAddress,
          chainId,
        });

        expect(result).toEqual({
          logoUrl,
          name,
          CONTRACT_VERIFICATION: [
            {
              severity: SEVERITY_MAPPING.VERIFIED,
              type: 'VERIFIED',
              title: TITLE_MAPPING.VERIFIED,
              description: DESCRIPTION_MAPPING.VERIFIED({ name: name }),
            },
          ],
        });
      });

      it('should return VERIFIED without name/logoUrl when name/displayName/logoUrl are not present', async () => {
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
              .with('logoUrl', undefined)
              .build(),
          ])
          .build();

        mockDataDecoderApi.getContracts.mockResolvedValue(
          rawify(mockContractPage),
        );

        const result = await service.verifyContract({
          chainId,
          contract: { address: contractAddress, isDelegateCall: false },
        });

        expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
          address: contractAddress,
          chainId,
        });

        expect(result).toEqual({
          name: undefined,
          logoUrl: undefined,
          CONTRACT_VERIFICATION: [
            {
              severity: SEVERITY_MAPPING.VERIFIED,
              type: 'VERIFIED',
              title: TITLE_MAPPING.VERIFIED,
              description: 'This contract is verified.',
            },
          ],
        });
      });

      it('should return NOT_VERIFIED when contract exists but has no ABI', async () => {
        const mockContractPage = pageBuilder()
          .with('count', 1)
          .with('results', [
            contractBuilder()
              .with('address', contractAddress)
              .with('abi', null)
              .with('name', '')
              .with('displayName', '')
              .with('logoUrl', undefined)
              .build(),
          ])
          .build();

        mockDataDecoderApi.getContracts.mockResolvedValue(
          rawify(mockContractPage),
        );

        const result = await service.verifyContract({
          chainId,
          contract: { address: contractAddress, isDelegateCall: false },
        });

        expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
          address: contractAddress,
          chainId,
        });

        expect(result).toEqual({
          name: undefined,
          logoUrl: undefined,
          CONTRACT_VERIFICATION: [
            {
              severity: SEVERITY_MAPPING.NOT_VERIFIED,
              type: 'NOT_VERIFIED',
              title: TITLE_MAPPING.NOT_VERIFIED,
              description: DESCRIPTION_MAPPING.NOT_VERIFIED(),
            },
          ],
        });
      });

      it('should return empty response when no contracts found', async () => {
        const mockContractPage = pageBuilder()
          .with('count', 0)
          .with('results', [])
          .build();

        mockDataDecoderApi.getContracts.mockResolvedValue(
          rawify(mockContractPage),
        );

        const result = await service.verifyContract({
          chainId,
          contract: { address: contractAddress, isDelegateCall: false },
        });

        expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
          address: contractAddress,
          chainId,
        });

        expect(result).toEqual({});
      });

      it('should return VERIFICATION_UNAVAILABLE when data decoder API fails', async () => {
        const errorMessage = 'Data decoder API error';

        mockDataDecoderApi.getContracts.mockRejectedValue(
          new Error(errorMessage),
        );

        const result = await service.verifyContract({
          chainId,
          contract: { address: contractAddress, isDelegateCall: false },
        });

        expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
          address: contractAddress,
          chainId,
        });

        expect(result).toEqual({
          CONTRACT_VERIFICATION: [
            {
              severity: SEVERITY_MAPPING.VERIFICATION_UNAVAILABLE,
              type: 'VERIFICATION_UNAVAILABLE',
              title: TITLE_MAPPING.VERIFICATION_UNAVAILABLE,
              description: DESCRIPTION_MAPPING.VERIFICATION_UNAVAILABLE(),
            },
          ],
        });
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
              .with('logoUrl', logoUrl)
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
          contract: { address: contractAddress, isDelegateCall: false },
        });

        // Should use first result
        expect(result).toEqual({
          logoUrl,
          name,
          CONTRACT_VERIFICATION: [
            {
              severity: SEVERITY_MAPPING.VERIFIED,
              type: 'VERIFIED',
              title: TITLE_MAPPING.VERIFIED,
              description: DESCRIPTION_MAPPING.VERIFIED({ name }),
            },
          ],
        });
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
              .with('logoUrl', logoUrl)
              .build(),
          ])
          .build();

        mockDataDecoderApi.getContracts.mockResolvedValue(
          rawify(mockContractPage),
        );

        const result = await service.verifyContract({
          chainId,
          contract: { address: contractAddress, isDelegateCall: true },
        });

        expect(result).toEqual({
          logoUrl,
          name,
          CONTRACT_VERIFICATION: [
            {
              severity: SEVERITY_MAPPING.VERIFIED,
              type: 'VERIFIED',
              title: TITLE_MAPPING.VERIFIED,
              description: DESCRIPTION_MAPPING.VERIFIED({ name }),
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
        });
      });

      it('should return UNEXPECTED_DELEGATECALL when contract fetch failed', async () => {
        const errorMessage = 'Data decoder API error';

        mockDataDecoderApi.getContracts.mockRejectedValue(
          new Error(errorMessage),
        );

        const result = await service.verifyContract({
          chainId,
          contract: { address: contractAddress, isDelegateCall: true },
        });

        expect(result).toEqual({
          CONTRACT_VERIFICATION: [
            {
              severity: SEVERITY_MAPPING.VERIFICATION_UNAVAILABLE,
              type: 'VERIFICATION_UNAVAILABLE',
              title: TITLE_MAPPING.VERIFICATION_UNAVAILABLE,
              description: DESCRIPTION_MAPPING.VERIFICATION_UNAVAILABLE(),
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
        });
      });

      it('should return UNEXPECTED_DELEGATECALL when contract is undefined', async () => {
        const mockContractPage = pageBuilder()
          .with('count', 0)
          .with('results', [])
          .build();
        mockDataDecoderApi.getContracts.mockResolvedValue(
          rawify(mockContractPage),
        );

        const result = await service.verifyContract({
          chainId,
          contract: { address: contractAddress, isDelegateCall: true },
        });

        expect(result).toEqual({
          DELEGATECALL: [
            {
              severity: SEVERITY_MAPPING.UNEXPECTED_DELEGATECALL,
              type: 'UNEXPECTED_DELEGATECALL',
              title: TITLE_MAPPING.UNEXPECTED_DELEGATECALL,
              description: DESCRIPTION_MAPPING.UNEXPECTED_DELEGATECALL(),
            },
          ],
        });
      });

      it('should omit DELEGATECALL group when contract is trusted', async () => {
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
              .with('displayName', name)
              .with('logoUrl', logoUrl)
              .build(),
          ])
          .build();

        mockDataDecoderApi.getContracts.mockResolvedValue(
          rawify(mockContractPage),
        );

        const result = await service.verifyContract({
          chainId,
          contract: { address: contractAddress, isDelegateCall: true },
        });

        expect(result).toEqual({
          logoUrl,
          name,
          CONTRACT_VERIFICATION: [
            {
              severity: SEVERITY_MAPPING.VERIFIED,
              type: 'VERIFIED',
              title: TITLE_MAPPING.VERIFIED,
              description: DESCRIPTION_MAPPING.VERIFIED({ name }),
            },
          ],
        });
      });
    });

    describe('fallback handler', () => {
      it('should return UNOFFICIAL_FALLBACK_HANDLER when handler is not official Safe or TWAP', async () => {
        const unofficialHandler = getAddress(faker.finance.ethereumAddress());
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
              .with('logoUrl', logoUrl)
              .build(),
          ])
          .build();

        const mockFallbackHandlerContractPage = pageBuilder()
          .with('count', 1)
          .with('results', [
            contractBuilder()
              .with('address', unofficialHandler)
              .with('displayName', name)
              .with('logoUrl', logoUrl)
              .build(),
          ])
          .build();

        mockDataDecoderApi.getContracts
          .mockResolvedValueOnce(rawify(mockContractPage))
          .mockResolvedValueOnce(rawify(mockFallbackHandlerContractPage));

        const result = await service.verifyContract({
          chainId,
          contract: {
            address: contractAddress,
            isDelegateCall: false,
            fallbackHandler: unofficialHandler,
          },
        });

        expect(result).toEqual({
          logoUrl,
          name,
          CONTRACT_VERIFICATION: [
            {
              severity: SEVERITY_MAPPING.VERIFIED,
              type: 'VERIFIED',
              title: TITLE_MAPPING.VERIFIED,
              description: DESCRIPTION_MAPPING.VERIFIED({ name }),
            },
          ],
          FALLBACK_HANDLER: [
            {
              severity: SEVERITY_MAPPING.UNOFFICIAL_FALLBACK_HANDLER,
              type: 'UNOFFICIAL_FALLBACK_HANDLER',
              title: TITLE_MAPPING.UNOFFICIAL_FALLBACK_HANDLER,
              description: DESCRIPTION_MAPPING.UNOFFICIAL_FALLBACK_HANDLER(),
              fallbackHandler: {
                address: unofficialHandler,
                name,
                logoUrl,
              },
            },
          ],
        });

        expect(mockDataDecoderApi.getContracts).toHaveBeenNthCalledWith(1, {
          address: contractAddress,
          chainId,
        });
        expect(mockDataDecoderApi.getContracts).toHaveBeenNthCalledWith(2, {
          address: unofficialHandler,
          chainId,
        });
      });

      it('should omit FALLBACK_HANDLER when handler address is undefined', async () => {
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
              .with('logoUrl', logoUrl)
              .build(),
          ])
          .build();

        mockDataDecoderApi.getContracts.mockResolvedValue(
          rawify(mockContractPage),
        );

        const result = await service.verifyContract({
          chainId,
          contract: {
            address: contractAddress,
            isDelegateCall: false,
            fallbackHandler: undefined,
          },
        });

        expect(result).toEqual({
          logoUrl,
          name,
          CONTRACT_VERIFICATION: [
            {
              severity: SEVERITY_MAPPING.VERIFIED,
              type: 'VERIFIED',
              title: TITLE_MAPPING.VERIFIED,
              description: DESCRIPTION_MAPPING.VERIFIED({ name }),
            },
          ],
        });

        expect(mockDataDecoderApi.getContracts).toHaveBeenCalledTimes(1);
      });

      it('should include FALLBACK_HANDLER when contract not found', async () => {
        const unofficialHandler = getAddress(faker.finance.ethereumAddress());
        const mockContractPage = pageBuilder()
          .with('count', 0)
          .with('results', [])
          .build();

        const mockFallbackHandlerContractPage = pageBuilder()
          .with('count', 1)
          .with('results', [
            contractBuilder()
              .with('address', unofficialHandler)
              .with('displayName', '')
              .with('name', '')
              .with('logoUrl', undefined)
              .build(),
          ])
          .build();

        mockDataDecoderApi.getContracts
          .mockResolvedValueOnce(rawify(mockContractPage))
          .mockResolvedValueOnce(rawify(mockFallbackHandlerContractPage));

        const result = await service.verifyContract({
          chainId,
          contract: {
            address: contractAddress,
            isDelegateCall: false,
            fallbackHandler: unofficialHandler,
          },
        });

        expect(result).toEqual({
          FALLBACK_HANDLER: [
            {
              severity: SEVERITY_MAPPING.UNOFFICIAL_FALLBACK_HANDLER,
              type: 'UNOFFICIAL_FALLBACK_HANDLER',
              title: TITLE_MAPPING.UNOFFICIAL_FALLBACK_HANDLER,
              description: DESCRIPTION_MAPPING.UNOFFICIAL_FALLBACK_HANDLER(),
              fallbackHandler: {
                address: unofficialHandler,
              },
            },
          ],
        });
        expect(mockDataDecoderApi.getContracts).toHaveBeenCalledTimes(2);
      });

      it('should include FALLBACK_HANDLER when contract verification fails', async () => {
        const unofficialHandler = getAddress(faker.finance.ethereumAddress());
        const mockFallbackHandlerContractPage = pageBuilder()
          .with('count', 1)
          .with('results', [
            contractBuilder()
              .with('address', unofficialHandler)
              .with('displayName', name)
              .with('logoUrl', logoUrl)
              .build(),
          ])
          .build();

        mockDataDecoderApi.getContracts
          .mockRejectedValueOnce(new Error('API error'))
          .mockResolvedValueOnce(rawify(mockFallbackHandlerContractPage));

        const result = await service.verifyContract({
          chainId,
          contract: {
            address: contractAddress,
            isDelegateCall: false,
            fallbackHandler: unofficialHandler,
          },
        });

        expect(result).toEqual({
          CONTRACT_VERIFICATION: [
            {
              severity: SEVERITY_MAPPING.VERIFICATION_UNAVAILABLE,
              type: 'VERIFICATION_UNAVAILABLE',
              title: TITLE_MAPPING.VERIFICATION_UNAVAILABLE,
              description: DESCRIPTION_MAPPING.VERIFICATION_UNAVAILABLE(),
            },
          ],
          FALLBACK_HANDLER: [
            {
              severity: SEVERITY_MAPPING.UNOFFICIAL_FALLBACK_HANDLER,
              type: 'UNOFFICIAL_FALLBACK_HANDLER',
              title: TITLE_MAPPING.UNOFFICIAL_FALLBACK_HANDLER,
              description: DESCRIPTION_MAPPING.UNOFFICIAL_FALLBACK_HANDLER(),
              fallbackHandler: {
                address: unofficialHandler,
                name,
                logoUrl,
              },
            },
          ],
        });
      });

      it('should return UNOFFICIAL_FALLBACK_HANDLER when TWAP handler used on non-TWAP network', async () => {
        const nonTwapChainId = '999'; // Not in TWAP_FALLBACK_HANDLER_NETWORKS

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
              .with('logoUrl', logoUrl)
              .build(),
          ])
          .build();

        const mockFallbackHandlerContractPage = pageBuilder()
          .with('count', 1)
          .with('results', [
            contractBuilder()
              .with('address', TWAP_FALLBACK_HANDLER)
              .with('displayName', name)
              .with('logoUrl', logoUrl)
              .build(),
          ])
          .build();

        mockDataDecoderApi.getContracts
          .mockResolvedValueOnce(rawify(mockContractPage))
          .mockResolvedValueOnce(rawify(mockFallbackHandlerContractPage));

        const result = await service.verifyContract({
          chainId: nonTwapChainId,
          contract: {
            address: contractAddress,
            isDelegateCall: false,
            fallbackHandler: TWAP_FALLBACK_HANDLER,
          },
        });

        expect(result).toEqual({
          logoUrl,
          name,
          CONTRACT_VERIFICATION: [
            {
              severity: SEVERITY_MAPPING.VERIFIED,
              type: 'VERIFIED',
              title: TITLE_MAPPING.VERIFIED,
              description: DESCRIPTION_MAPPING.VERIFIED({ name }),
            },
          ],
          FALLBACK_HANDLER: [
            {
              severity: SEVERITY_MAPPING.UNOFFICIAL_FALLBACK_HANDLER,
              type: 'UNOFFICIAL_FALLBACK_HANDLER',
              title: TITLE_MAPPING.UNOFFICIAL_FALLBACK_HANDLER,
              description: DESCRIPTION_MAPPING.UNOFFICIAL_FALLBACK_HANDLER(),
              fallbackHandler: {
                address: TWAP_FALLBACK_HANDLER,
                name,
                logoUrl,
              },
            },
          ],
        });
      });

      it('should omit FALLBACK_HANDLER when TWAP handler used on TWAP-supported network', async () => {
        const twapChainId = '1'; // Ethereum mainnet - in TWAP_FALLBACK_HANDLER_NETWORKS

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
              .with('logoUrl', logoUrl)
              .build(),
          ])
          .build();

        mockDataDecoderApi.getContracts.mockResolvedValue(
          rawify(mockContractPage),
        );

        const result = await service.verifyContract({
          chainId: twapChainId,
          contract: {
            address: contractAddress,
            isDelegateCall: false,
            fallbackHandler: TWAP_FALLBACK_HANDLER,
          },
        });

        expect(result).toEqual({
          logoUrl,
          name,
          CONTRACT_VERIFICATION: [
            {
              severity: SEVERITY_MAPPING.VERIFIED,
              type: 'VERIFIED',
              title: TITLE_MAPPING.VERIFIED,
              description: DESCRIPTION_MAPPING.VERIFIED({ name }),
            },
          ],
        });
        expect(mockDataDecoderApi.getContracts).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('analyzeInteractions', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const contractAddress = getAddress(faker.finance.ethereumAddress());

    it('should return empty response when no interactions exist', async () => {
      const mockTransactionPage = pageBuilder().with('count', 0).build();

      mockTransactionApi.getMultisigTransactions.mockResolvedValue(
        rawify(mockTransactionPage),
      );

      const result = await service.analyzeInteractions({
        chainId,
        safeAddress,
        address: contractAddress,
      });

      expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(chainId);
      expect(mockTransactionApi.getMultisigTransactions).toHaveBeenCalledWith({
        safeAddress,
        to: contractAddress,
        executed: true,
        limit: 1,
      });

      expect(result).toEqual({});
    });

    it('should return empty response when count is undefined', async () => {
      const mockTransactionPage = pageBuilder().with('count', null).build();

      mockTransactionApi.getMultisigTransactions.mockResolvedValue(
        rawify(mockTransactionPage),
      );

      const result = await service.analyzeInteractions({
        chainId,
        safeAddress,
        address: contractAddress,
      });

      expect(result).toEqual({});
    });

    it('should return KNOWN_CONTRACT when count > 0', async () => {
      const mockTransactionPage = pageBuilder()
        .with('count', faker.number.int({ min: 1 }))
        .build();

      mockTransactionApi.getMultisigTransactions.mockResolvedValue(
        rawify(mockTransactionPage),
      );

      const result = await service.analyzeInteractions({
        chainId,
        safeAddress,
        address: contractAddress,
      });

      expect(result).toEqual({
        CONTRACT_INTERACTION: [
          {
            severity: SEVERITY_MAPPING.KNOWN_CONTRACT,
            type: 'KNOWN_CONTRACT',
            title: TITLE_MAPPING.KNOWN_CONTRACT,
            description: 'You have already interacted with this contract.',
          },
        ],
      });
    });

    it('should return FAILED when transaction API manager fails', async () => {
      const errorMessage = 'Transaction API manager error';

      mockTransactionApiManager.getApi.mockRejectedValue(
        new Error(errorMessage),
      );

      const result = await service.analyzeInteractions({
        chainId,
        safeAddress,
        address: contractAddress,
      });

      expect(result).toEqual({
        CONTRACT_INTERACTION: [
          {
            severity: SEVERITY_MAPPING.FAILED,
            type: 'FAILED',
            title: TITLE_MAPPING.FAILED,
            description: DESCRIPTION_MAPPING.FAILED({
              error: 'contract interactions unavailable',
            }),
          },
        ],
      });
      expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(chainId);
      expect(mockTransactionApi.getMultisigTransactions).not.toHaveBeenCalled();
    });

    it('should return FAILED when transaction API fails', async () => {
      const errorMessage = 'Transaction API error';

      mockTransactionApi.getMultisigTransactions.mockRejectedValue(
        new Error(errorMessage),
      );

      const result = await service.analyzeInteractions({
        chainId,
        safeAddress,
        address: contractAddress,
      });

      expect(result).toEqual({
        CONTRACT_INTERACTION: [
          {
            severity: SEVERITY_MAPPING.FAILED,
            type: 'FAILED',
            title: TITLE_MAPPING.FAILED,
            description: DESCRIPTION_MAPPING.FAILED({
              error: 'contract interactions unavailable',
            }),
          },
        ],
      });
      expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(chainId);
      expect(mockTransactionApi.getMultisigTransactions).toHaveBeenCalledWith({
        safeAddress,
        to: contractAddress,
        executed: true,
        limit: 1,
      });
    });
  });
});
