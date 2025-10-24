import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { AssetRegistryService } from '@/domain/common/services/asset-registry.service';
import type { IAssetRepository } from '@/datasources/db/asset.repository';
import { AssetRepository } from '@/datasources/db/asset.repository';
import type { ILoggingService } from '@/logging/logging.interface';
import { LoggingService } from '@/logging/logging.interface';
import type { Asset } from '@/datasources/db/entities/asset.entity.db';

describe('AssetRegistryService', () => {
  let service: AssetRegistryService;
  let mockAssetRepository: jest.Mocked<IAssetRepository>;
  let mockLoggingService: jest.Mocked<ILoggingService>;

  beforeEach(async () => {
    mockAssetRepository = {
      upsert: jest.fn().mockResolvedValue({
        id: 1,
        assetId: 'test',
        symbol: 'TEST',
        name: 'Test Token',
        isCanonical: true,
        providerIds: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findByAssetId: jest.fn(),
      findByZerionId: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
    };

    mockLoggingService = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetRegistryService,
        {
          provide: AssetRepository,
          useValue: mockAssetRepository,
        },
        {
          provide: LoggingService,
          useValue: mockLoggingService,
        },
      ],
    }).compile();

    service = module.get<AssetRegistryService>(AssetRegistryService);
  });

  describe('onModuleInit', () => {
    it('should load existing assets from database', async () => {
      const mockAssets: Array<Asset> = [
        {
          id: 1,
          assetId: 'eth',
          symbol: 'ETH',
          name: 'Ethereum',
          isCanonical: true,
          providerIds: { zerion: 'eth' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          assetId: 'dai',
          symbol: 'DAI',
          name: 'Dai Stablecoin',
          isCanonical: true,
          providerIds: { zerion: '0x6b17...' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockAssetRepository.findAll.mockResolvedValue(mockAssets);

      await service.onModuleInit();

      expect(mockAssetRepository.findAll).toHaveBeenCalledTimes(1);
      expect(mockLoggingService.info).toHaveBeenCalledWith(
        'AssetRegistryService initialized with 2 assets',
      );

      // Verify assets are loaded into memory
      expect(service.hasAsset('eth')).toBe(true);
      expect(service.hasAsset('dai')).toBe(true);
      expect(service.getZerionFungibleId('eth')).toBe('eth');
      expect(service.getZerionFungibleId('dai')).toBe('0x6b17...');
    });

    it('should handle database errors gracefully', async () => {
      const error = new Error('Database connection failed');
      mockAssetRepository.findAll.mockRejectedValue(error);

      await service.onModuleInit();

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        `Failed to load assets from database: ${error}`,
      );
    });

    it('should initialize with empty cache when no assets exist', async () => {
      mockAssetRepository.findAll.mockResolvedValue([]);

      await service.onModuleInit();

      expect(service.getAllAssets()).toEqual([]);
      expect(mockLoggingService.info).toHaveBeenCalledWith(
        'AssetRegistryService initialized with 0 assets',
      );
    });
  });

  describe('registerFromZerion', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should register new asset with canonical slug', () => {
      const assetId = service.registerFromZerion({
        symbol: 'ETH',
        name: 'Ethereum',
        chain: 'ethereum',
        address: null,
        zerionFungibleId: 'eth',
      });

      expect(assetId).toBe('eth');
      expect(service.hasAsset('eth')).toBe(true);
      expect(service.getZerionFungibleId('eth')).toBe('eth');
    });

    it('should return existing asset ID if already registered', () => {
      const assetId1 = service.registerFromZerion({
        symbol: 'ETH',
        name: 'Ethereum',
        chain: 'ethereum',
        address: null,
        zerionFungibleId: 'eth',
      });

      const assetId2 = service.registerFromZerion({
        symbol: 'ETH',
        name: 'Ethereum',
        chain: 'ethereum',
        address: null,
        zerionFungibleId: 'eth',
      });

      expect(assetId1).toBe(assetId2);
      expect(assetId1).toBe('eth');
    });

    it('should add address suffix for collision', () => {
      // Register first WETH
      const weth1 = service.registerFromZerion({
        symbol: 'WETH',
        name: 'Wrapped Ether',
        chain: 'ethereum',
        address: null,
        zerionFungibleId: 'weth-canonical',
      });

      // Register second WETH with different fungible ID
      const weth2 = service.registerFromZerion({
        symbol: 'WETH',
        name: 'Wrapped Ether',
        chain: 'ethereum',
        address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        zerionFungibleId: 'weth-other',
      });

      expect(weth1).toBe('weth');
      expect(weth2).toBe('weth-c02a');
      expect(service.getZerionFungibleId('weth')).toBe('weth-canonical');
      expect(service.getZerionFungibleId('weth-c02a')).toBe('weth-other');
    });

    it('should persist asset to database asynchronously', async () => {
      mockAssetRepository.upsert.mockResolvedValue({
        id: 1,
        assetId: 'dai',
        symbol: 'DAI',
        name: 'Dai Stablecoin',
        isCanonical: true,
        providerIds: { zerion: '0x6b17...' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const assetId = service.registerFromZerion({
        symbol: 'DAI',
        name: 'Dai Stablecoin',
        chain: 'ethereum',
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        zerionFungibleId: '0x6b17...',
      });

      expect(assetId).toBe('dai');

      // Wait for async upsert
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockAssetRepository.upsert).toHaveBeenCalledWith({
        assetId: 'dai',
        symbol: 'DAI',
        name: 'Dai Stablecoin',
        isCanonical: true,
        providerIds: { zerion: '0x6b17...' },
      });
    });

    it('should mark non-canonical assets correctly', () => {
      // First registration is canonical
      service.registerFromZerion({
        symbol: 'USDC',
        name: 'USD Coin',
        chain: 'ethereum',
        address: null,
        zerionFungibleId: 'usdc-canonical',
      });

      // Second registration with address suffix is not canonical
      service.registerFromZerion({
        symbol: 'USDC',
        name: 'USD Coin (Bridged)',
        chain: 'polygon',
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        zerionFungibleId: 'usdc-polygon',
      });

      const metadata1 = service.getAssetMetadata('usdc');
      const metadata2 = service.getAssetMetadata('usdc-a0b8');

      expect(metadata1?.isCanonical).toBe(true);
      expect(metadata2?.isCanonical).toBe(false);
    });
  });

  describe('getZerionFungibleId', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should return Zerion fungible ID for registered asset', () => {
      service.registerFromZerion({
        symbol: 'ETH',
        name: 'Ethereum',
        chain: 'ethereum',
        address: null,
        zerionFungibleId: 'eth',
      });

      expect(service.getZerionFungibleId('eth')).toBe('eth');
    });

    it('should return null for non-existent asset', () => {
      expect(service.getZerionFungibleId('nonexistent')).toBeNull();
    });
  });

  describe('getAssetIdFromZerion', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should return asset ID for registered Zerion fungible ID', () => {
      service.registerFromZerion({
        symbol: 'DAI',
        name: 'Dai Stablecoin',
        chain: 'ethereum',
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        zerionFungibleId: '0x6b17...',
      });

      expect(service.getAssetIdFromZerion('0x6b17...')).toBe('dai');
    });

    it('should return null for non-existent Zerion fungible ID', () => {
      expect(service.getAssetIdFromZerion('nonexistent')).toBeNull();
    });
  });

  describe('getAssetMetadata', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should return metadata for registered asset', () => {
      service.registerFromZerion({
        symbol: 'MORPHO',
        name: 'Morpho Token',
        chain: 'ethereum',
        address: '0x58D97B57BB95320F9a05dC918Aef65434969c2B2',
        zerionFungibleId: 'morpho',
      });

      const metadata = service.getAssetMetadata('morpho');

      expect(metadata).toEqual({
        assetId: 'morpho',
        symbol: 'MORPHO',
        name: 'Morpho Token',
        isCanonical: true,
        providerIds: { zerion: 'morpho' },
      });
    });

    it('should return null for non-existent asset', () => {
      expect(service.getAssetMetadata('nonexistent')).toBeNull();
    });
  });

  describe('hasAsset', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should return true for registered asset', () => {
      service.registerFromZerion({
        symbol: 'ETH',
        name: 'Ethereum',
        chain: 'ethereum',
        address: null,
        zerionFungibleId: 'eth',
      });

      expect(service.hasAsset('eth')).toBe(true);
    });

    it('should return false for non-existent asset', () => {
      expect(service.hasAsset('nonexistent')).toBe(false);
    });
  });

  describe('getAllAssets', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should return all registered assets', () => {
      service.registerFromZerion({
        symbol: 'ETH',
        name: 'Ethereum',
        chain: 'ethereum',
        address: null,
        zerionFungibleId: 'eth',
      });

      service.registerFromZerion({
        symbol: 'DAI',
        name: 'Dai Stablecoin',
        chain: 'ethereum',
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        zerionFungibleId: '0x6b17...',
      });

      const assets = service.getAllAssets();

      expect(assets).toHaveLength(2);
      expect(assets.map((a) => a.assetId)).toContain('eth');
      expect(assets.map((a) => a.assetId)).toContain('dai');
    });

    it('should return empty array when no assets registered', () => {
      expect(service.getAllAssets()).toEqual([]);
    });
  });
});
