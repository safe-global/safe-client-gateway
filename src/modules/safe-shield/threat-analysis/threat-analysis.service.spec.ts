import { ThreatAnalysisService } from '@/modules/safe-shield/threat-analysis/threat-analysis.service';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IBlockaidApi } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.interface';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { TransactionScanResponse } from '@blockaid/client/resources/evm/evm';
import type { ThreatAnalysisRequestBody } from '@/modules/safe-shield/entities/analysis-requests.entity';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { threatAnalysisRequestBodyBuilder } from '@/modules/safe-shield/entities/__tests__/builders/analysis-requests.builder';
import { threatAnalysisResponseBuilder } from '@/modules/safe-shield/entities/__tests__/builders/analysis-responses.builder';
import {
  DESCRIPTION_MAPPING,
  SEVERITY_MAPPING,
  TITLE_MAPPING,
} from '@/modules/safe-shield/threat-analysis/threat-analysis.constants';
import { LogType } from '@/domain/common/entities/log-type.entity';

const mockBlockaidApi = {
  scanTransaction: jest.fn(),
} as jest.MockedObjectDeep<IBlockaidApi>;

const mockConfigurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;

const mockLoggingService = {
  debug: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('ThreatAnalysisService', () => {
  let service: ThreatAnalysisService;
  let fakeCacheService: FakeCacheService;

  beforeEach(() => {
    mockConfigurationService.getOrThrow.mockReturnValue(3600);

    fakeCacheService = new FakeCacheService();
    service = new ThreatAnalysisService(
      mockBlockaidApi,
      fakeCacheService,
      mockConfigurationService,
      mockLoggingService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    fakeCacheService.clear();
  });

  describe('analyze', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const walletAddress = getAddress(faker.finance.ethereumAddress());
    const requestData: ThreatAnalysisRequestBody =
      threatAnalysisRequestBodyBuilder()
        .with('walletAddress', walletAddress)
        .build();

    describe('caching behavior', () => {
      const mockSuccessScanResponse = {
        validation: {
          status: 'Success',
          result_type: 'Benign',
          classification: '',
          reason: '',
          description: '',
          features: [],
        },
        simulation: {
          status: 'Success',
        },
      } as unknown as TransactionScanResponse;

      it('should return cached analysis when available', async () => {
        const cachedResponse =
          threatAnalysisResponseBuilder('NO_THREAT').build();
        const cacheDir = CacheRouter.getThreatAnalysisCacheDir({
          chainId,
          requestData,
        });
        await fakeCacheService.hSet(
          cacheDir,
          JSON.stringify(cachedResponse),
          3600,
        );

        const result = await service.analyze({
          chainId,
          safeAddress,
          requestData,
        });

        expect(result).toEqual(cachedResponse);
        expect(mockBlockaidApi.scanTransaction).not.toHaveBeenCalled();
      });

      it('should handle JSON parsing errors in cached data gracefully', async () => {
        const cacheDir = CacheRouter.getThreatAnalysisCacheDir({
          chainId,
          requestData,
        });
        const invalidCachedData = 'invalid json data';
        await fakeCacheService.hSet(cacheDir, invalidCachedData, 3600);

        mockBlockaidApi.scanTransaction.mockResolvedValue(
          mockSuccessScanResponse,
        );

        const result = await service.analyze({
          chainId,
          safeAddress,
          requestData,
        });

        expect(result).toBeDefined();
        expect(result).toEqual({
          THREAT: [
            {
              severity: SEVERITY_MAPPING.NO_THREAT,
              type: 'NO_THREAT',
              title: TITLE_MAPPING.NO_THREAT,
              description: DESCRIPTION_MAPPING.NO_THREAT(),
            },
          ],
          BALANCE_CHANGE: [],
        });
        expect(mockBlockaidApi.scanTransaction).toHaveBeenCalled();

        expect(mockLoggingService.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'Failed to parse cached threat analysis results',
          ),
        );
        expect(mockLoggingService.debug).toHaveBeenCalledWith({
          type: 'CACHE_MISS',
          key: expect.any(String),
          field: expect.any(String),
        });
      });

      it('should analyze threats and cache result when cache miss', async () => {
        const expectedResponse = {
          THREAT: [
            {
              severity: SEVERITY_MAPPING.NO_THREAT,
              type: 'NO_THREAT',
              title: TITLE_MAPPING.NO_THREAT,
              description: DESCRIPTION_MAPPING.NO_THREAT(),
            },
          ],
          BALANCE_CHANGE: [],
        };
        mockBlockaidApi.scanTransaction.mockResolvedValue(
          mockSuccessScanResponse,
        );

        const result = await service.analyze({
          chainId,
          safeAddress,
          requestData,
        });

        expect(result).toEqual(expectedResponse);
        expect(mockBlockaidApi.scanTransaction).toHaveBeenCalledWith(
          chainId,
          safeAddress,
          walletAddress,
          expect.any(String),
        );

        const cacheDir = CacheRouter.getThreatAnalysisCacheDir({
          chainId,
          requestData,
        });
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

    describe('validation', () => {
      it('should handle undefined validation as FAILED', async () => {
        const mockScanResponse = {
          block: faker.string.numeric(),
          chain: 'ethereum',
          account_address: safeAddress,
          simulation: {
            status: 'Success',
          },
        } as unknown as TransactionScanResponse;

        mockBlockaidApi.scanTransaction.mockResolvedValue(mockScanResponse);

        const result = await service.analyze({
          chainId,
          safeAddress,
          requestData,
        });

        expect(result).toBeDefined();
        expect(result).toEqual({
          THREAT: [
            {
              severity: SEVERITY_MAPPING.FAILED,
              type: 'FAILED',
              title: TITLE_MAPPING.FAILED,
              description: DESCRIPTION_MAPPING.FAILED(),
            },
          ],
          BALANCE_CHANGE: [],
        });
      });

      it('should handle validation result_type Error as FAILED', async () => {
        const mockScanResponse = {
          block: faker.string.numeric(),
          chain: 'ethereum',
          account_address: safeAddress,
          validation: {
            status: 'Success',
            result_type: 'Error',
            classification: '',
            description: '',
            reason: '',
            error: 'Validation failed',
            features: [],
          },
          simulation: {
            status: 'Success',
          },
        } as unknown as TransactionScanResponse;

        mockBlockaidApi.scanTransaction.mockResolvedValue(mockScanResponse);

        const result = await service.analyze({
          chainId,
          safeAddress,
          requestData,
        });

        expect(result).toBeDefined();
        expect(result).toEqual({
          THREAT: [
            {
              severity: SEVERITY_MAPPING.FAILED,
              type: 'FAILED',
              title: TITLE_MAPPING.FAILED,
              description: DESCRIPTION_MAPPING.FAILED(),
            },
          ],
          BALANCE_CHANGE: [],
        });
      });

      it('should handle validation result_type Malicious without features', async () => {
        const classification = faker.lorem.words(2);
        const reason = faker.lorem.words(2);

        const mockScanResponse = {
          validation: {
            status: 'Success',
            result_type: 'Malicious',
            classification,
            reason,
            description: faker.lorem.sentence(),
            features: [],
          },
          simulation: {
            status: 'Success',
          },
        } as unknown as TransactionScanResponse;

        mockBlockaidApi.scanTransaction.mockResolvedValue(mockScanResponse);

        const result = await service.analyze({
          chainId,
          safeAddress,
          requestData,
        });

        expect(result).toBeDefined();
        expect(result).toEqual({
          THREAT: [
            {
              severity: SEVERITY_MAPPING.MALICIOUS,
              type: 'MALICIOUS',
              title: TITLE_MAPPING.MALICIOUS,
              description: DESCRIPTION_MAPPING.MALICIOUS({
                classification,
                reason,
              }),
              issues: new Map(),
            },
          ],
          BALANCE_CHANGE: [],
        });
      });

      it('should handle validation result_type Warning with features', async () => {
        const classification = faker.lorem.words(2);
        const reason = faker.lorem.words(2);

        const features = [
          {
            description: faker.lorem.sentence(),
            feature_id: 'new_approval',
            type: 'Warning',
          },
          {
            description: faker.lorem.sentence(),
            feature_id: 'benign_activity',
            type: 'Benign',
          },
          {
            description: faker.lorem.sentence(),
            feature_id: 'malicious_contract_interaction',
            type: 'Malicious',
            address: getAddress(faker.finance.ethereumAddress()),
          },
          {
            description: faker.lorem.sentence(),
            feature_id: 'info_note',
            type: 'Info',
          },
        ];
        const mockScanResponse = {
          validation: {
            status: 'Success',
            result_type: 'Warning',
            classification,
            reason,
            description: faker.lorem.sentence(),
            features: features,
          },
          simulation: {
            status: 'Success',
          },
        } as unknown as TransactionScanResponse;

        mockBlockaidApi.scanTransaction.mockResolvedValue(mockScanResponse);

        const result = await service.analyze({
          chainId,
          safeAddress,
          requestData,
        });

        expect(result).toBeDefined();
        expect(result).toEqual({
          THREAT: [
            {
              severity: SEVERITY_MAPPING.MODERATE,
              type: 'MODERATE',
              title: TITLE_MAPPING.MODERATE,
              description: DESCRIPTION_MAPPING.MODERATE({
                classification,
                reason,
              }),
              issues: new Map([
                ['CRITICAL', [features[2].description]],
                ['WARN', [features[0].description]],
              ]),
            },
          ],
          BALANCE_CHANGE: [],
        });
      });
    });

    describe('simulation', () => {
      it('should handle undefined simulation gracefully', async () => {
        const mockScanResponse = {
          block: faker.string.numeric(),
          chain: 'ethereum',
          account_address: safeAddress,
          validation: {
            status: 'Success',
            result_type: 'Benign',
            classification: '',
            description: '',
            reason: '',
            features: [],
          },
        } as unknown as TransactionScanResponse;

        mockBlockaidApi.scanTransaction.mockResolvedValue(mockScanResponse);

        const result = await service.analyze({
          chainId,
          safeAddress,
          requestData,
        });

        expect(result).toBeDefined();
        expect(result).toEqual({
          THREAT: [
            {
              severity: SEVERITY_MAPPING.NO_THREAT,
              type: 'NO_THREAT',
              title: TITLE_MAPPING.NO_THREAT,
              description: DESCRIPTION_MAPPING.NO_THREAT(),
            },
          ],
          BALANCE_CHANGE: [],
        });
      });

      it('should handle simulation with Error status as FAILED', async () => {
        const mockScanResponse = {
          block: faker.string.numeric(),
          chain: 'ethereum',
          account_address: safeAddress,
          validation: {
            status: 'Success',
            result_type: 'Benign',
            classification: '',
            description: '',
            reason: '',
            features: [],
          },
          simulation: {
            status: 'Error',
            error: 'Simulation failed',
            description: 'Simulation could not be completed',
          },
        } as unknown as TransactionScanResponse;

        mockBlockaidApi.scanTransaction.mockResolvedValue(mockScanResponse);

        const result = await service.analyze({
          chainId,
          safeAddress,
          requestData,
        });

        expect(result).toBeDefined();
        expect(result).toEqual({
          THREAT: [
            {
              severity: SEVERITY_MAPPING.FAILED,
              type: 'FAILED',
              title: TITLE_MAPPING.FAILED,
              description: DESCRIPTION_MAPPING.FAILED({
                reason: 'Simulation could not be completed',
              }),
            },
            {
              severity: SEVERITY_MAPPING.NO_THREAT,
              type: 'NO_THREAT',
              title: TITLE_MAPPING.NO_THREAT,
              description: DESCRIPTION_MAPPING.NO_THREAT(),
            },
          ],
          BALANCE_CHANGE: [],
        });
      });

      it('should handle simulation with PROXY_UPGRADE', async () => {
        const oldMasterCopy = getAddress(faker.finance.ethereumAddress());
        const newMasterCopy = getAddress(faker.finance.ethereumAddress());
        const mockScanResponse = {
          block: faker.string.numeric(),
          chain: 'ethereum',
          account_address: safeAddress,
          validation: {
            status: 'Success',
            result_type: 'Benign',
            classification: '',
            description: '',
            reason: '',
            features: [],
          },
          simulation: {
            status: 'Success',
            assets_diffs: [],
            contract_management: {
              [safeAddress]: [
                {
                  type: 'PROXY_UPGRADE',
                  before: {
                    address: oldMasterCopy,
                  },
                  after: {
                    address: newMasterCopy,
                  },
                },
              ],
            },
          },
        } as unknown as TransactionScanResponse;

        mockBlockaidApi.scanTransaction.mockResolvedValue(mockScanResponse);

        const result = await service.analyze({
          chainId,
          safeAddress,
          requestData,
        });

        expect(result).toBeDefined();
        expect(result).toEqual({
          THREAT: [
            {
              severity: SEVERITY_MAPPING.MASTER_COPY_CHANGE,
              type: 'MASTER_COPY_CHANGE',
              title: TITLE_MAPPING.MASTER_COPY_CHANGE,
              description: DESCRIPTION_MAPPING.MASTER_COPY_CHANGE(),
              before: oldMasterCopy,
              after: newMasterCopy,
            },
            {
              severity: SEVERITY_MAPPING.NO_THREAT,
              type: 'NO_THREAT',
              title: TITLE_MAPPING.NO_THREAT,
              description: DESCRIPTION_MAPPING.NO_THREAT(),
            },
          ],
          BALANCE_CHANGE: [],
        });
      });

      it('should handle simulation with OWNERSHIP_CHANGE', async () => {
        const mockScanResponse = {
          block: faker.string.numeric(),
          chain: 'ethereum',
          account_address: safeAddress,
          validation: {
            status: 'Success',
            result_type: 'Benign',
            classification: '',
            description: '',
            reason: '',
            features: [],
          },
          simulation: {
            status: 'Success',
            assets_diffs: [],
            contract_management: {
              [safeAddress]: [
                {
                  type: 'OWNERSHIP_CHANGE',
                },
              ],
            },
          },
        } as unknown as TransactionScanResponse;

        mockBlockaidApi.scanTransaction.mockResolvedValue(mockScanResponse);

        const result = await service.analyze({
          chainId,
          safeAddress,
          requestData,
        });

        expect(result).toBeDefined();
        expect(result).toEqual({
          THREAT: [
            {
              severity: SEVERITY_MAPPING.OWNERSHIP_CHANGE,
              type: 'OWNERSHIP_CHANGE',
              title: TITLE_MAPPING.OWNERSHIP_CHANGE,
              description: DESCRIPTION_MAPPING.OWNERSHIP_CHANGE(),
            },
            {
              severity: SEVERITY_MAPPING.NO_THREAT,
              type: 'NO_THREAT',
              title: TITLE_MAPPING.NO_THREAT,
              description: DESCRIPTION_MAPPING.NO_THREAT(),
            },
          ],
          BALANCE_CHANGE: [],
        });
      });

      it('should handle simulation with MODULE_CHANGE', async () => {
        const mockScanResponse = {
          block: faker.string.numeric(),
          chain: 'ethereum',
          account_address: safeAddress,
          validation: {
            status: 'Success',
            result_type: 'Benign',
            classification: '',
            description: '',
            reason: '',
            features: [],
          },
          simulation: {
            status: 'Success',
            contract_management: {
              [safeAddress]: [
                {
                  type: 'MODULE_CHANGE',
                },
              ],
            },
          },
        } as unknown as TransactionScanResponse;

        mockBlockaidApi.scanTransaction.mockResolvedValue(mockScanResponse);

        const result = await service.analyze({
          chainId,
          safeAddress,
          requestData,
        });

        expect(result).toBeDefined();
        expect(result).toEqual({
          THREAT: [
            {
              severity: SEVERITY_MAPPING.MODULE_CHANGE,
              type: 'MODULE_CHANGE',
              title: TITLE_MAPPING.MODULE_CHANGE,
              description: DESCRIPTION_MAPPING.MODULE_CHANGE(),
            },
            {
              severity: SEVERITY_MAPPING.NO_THREAT,
              type: 'NO_THREAT',
              title: TITLE_MAPPING.NO_THREAT,
              description: DESCRIPTION_MAPPING.NO_THREAT(),
            },
          ],
          BALANCE_CHANGE: [],
        });
      });

      it('should populate balance changes from simulation', async () => {
        const mockErc20Address = getAddress(faker.finance.ethereumAddress());
        const mockNativeAddress = getAddress(faker.finance.ethereumAddress());
        const tokenSymbol = faker.string.alpha(4).toUpperCase();
        const logoUrl = faker.internet.url();
        const inValue = faker.string.numeric(7);
        const outValue = faker.string.numeric(6);
        const nativeOutValue = faker.string.numeric(18);

        const mockScanResponse = {
          block: faker.string.numeric(),
          chain: 'ethereum',
          account_address: safeAddress,
          validation: {
            status: 'Success',
            result_type: 'Benign',
            classification: '',
            description: '',
            reason: '',
            features: [],
          },
          simulation: {
            status: 'Success',
            assets_diffs: {
              [safeAddress]: [
                {
                  asset: {
                    type: 'ERC20',
                    symbol: tokenSymbol,
                    address: mockErc20Address,
                    logo_url: logoUrl,
                  },
                  in: [{ value: inValue }],
                  out: [{ value: outValue }],
                },
                {
                  asset: {
                    type: 'NATIVE',
                    address: mockNativeAddress,
                  },
                  in: [],
                  out: [{ value: nativeOutValue }],
                },
              ],
            },
          },
        } as unknown as TransactionScanResponse;

        mockBlockaidApi.scanTransaction.mockResolvedValue(mockScanResponse);

        const result = await service.analyze({
          chainId,
          safeAddress,
          requestData,
        });

        expect(result).toBeDefined();
        expect(result).toEqual({
          THREAT: [
            {
              severity: SEVERITY_MAPPING.NO_THREAT,
              type: 'NO_THREAT',
              title: TITLE_MAPPING.NO_THREAT,
              description: DESCRIPTION_MAPPING.NO_THREAT(),
            },
          ],
          BALANCE_CHANGE: [
            {
              asset: {
                type: 'ERC20',
                symbol: tokenSymbol,
                address: mockErc20Address,
                logo_url: logoUrl,
              },
              in: [{ value: inValue }],
              out: [{ value: outValue }],
            },
            {
              asset: {
                type: 'NATIVE',
                address: mockNativeAddress,
              },
              in: [],
              out: [{ value: nativeOutValue }],
            },
          ],
        });
      });
    });

    it('should handle blockaid API errors', async () => {
      mockBlockaidApi.scanTransaction.mockRejectedValue(new Error('API Error'));
      const result = await service.analyze({
        chainId,
        safeAddress,
        requestData,
      });
      expect(result).toBeDefined();
      expect(result).toEqual({
        THREAT: [
          {
            severity: SEVERITY_MAPPING.FAILED,
            type: 'FAILED',
            title: TITLE_MAPPING.FAILED,
            description: DESCRIPTION_MAPPING.FAILED(),
          },
        ],
        BALANCE_CHANGE: [],
      });
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error during threat analysis for Safe'),
      );
    });

    it('should prepare the correct message for Blockaid API', async () => {
      const mockScanResponse = {
        block: faker.string.numeric(),
        chain: 'ethereum',
        account_address: walletAddress,
        validation: {
          status: 'Success',
          result_type: 'Benign',
          classification: '',
          description: '',
          reason: '',
          features: [],
        },
        simulation: {
          status: 'Success',
        },
      } as unknown as TransactionScanResponse;

      mockBlockaidApi.scanTransaction.mockResolvedValue(mockScanResponse);

      await service.analyze({
        chainId,
        safeAddress,
        requestData,
      });

      expect(mockBlockaidApi.scanTransaction).toHaveBeenCalledWith(
        chainId,
        safeAddress,
        walletAddress,
        expect.any(String),
      );

      // Get the message argument passed to scanTransaction
      const callArgs = mockBlockaidApi.scanTransaction.mock.calls[0];
      const messageArg = callArgs[3];

      expect(() => JSON.parse(messageArg)).not.toThrow();
      const parsedMessage = JSON.parse(messageArg);

      // Verify EIP-712 typed data structure
      expect(parsedMessage).toHaveProperty('types');
      expect(parsedMessage).toHaveProperty('domain');
      expect(parsedMessage).toHaveProperty('primaryType');
      expect(parsedMessage).toHaveProperty('message');

      // Verify EIP-712 types structure
      expect(parsedMessage.types).toHaveProperty('EIP712Domain');
      expect(parsedMessage.types).toHaveProperty('SafeTx');

      // Verify domain
      expect(parsedMessage.domain.verifyingContract).toBe(safeAddress);
      expect(parsedMessage.domain.chainId).toBe(Number(chainId));

      // Verify primary type
      expect(parsedMessage.primaryType).toBe('SafeTx');

      // Verify message contains transaction data
      expect(parsedMessage.message).toMatchObject({
        to: requestData.to,
        value: requestData.value,
        data: requestData.data,
        operation: requestData.operation,
        safeTxGas: requestData.safeTxGas,
        baseGas: requestData.baseGas,
        gasPrice: requestData.gasPrice,
        gasToken: requestData.gasToken,
        refundReceiver: requestData.refundReceiver,
        nonce: Number(requestData.nonce),
      });
    });

    it('should handle all results: validation, simulation and balanceChange', async () => {
      const oldMasterCopy = getAddress(faker.finance.ethereumAddress());
      const newMasterCopy = getAddress(faker.finance.ethereumAddress());
      const erc20Address = getAddress(faker.finance.ethereumAddress());
      const otherAddress = getAddress(faker.finance.ethereumAddress());
      const logoUrl = faker.internet.url();
      const inValue = faker.string.numeric(7);
      const classification = faker.lorem.words(2);
      const reason = faker.lorem.words(2);

      const mockScanResponse = {
        block: faker.string.numeric(),
        chain: 'ethereum',
        account_address: safeAddress,
        validation: {
          status: 'Success',
          result_type: 'Warning',
          classification,
          description: faker.lorem.sentence(),
          reason,
          features: [
            {
              type: 'Warning',
              description: 'High gas price detected',
            },
          ],
        },
        simulation: {
          status: 'Success',
          contract_management: {
            [safeAddress]: [
              {
                type: 'PROXY_UPGRADE',
                before: {
                  address: oldMasterCopy,
                },
                after: {
                  address: newMasterCopy,
                },
              },
              {
                type: 'OWNERSHIP_CHANGE',
              },
            ],
          },
          assets_diffs: {
            [safeAddress]: [
              {
                asset: {
                  type: 'ERC20',
                  address: erc20Address,
                  logo_url: logoUrl,
                  symbol: 'USDC',
                },
                in: [{ value: inValue }],
                out: [],
              },
            ],
            [otherAddress]: [
              {
                asset: {
                  type: 'ERC20',
                  address: getAddress(faker.finance.ethereumAddress()),
                  symbol: 'DAI',
                },
                in: [],
                out: [{ value: faker.string.numeric(10) }],
              },
            ],
          },
        },
      } as unknown as TransactionScanResponse;

      mockBlockaidApi.scanTransaction.mockResolvedValue(mockScanResponse);

      const result = await service.analyze({
        chainId,
        safeAddress,
        requestData,
      });

      expect(result).toBeDefined();
      expect(result).toEqual({
        THREAT: [
          {
            severity: SEVERITY_MAPPING.MODERATE,
            type: 'MODERATE',
            title: TITLE_MAPPING.MODERATE,
            description: DESCRIPTION_MAPPING.MODERATE({
              reason,
              classification,
            }),
            issues: new Map([['WARN', ['High gas price detected']]]),
          },
          {
            severity: SEVERITY_MAPPING.MASTER_COPY_CHANGE,
            type: 'MASTER_COPY_CHANGE',
            title: TITLE_MAPPING.MASTER_COPY_CHANGE,
            description: DESCRIPTION_MAPPING.MASTER_COPY_CHANGE(),
            before: oldMasterCopy,
            after: newMasterCopy,
          },
          {
            severity: SEVERITY_MAPPING.OWNERSHIP_CHANGE,
            type: 'OWNERSHIP_CHANGE',
            title: TITLE_MAPPING.OWNERSHIP_CHANGE,
            description: DESCRIPTION_MAPPING.OWNERSHIP_CHANGE(),
          },
        ],
        BALANCE_CHANGE: [
          {
            asset: {
              type: 'ERC20',
              address: erc20Address,
              logo_url: logoUrl,
              symbol: 'USDC',
            },
            in: [{ value: inValue }],
            out: [],
          },
        ],
      });
    });
  });
});
