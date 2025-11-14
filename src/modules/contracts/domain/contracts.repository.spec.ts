import type { IConfigurationService } from '@/config/configuration.service.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { SAFE_TRANSACTION_SERVICE_MAX_LIMIT as LIMIT } from '@/domain/common/constants';
import { ContractsRepository } from '@/modules/contracts/domain/contracts.repository';
import { contractBuilder } from '@/modules/data-decoder/domain/v2/entities/__tests__/contract.builder';
import {
  limitAndOffsetUrlFactory,
  pageBuilder,
} from '@/domain/entities/__tests__/page.builder';
import type { IDataDecoderApi } from '@/domain/interfaces/data-decoder-api.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';

const mockLoggingService = {
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;
const mockDataDecoderApi = {
  getContracts: jest.fn(),
  getTrustedForDelegateCallContracts: jest.fn(),
} as jest.MockedObjectDeep<IDataDecoderApi>;
const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

describe('ContractsRepository', () => {
  let target: ContractsRepository;
  const maxSequentialPages = 3;

  function initTarget(args: { trustedList: boolean }): void {
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'contracts.trustedForDelegateCall.maxSequentialPages')
        return maxSequentialPages;
      if (key === 'features.trustedForDelegateCallContractsList')
        return args.trustedList;
    });

    target = new ContractsRepository(
      mockDataDecoderApi,
      mockConfigurationService,
      mockLoggingService,
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();
    initTarget({ trustedList: false });
  });

  describe('trustedForDelegateCallContractsList disabled', () => {
    it('should return false if the contract is not trusted for delegate call', async () => {
      const chain = chainBuilder().build();
      const contract = contractBuilder()
        .with('trustedForDelegateCall', false)
        .build();
      const contractPage = pageBuilder().with('results', [contract]).build();

      mockDataDecoderApi.getContracts.mockResolvedValue(rawify(contractPage));

      const actual = await target.isTrustedForDelegateCall({
        chainId: chain.chainId,
        contractAddress: contract.address,
      });

      expect(actual).toBe(false);
      expect(mockDataDecoderApi.getContracts).toHaveBeenCalledTimes(1);
      expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
        address: contract.address,
        chainId: chain.chainId,
      });
      expect(
        mockDataDecoderApi.getTrustedForDelegateCallContracts,
      ).not.toHaveBeenCalled();
    });

    it('should return true if the contract is trusted for delegate call', async () => {
      const chain = chainBuilder().build();
      const contract = contractBuilder()
        .with('trustedForDelegateCall', true)
        .build();
      const contractPage = pageBuilder().with('results', [contract]).build();

      mockDataDecoderApi.getContracts.mockResolvedValue(rawify(contractPage));

      const actual = await target.isTrustedForDelegateCall({
        chainId: chain.chainId,
        contractAddress: contract.address,
      });

      expect(actual).toBe(true);
      expect(mockDataDecoderApi.getContracts).toHaveBeenCalledTimes(1);
      expect(mockDataDecoderApi.getContracts).toHaveBeenCalledWith({
        address: contract.address,
        chainId: chain.chainId,
      });
      expect(
        mockDataDecoderApi.getTrustedForDelegateCallContracts,
      ).not.toHaveBeenCalled();
    });
  });

  describe('trustedForDelegateCallContractsList enabled', () => {
    it('should return false if the contract is not in the list of trusted for delegate call contracts', async () => {
      initTarget({ trustedList: true });
      const chain = chainBuilder().build();
      const contracts = faker.helpers.multiple(
        () => contractBuilder().with('trustedForDelegateCall', true).build(),
        {
          count: 10,
        },
      );
      const contractPage = pageBuilder().with('results', contracts).build();
      mockDataDecoderApi.getTrustedForDelegateCallContracts.mockResolvedValue(
        rawify(contractPage),
      );

      const actual = await target.isTrustedForDelegateCall({
        chainId: chain.chainId,
        contractAddress: getAddress(faker.finance.ethereumAddress()),
      });

      expect(actual).toBe(false);
    });

    it('should return true if the contract is in the list of trusted for delegate call contracts', async () => {
      initTarget({ trustedList: true });
      const chain = chainBuilder().build();
      const contracts = faker.helpers.multiple(
        () => contractBuilder().with('trustedForDelegateCall', true).build(),
        {
          count: LIMIT,
        },
      );
      const contractPage = pageBuilder().with('results', contracts).build();
      mockDataDecoderApi.getTrustedForDelegateCallContracts.mockResolvedValue(
        rawify(contractPage),
      );

      const actual = await target.isTrustedForDelegateCall({
        chainId: chain.chainId,
        contractAddress: faker.helpers.arrayElement(contracts).address,
      });

      expect(actual).toBe(true);
    });

    it('should iterate over the complete list of trusted for delegate call contracts', async () => {
      initTarget({ trustedList: true });
      const chain = chainBuilder().build();
      const contracts = faker.helpers.multiple(
        () => contractBuilder().with('trustedForDelegateCall', true).build(),
        {
          count: LIMIT,
        },
      );
      mockDataDecoderApi.getTrustedForDelegateCallContracts.mockResolvedValueOnce(
        rawify(
          pageBuilder()
            .with('results', contracts)
            .with('next', limitAndOffsetUrlFactory(LIMIT, LIMIT))
            .build(),
        ),
      );
      mockDataDecoderApi.getTrustedForDelegateCallContracts.mockResolvedValueOnce(
        rawify(
          pageBuilder().with('results', contracts).with('next', null).build(),
        ),
      );

      const actual = await target.isTrustedForDelegateCall({
        chainId: chain.chainId,
        contractAddress: faker.helpers.arrayElement(contracts).address,
      });

      expect(actual).toBe(true);
      expect(
        mockDataDecoderApi.getTrustedForDelegateCallContracts,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockDataDecoderApi.getTrustedForDelegateCallContracts,
      ).toHaveBeenNthCalledWith(1, {
        chainId: chain.chainId,
        limit: LIMIT,
        offset: 0,
      });
      expect(
        mockDataDecoderApi.getTrustedForDelegateCallContracts,
      ).toHaveBeenNthCalledWith(2, {
        chainId: chain.chainId,
        limit: LIMIT,
        offset: LIMIT,
      });
      expect(mockLoggingService.error).not.toHaveBeenCalled();
    });

    it('should iterate over the complete list of trusted for delegate call contracts until maxSequentialPages', async () => {
      initTarget({ trustedList: true });
      const chain = chainBuilder().build();
      const contracts = faker.helpers.multiple(
        () => contractBuilder().with('trustedForDelegateCall', true).build(),
        {
          count: LIMIT,
        },
      );

      mockDataDecoderApi.getTrustedForDelegateCallContracts.mockResolvedValueOnce(
        rawify(
          pageBuilder()
            .with('results', contracts)
            .with('next', limitAndOffsetUrlFactory(LIMIT, LIMIT))
            .build(),
        ),
      );
      mockDataDecoderApi.getTrustedForDelegateCallContracts.mockResolvedValueOnce(
        rawify(
          pageBuilder()
            .with('results', contracts)
            .with('next', limitAndOffsetUrlFactory(LIMIT, LIMIT * 2))
            .build(),
        ),
      );
      mockDataDecoderApi.getTrustedForDelegateCallContracts.mockResolvedValueOnce(
        rawify(
          pageBuilder()
            .with('results', contracts)
            .with('next', limitAndOffsetUrlFactory(LIMIT, LIMIT * 3))
            .build(),
        ),
      );

      const actual = await target.isTrustedForDelegateCall({
        chainId: chain.chainId,
        contractAddress: faker.helpers.arrayElement(contracts).address,
      });

      expect(actual).toBe(true);
      expect(
        mockDataDecoderApi.getTrustedForDelegateCallContracts,
      ).toHaveBeenCalledTimes(maxSequentialPages);
      expect(
        mockDataDecoderApi.getTrustedForDelegateCallContracts,
      ).toHaveBeenNthCalledWith(1, {
        chainId: chain.chainId,
        limit: LIMIT,
        offset: 0,
      });
      expect(
        mockDataDecoderApi.getTrustedForDelegateCallContracts,
      ).toHaveBeenNthCalledWith(2, {
        chainId: chain.chainId,
        limit: LIMIT,
        offset: LIMIT,
      });
      expect(
        mockDataDecoderApi.getTrustedForDelegateCallContracts,
      ).toHaveBeenNthCalledWith(3, {
        chainId: chain.chainId,
        limit: LIMIT,
        offset: LIMIT * 2,
      });
      expect(mockLoggingService.error).toHaveBeenCalledWith({
        chainId: chain.chainId,
        message: 'Max sequential pages reached',
        next: expect.any(String),
      });
    });
  });
});
