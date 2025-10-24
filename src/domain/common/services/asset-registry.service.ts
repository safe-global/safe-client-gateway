import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  AssetRepository,
  IAssetRepository,
} from '@/datasources/db/asset.repository';
import {
  AssetMetadata,
  createAssetId,
} from '@/domain/common/entities/asset-identifier.entity';

/**
 * AssetRegistryService provides a unified abstraction layer for asset identification
 * across multiple data providers (Zerion, Zapper, etc).
 *
 * Key features:
 * - Human-readable asset IDs (dai, eth, morpho) instead of provider-specific IDs
 * - In-memory cache for fast lookups
 * - Async non-blocking database persistence
 * - Automatic collision handling for duplicate symbols
 * - Preloaded from database on startup for consistency
 */
@Injectable()
export class AssetRegistryService implements OnModuleInit {
  // Primary cache: assetId -> metadata
  private memoryCache = new Map<string, AssetMetadata>();

  // Secondary index: zerionId -> assetId for reverse lookups
  private zerionIndex = new Map<string, string>();

  // Track all used asset IDs for collision detection
  private usedAssetIds = new Set<string>();

  constructor(
    @Inject(AssetRepository)
    private readonly assetRepository: IAssetRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Load existing assets from database into memory on startup
   */
  async onModuleInit(): Promise<void> {
    try {
      const assets = await this.assetRepository.findAll();

      for (const asset of assets) {
        const metadata: AssetMetadata = {
          assetId: asset.assetId,
          symbol: asset.symbol,
          name: asset.name,
          isCanonical: asset.isCanonical,
          providerIds: asset.providerIds,
        };

        this.memoryCache.set(asset.assetId, metadata);
        this.usedAssetIds.add(asset.assetId);

        if (asset.providerIds.zerion) {
          this.zerionIndex.set(asset.providerIds.zerion, asset.assetId);
        }
      }

      this.loggingService.info(
        `AssetRegistryService initialized with ${assets.length} assets`,
      );
    } catch (error) {
      this.loggingService.error(
        `Failed to load assets from database: ${error}`,
      );
    }
  }

  /**
   * Register an asset from Zerion data and return its internal asset ID
   * This method is idempotent - calling it multiple times with the same data
   * will return the same asset ID.
   *
   * @returns Internal asset ID (e.g., "dai", "eth", "weth-c02a")
   */
  registerFromZerion(args: {
    symbol: string;
    name: string;
    chain: string;
    address: string | null;
    zerionFungibleId: string;
  }): string {
    // Check if we already have this Zerion ID registered
    const existingAssetId = this.zerionIndex.get(args.zerionFungibleId);
    if (existingAssetId) {
      return existingAssetId;
    }

    // Generate new asset ID with collision handling
    const assetId = createAssetId(
      args.symbol,
      args.address,
      this.usedAssetIds,
    );

    // Determine if this is canonical (first occurrence of this slug)
    const baseSlug = args.symbol.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isCanonical = assetId === baseSlug;

    const metadata: AssetMetadata = {
      assetId,
      symbol: args.symbol,
      name: args.name,
      isCanonical,
      providerIds: {
        zerion: args.zerionFungibleId,
      },
    };

    // Update in-memory cache
    this.memoryCache.set(assetId, metadata);
    this.zerionIndex.set(args.zerionFungibleId, assetId);
    this.usedAssetIds.add(assetId);

    // Async non-blocking database write
    this.assetRepository
      .upsert({
        assetId: metadata.assetId,
        symbol: metadata.symbol,
        name: metadata.name,
        isCanonical: metadata.isCanonical,
        providerIds: metadata.providerIds,
      })
      .catch((error) => {
        this.loggingService.error(
          `Failed to persist asset ${assetId} to database: ${error}`,
        );
      });

    return assetId;
  }

  /**
   * Register an asset from any provider (fallback when provider-specific ID not available)
   * Uses chain+address as the unique identifier.
   * This method is idempotent - calling it multiple times with the same data
   * will return the same asset ID.
   *
   * @returns Internal asset ID (e.g., "dai", "eth", "weth-c02a")
   */
  register(args: {
    symbol: string;
    name: string;
    chain: string;
    address: string | null;
  }): string {
    // For assets without provider IDs, use chain+address as unique key
    const uniqueKey = args.address
      ? `${args.chain}:${args.address.toLowerCase()}`
      : args.symbol.toLowerCase();

    // Check if we already have this asset registered by checking all existing assets
    for (const [existingAssetId, metadata] of this.memoryCache.entries()) {
      // Try to match by providerIds first (in case it was registered by another provider)
      for (const [provider, providerId] of Object.entries(
        metadata.providerIds,
      )) {
        if (providerId === uniqueKey) {
          return existingAssetId;
        }
      }

      // Also check if the asset was registered with similar symbol+address
      if (
        metadata.symbol.toLowerCase() === args.symbol.toLowerCase() &&
        args.address
      ) {
        // Check if any provider ID contains this address
        for (const providerId of Object.values(metadata.providerIds)) {
          if (providerId.toLowerCase().includes(args.address.toLowerCase())) {
            return existingAssetId;
          }
        }
      }
    }

    // Generate new asset ID with collision handling
    const assetId = createAssetId(
      args.symbol,
      args.address,
      this.usedAssetIds,
    );

    const metadata: AssetMetadata = {
      assetId,
      symbol: args.symbol,
      name: args.name,
      isCanonical: false, // Non-Zerion assets are not canonical
      providerIds: {
        [args.chain]: uniqueKey,
      },
    };

    // Update in-memory cache
    this.memoryCache.set(assetId, metadata);
    this.usedAssetIds.add(assetId);

    // Async non-blocking database write
    this.assetRepository
      .upsert({
        assetId: metadata.assetId,
        symbol: metadata.symbol,
        name: metadata.name,
        isCanonical: metadata.isCanonical,
        providerIds: metadata.providerIds,
      })
      .catch((error) => {
        this.loggingService.error(
          `Failed to persist asset ${assetId} to database: ${error}`,
        );
      });

    return assetId;
  }

  /**
   * Get Zerion fungible ID for a given internal asset ID
   * Used by the charts endpoint to resolve internal IDs to provider IDs
   *
   * @returns Zerion fungible ID or null if not found
   */
  getZerionFungibleId(assetId: string): string | null {
    const metadata = this.memoryCache.get(assetId);
    return metadata?.providerIds.zerion ?? null;
  }

  /**
   * Get asset metadata by internal asset ID
   */
  getAssetMetadata(assetId: string): AssetMetadata | null {
    return this.memoryCache.get(assetId) ?? null;
  }

  /**
   * Get internal asset ID from Zerion fungible ID
   */
  getAssetIdFromZerion(zerionFungibleId: string): string | null {
    return this.zerionIndex.get(zerionFungibleId) ?? null;
  }

  /**
   * Check if an asset ID exists in the registry
   */
  hasAsset(assetId: string): boolean {
    return this.memoryCache.has(assetId);
  }

  /**
   * Get all registered assets
   */
  getAllAssets(): Array<AssetMetadata> {
    return Array.from(this.memoryCache.values());
  }
}
