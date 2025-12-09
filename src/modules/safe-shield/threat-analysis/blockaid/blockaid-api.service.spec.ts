import { BlockaidApi } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.service';
// import { GUARD_STORAGE_POSITION } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.constants';
import type { TransactionScanResponse } from '@blockaid/client/resources/evm/evm';
import type { Address } from 'viem';
import { faker } from '@faker-js/faker';
import type Blockaid from '@blockaid/client';
import type { ILoggingService } from '@/logging/logging.interface';
import type { BlockaidScanResponse } from '@/modules/safe-shield/threat-analysis/blockaid/schemas/blockaid-scan-response.schema';

const createMockWithResponse = (
  data: TransactionScanResponse,
  requestId: string | null,
): ReturnType<typeof mockBlockaidClient.evm.jsonRpc.scan> =>
  ({
    withResponse: jest.fn().mockResolvedValue({
      data,
      response: {
        headers: {
          get: jest.fn().mockImplementation((header: string) => {
            if (header.toLowerCase() === 'x-request-id') {
              return requestId;
            }
            return null;
          }),
        },
      },
    }),
  }) as unknown as ReturnType<typeof mockBlockaidClient.evm.jsonRpc.scan>;

const mockBlockaidClient = {
  evm: {
    jsonRpc: {
      scan: jest.fn(),
    },
    transaction: {
      report: jest.fn(),
    },
  },
} as jest.MockedObjectDeep<Blockaid>;

const mockLoggingService = {
  info: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('BlockaidApi', () => {
  let service: BlockaidApi;

  beforeEach(() => {
    jest.resetAllMocks();

    service = new BlockaidApi(mockLoggingService);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).blockaidClient = mockBlockaidClient;
  });

  describe('scanTransaction', () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress() as Address;
    const walletAddress = faker.finance.ethereumAddress() as Address;
    const message = JSON.stringify({
      domain: {
        chainId: 1,
        name: 'Test Token',
        version: '1',
        verifyingContract: faker.finance.ethereumAddress(),
      },
      message: {
        owner: safeAddress,
        spender: faker.finance.ethereumAddress(),
        value: '1000000000000000000',
        nonce: '0',
        deadline: '1988064000',
      },
      primaryType: 'Permit',
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
    });
    // Temporary disable state override (to be reverted in
    // https://linear.app/safe-global/issue/COR-802/put-back-blockaid-state-override)

    // const stateOverride = {
    //   [safeAddress]: {
    //     stateDiff: {
    //       [GUARD_STORAGE_POSITION]:
    //         '0x0000000000000000000000000000000000000000000000000000000000000000',
    //     },
    //   },
    // };

    it('should call blockaid client with correct parameters and return request_id from header', async () => {
      const origin = faker.internet.url();
      const request_id = faker.string.uuid();

      const mockScanResponse = {
        chain: `0x${chainId}`,
        block: faker.string.numeric(),
        validation: {
          status: 'Success',
          result_type: 'Benign',
          description: 'No issues detected',
          features: [],
        },
      } as TransactionScanResponse;

      const expectedResponse: BlockaidScanResponse = {
        validation: {
          result_type: 'Benign',
          description: 'No issues detected',
          features: [],
        },
        request_id,
      };

      mockBlockaidClient.evm.jsonRpc.scan.mockReturnValue(
        createMockWithResponse(mockScanResponse, request_id),
      );

      const result = await service.scanTransaction(
        chainId,
        safeAddress,
        walletAddress,
        message,
        origin,
      );

      expect(mockBlockaidClient.evm.jsonRpc.scan).toHaveBeenCalledWith({
        chain: `0x${chainId}`,
        data: {
          method: 'eth_signTypedData_v4',
          params: [safeAddress, message],
        },
        options: ['simulation', 'validation'],
        metadata: { domain: origin },
        account_address: walletAddress,
        //state_override: stateOverride,
      });

      expect(result).toEqual(expectedResponse);
      expect(mockLoggingService.info).toHaveBeenCalledWith({
        message: 'Blockaid scan response',
        response: {
          chain: mockScanResponse.chain,
          request_id,
          validation: {
            status: mockScanResponse.validation?.status,
            result_type: mockScanResponse.validation?.result_type,
            description: mockScanResponse.validation?.description,
            features: [],
          },
          simulation: undefined,
        },
      });
    });

    it('should call blockaid client without domain parameter/ with non_dapp', async () => {
      const request_id = faker.string.uuid();

      const mockScanResponse = {
        block: faker.string.numeric(),
        chain: `0x${chainId}`,
      } as TransactionScanResponse;

      const expectedResponse: BlockaidScanResponse = {
        request_id,
      };

      mockBlockaidClient.evm.jsonRpc.scan.mockReturnValue(
        createMockWithResponse(mockScanResponse, request_id),
      );

      const result = await service.scanTransaction(
        chainId,
        safeAddress,
        walletAddress,
        message,
      );

      expect(mockBlockaidClient.evm.jsonRpc.scan).toHaveBeenCalledWith({
        chain: `0x${chainId}`,
        data: {
          method: 'eth_signTypedData_v4',
          params: [safeAddress, message],
        },
        options: ['simulation', 'validation'],
        metadata: { non_dapp: true },
        account_address: walletAddress,
        //state_override: stateOverride,
      });

      expect(result).toEqual(expectedResponse);
    });

    it('should return null request_id when header is not present', async () => {
      const mockScanResponse: TransactionScanResponse = {
        block: faker.string.numeric(),
        chain: `0x${chainId}`,
      } as TransactionScanResponse;

      mockBlockaidClient.evm.jsonRpc.scan.mockReturnValue(
        createMockWithResponse(mockScanResponse, null),
      );

      const result = await service.scanTransaction(
        chainId,
        safeAddress,
        walletAddress,
        message,
      );

      expect(result).toEqual({});

      expect(mockLoggingService.info).toHaveBeenCalledWith({
        message: 'Blockaid scan response',
        response: {
          chain: mockScanResponse.chain,
          request_id: undefined,
          validation: undefined,
          simulation: undefined,
        },
      });
    });

    it('should forward errors from blockaid client', async () => {
      const error = new Error('Blockaid API error');
      mockBlockaidClient.evm.jsonRpc.scan.mockReturnValue({
        withResponse: jest.fn().mockRejectedValue(error),
      } as unknown as ReturnType<typeof mockBlockaidClient.evm.jsonRpc.scan>);

      await expect(
        service.scanTransaction(chainId, safeAddress, walletAddress, message),
      ).rejects.toThrow('Blockaid API error');
    });
  });

  describe('reportTransaction', () => {
    const requestId = faker.string.uuid();
    const details = 'This transaction was incorrectly flagged';

    it('should call blockaid client with correct parameters for FALSE_POSITIVE', async () => {
      mockBlockaidClient.evm.transaction.report.mockResolvedValue({});

      await service.reportTransaction({
        event: 'FALSE_POSITIVE',
        details,
        requestId,
      });

      expect(mockBlockaidClient.evm.transaction.report).toHaveBeenCalledWith({
        event: 'FALSE_POSITIVE',
        details,
        report: {
          type: 'request_id',
          request_id: requestId,
        },
      });
    });

    it('should call blockaid client with correct parameters for FALSE_NEGATIVE', async () => {
      mockBlockaidClient.evm.transaction.report.mockResolvedValue({});

      await service.reportTransaction({
        event: 'FALSE_NEGATIVE',
        details,
        requestId,
      });

      expect(mockBlockaidClient.evm.transaction.report).toHaveBeenCalledWith({
        event: 'FALSE_NEGATIVE',
        details,
        report: {
          type: 'request_id',
          request_id: requestId,
        },
      });
    });

    it('should forward errors from blockaid client', async () => {
      const error = new Error('Blockaid API error');
      mockBlockaidClient.evm.transaction.report.mockRejectedValue(error);

      await expect(
        service.reportTransaction({
          event: 'FALSE_POSITIVE',
          details,
          requestId,
        }),
      ).rejects.toThrow('Blockaid API error');
    });
  });
});
