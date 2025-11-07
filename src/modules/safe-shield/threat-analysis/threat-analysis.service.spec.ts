import { ThreatAnalysisService } from '@/modules/safe-shield/threat-analysis/threat-analysis.service';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IBlockaidApi } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.interface';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { TransactionScanResponse } from '@blockaid/client/resources/evm/evm';
import { threatAnalysisRequestBuilder } from '@/modules/safe-shield/entities/__tests__/builders/analysis-requests.builder';
import {
  DESCRIPTION_MAPPING,
  SEVERITY_MAPPING,
  TITLE_MAPPING,
} from '@/modules/safe-shield/threat-analysis/threat-analysis.constants';

const mockBlockaidApi = {
  scanTransaction: jest.fn(),
} as jest.MockedObjectDeep<IBlockaidApi>;

const mockLoggingService = {
  debug: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('ThreatAnalysisService', () => {
  let service: ThreatAnalysisService;

  beforeEach(() => {
    service = new ThreatAnalysisService(mockBlockaidApi, mockLoggingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('analyze', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const walletAddress = getAddress(faker.finance.ethereumAddress());
    const request = threatAnalysisRequestBuilder()
      .with('walletAddress', walletAddress)
      .build();

    it('should analyze threats', async () => {
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
        request,
      });

      expect(result).toEqual(expectedResponse);
      expect(mockBlockaidApi.scanTransaction).toHaveBeenCalledWith(
        chainId,
        safeAddress,
        walletAddress,
        expect.any(String),
        request.origin,
      );
    });

    it('should handle message serialization failure', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const circularData: any = { domain: {} };
      circularData.domain.circular = circularData;

      const requestWithCircularData = threatAnalysisRequestBuilder()
        .with('walletAddress', walletAddress)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .with('data', circularData)
        .build();

      const result = await service.analyze({
        chainId,
        safeAddress,
        request: requestWithCircularData,
      });

      expect(result).toEqual({
        THREAT: [
          {
            severity: SEVERITY_MAPPING.FAILED,
            type: 'FAILED',
            title: TITLE_MAPPING.FAILED,
            description: DESCRIPTION_MAPPING.FAILED(),
          },
        ],
      });
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to serialize threat analysis request data',
        ),
      );
      expect(mockBlockaidApi.scanTransaction).not.toHaveBeenCalled();
    });

    it('should handle blockaid API errors', async () => {
      mockBlockaidApi.scanTransaction.mockRejectedValue(new Error('API Error'));
      const result = await service.analyze({
        chainId,
        safeAddress,
        request,
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
      });
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error during threat analysis for Safe'),
      );
    });

    it('should send the correct message to Blockaid API', async () => {
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
        request,
      });

      // Get the message argument passed to scanTransaction
      const callArgs = mockBlockaidApi.scanTransaction.mock.calls[0];
      const messageArg = callArgs[3];

      expect(mockBlockaidApi.scanTransaction).toHaveBeenCalledWith(
        chainId,
        safeAddress,
        walletAddress,
        messageArg,
        request.origin,
      );

      expect(() => JSON.parse(messageArg)).not.toThrow();
      const parsedMessage = JSON.parse(messageArg);

      // Verify the message is the EIP-712 typed data from the request
      // Compare with JSON.parse/stringify to handle BigInt serialization
      expect(parsedMessage).toEqual(
        JSON.parse(
          JSON.stringify(request.data, (_key, value) =>
            typeof value === 'bigint' ? value.toString() : value,
          ),
        ),
      );
    });

    it('should handle all results: validation, simulation and balanceChange', async () => {
      const oldMasterCopy = getAddress(faker.finance.ethereumAddress());
      const newMasterCopy = getAddress(faker.finance.ethereumAddress());
      const erc20Address = getAddress(faker.finance.ethereumAddress());
      const otherAddress = getAddress(faker.finance.ethereumAddress());
      const logoUrl = faker.internet.url();
      const inValue = faker.string.numeric(7);
      const classification = 'known_malicious';
      const reason = 'transfer_farming';

      const mockScanResponse = {
        block: faker.string.numeric(),
        chain: 'ethereum',
        account_address: safeAddress,
        validation: {
          status: 'Success',
          result_type: 'Warning',
          classification,
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
        request,
      });

      expect(result).toBeDefined();
      expect(result).toEqual({
        THREAT: [
          {
            severity: SEVERITY_MAPPING.MODERATE,
            type: 'MODERATE',
            title: TITLE_MAPPING.MODERATE,
            description: DESCRIPTION_MAPPING.MODERATE({
              description:
                'The transaction transfers tokens to a known malicious address.',
            }),
            issues: { WARN: ['High gas price detected'] },
          },
          {
            severity: SEVERITY_MAPPING.MASTERCOPY_CHANGE,
            type: 'MASTERCOPY_CHANGE',
            title: TITLE_MAPPING.MASTERCOPY_CHANGE,
            description: DESCRIPTION_MAPPING.MASTERCOPY_CHANGE(),
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
          request,
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
          request,
        });

        expect(result).toBeDefined();
        expect(result).toEqual({
          THREAT: [
            {
              severity: SEVERITY_MAPPING.FAILED,
              type: 'FAILED',
              title: TITLE_MAPPING.FAILED,
              description: DESCRIPTION_MAPPING.FAILED({
                error: 'Validation failed',
              }),
            },
          ],
          BALANCE_CHANGE: [],
        });
      });

      it('should handle validation result_type Malicious without features', async () => {
        const description = faker.lorem.sentence();

        const mockScanResponse = {
          validation: {
            status: 'Success',
            result_type: 'Malicious',
            description,
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
          request,
        });

        expect(result).toBeDefined();
        expect(result).toEqual({
          THREAT: [
            {
              severity: SEVERITY_MAPPING.MALICIOUS,
              type: 'MALICIOUS',
              title: TITLE_MAPPING.MALICIOUS,
              description: DESCRIPTION_MAPPING.MALICIOUS({
                description,
              }),
              issues: {},
            },
          ],
          BALANCE_CHANGE: [],
        });
      });

      it('should handle validation result_type Warning with features', async () => {
        const classification = 'known_malicious';
        const reason = 'transfer_farming';

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
          request,
        });

        expect(result).toBeDefined();
        expect(result).toEqual({
          THREAT: [
            {
              severity: SEVERITY_MAPPING.MODERATE,
              type: 'MODERATE',
              title: TITLE_MAPPING.MODERATE,
              description: DESCRIPTION_MAPPING.MODERATE({
                description:
                  'The transaction transfers tokens to a known malicious address.',
              }),
              issues: {
                CRITICAL: [features[2].description],
                WARN: [features[0].description],
              },
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
          request,
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
          request,
        });

        expect(result).toBeDefined();
        expect(result).toEqual({
          THREAT: [
            {
              severity: SEVERITY_MAPPING.FAILED,
              type: 'FAILED',
              title: TITLE_MAPPING.FAILED,
              description: DESCRIPTION_MAPPING.FAILED({
                error: 'Simulation could not be completed',
              }),
            },
            {
              severity: SEVERITY_MAPPING.NO_THREAT,
              type: 'NO_THREAT',
              title: TITLE_MAPPING.NO_THREAT,
              description: DESCRIPTION_MAPPING.NO_THREAT(),
            },
          ],
          BALANCE_CHANGE: undefined,
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
          request,
        });

        expect(result).toBeDefined();
        expect(result).toEqual({
          THREAT: [
            {
              severity: SEVERITY_MAPPING.MASTERCOPY_CHANGE,
              type: 'MASTERCOPY_CHANGE',
              title: TITLE_MAPPING.MASTERCOPY_CHANGE,
              description: DESCRIPTION_MAPPING.MASTERCOPY_CHANGE(),
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
          request,
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
          request,
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
          request,
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
              },
              in: [],
              out: [{ value: nativeOutValue }],
            },
          ],
        });
      });
    });
  });
});
