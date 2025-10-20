import { BlockaidApi } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.service';
import { GUARD_STORAGE_POSITION } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid.constants';
import type { TransactionScanResponse } from '@blockaid/client/resources/evm/evm';
import type { Address } from 'viem';
import { faker } from '@faker-js/faker';
import type Blockaid from '@blockaid/client';

const mockBlockaidClient = {
  evm: {
    jsonRpc: {
      scan: jest.fn(),
    },
  },
} as jest.MockedObjectDeep<Blockaid>;

describe('BlockaidApi', () => {
  let service: BlockaidApi;

  beforeEach(() => {
    jest.resetAllMocks();

    service = new BlockaidApi();
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
    const stateOverride = {
      [safeAddress]: {
        stateDiff: {
          [GUARD_STORAGE_POSITION]:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
        },
      },
    };

    it('should call blockaid client with correct parameters', async () => {
      const origin = faker.internet.url();

      const mockScanResponse: TransactionScanResponse = {
        block: faker.string.numeric(),
        chain: `0x${chainId}`,
        request_id: faker.string.uuid(),
        status: 'Success',
      } as TransactionScanResponse;

      mockBlockaidClient.evm.jsonRpc.scan.mockResolvedValue(mockScanResponse);

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
        state_override: stateOverride,
      });

      expect(result).toEqual(mockScanResponse);
    });

    it('should call blockaid client without domain parameter/ with non_dapp', async () => {
      const mockScanResponse: TransactionScanResponse = {
        block: faker.string.numeric(),
        chain: `0x${chainId}`,
        request_id: faker.string.uuid(),
        status: 'Success',
      } as TransactionScanResponse;

      mockBlockaidClient.evm.jsonRpc.scan.mockResolvedValue(mockScanResponse);

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
        state_override: stateOverride,
      });

      expect(result).toEqual(mockScanResponse);
    });

    it('should forward errors from blockaid client', async () => {
      const error = new Error('Blockaid API error');
      mockBlockaidClient.evm.jsonRpc.scan.mockRejectedValue(error);

      await expect(
        service.scanTransaction(chainId, safeAddress, walletAddress, message),
      ).rejects.toThrow('Blockaid API error');
    });
  });
});
