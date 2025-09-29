import { ContractAnalysisService } from '@/modules/safe-shield/contract-analysis/contract-analysis.service';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IDataDecoderApi } from '@/domain/interfaces/data-decoder-api.interface';
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
import { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';

const mockDataDecoderApi = {
  getContracts: jest.fn(),
} as jest.MockedObjectDeep<IDataDecoderApi>;

const mockConfigurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;

const mockLoggingService = {
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('ContractAnalysisService', () => {
  let service: ContractAnalysisService;
  let fakeCacheService: FakeCacheService;

  beforeEach(() => {
    fakeCacheService = new FakeCacheService();
    const erc20Decoder = new Erc20Decoder();

    service = new ContractAnalysisService(
      mockDataDecoderApi,
      erc20Decoder,
      fakeCacheService,
      mockConfigurationService,
      mockLoggingService,
    );

    mockConfigurationService.getOrThrow.mockReturnValue(3600);
  });

  afterEach(() => {
    jest.clearAllMocks();
    fakeCacheService.clear();
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
        description: DESCRIPTION_MAPPING.VERIFIED({ name: name }),
      });
    });
  });
});
