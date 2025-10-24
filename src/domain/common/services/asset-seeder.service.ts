import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { AssetRegistryService } from '@/domain/common/services/asset-registry.service';
import { z } from 'zod';

/**
 * Schema for Zerion fungibles API response
 * https://developers.zerion.io/reference/getfungibles
 */
const ZerionFungibleSchema = z.object({
  id: z.string(),
  attributes: z.object({
    name: z.string(),
    symbol: z.string(),
    implementations: z.array(
      z.object({
        chain_id: z.string(),
        address: z.string().nullish().default(null),
      }),
    ),
  }),
});

const ZerionFungiblesSchema = z.object({
  data: z.array(ZerionFungibleSchema),
});

type ZerionFungible = z.infer<typeof ZerionFungibleSchema>;
type ZerionFungibles = z.infer<typeof ZerionFungiblesSchema>;

/**
 * AssetSeederService preloads the top fungible assets from Zerion
 * into the AssetRegistry on application startup.
 *
 * This ensures:
 * - Consistent asset IDs across service instances
 * - Top assets get canonical slugs (dai, eth, usdc)
 * - Reduced database load for common assets
 */
@Injectable()
export class AssetSeederService implements OnModuleInit {
  private readonly apiKey: string | undefined;
  private readonly baseUri: string;
  private readonly seedOnStartup: boolean;
  private readonly topAssetsCount: number;

  constructor(
    @Inject(NetworkService) private readonly networkService: INetworkService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(AssetRegistryService)
    private readonly assetRegistry: AssetRegistryService,
  ) {
    this.apiKey = this.configurationService.get<string>(
      'balances.providers.zerion.apiKey',
    );
    this.baseUri = this.configurationService.getOrThrow<string>(
      'balances.providers.zerion.baseUri',
    );
    this.seedOnStartup =
      this.configurationService.get<boolean>('assets.seedOnStartup') ?? true;
    this.topAssetsCount =
      this.configurationService.get<number>('assets.topAssetsCount') ?? 100;
  }

  /**
   * Seed top assets on module initialization
   */
  async onModuleInit(): Promise<void> {
    if (!this.seedOnStartup) {
      this.loggingService.info('Asset seeding disabled, skipping');
      return;
    }

    try {
      await this.seedTopAssets();
    } catch (error) {
      // Don't fail startup if seeding fails
      this.loggingService.error(
        `Failed to seed assets on startup: ${error}`,
      );
    }
  }

  /**
   * Fetch and register top assets from Zerion's fungibles API
   */
  async seedTopAssets(): Promise<void> {
    try {
      this.loggingService.info(
        `Seeding top ${this.topAssetsCount} assets from Zerion`,
      );

      const url = `${this.baseUri}/v1/fungibles`;
      const networkRequest: Record<string, unknown> = {
        params: {
          'page[size]': this.topAssetsCount,
          sort: 'market_cap',
        },
      };

      if (this.apiKey) {
        networkRequest.headers = { Authorization: `Basic ${this.apiKey}` };
      }

      const response = await this.networkService.get<ZerionFungibles>({
        url,
        networkRequest,
      });

      const fungibles = ZerionFungiblesSchema.parse(response.data);
      let seededCount = 0;

      for (const fungible of fungibles.data) {
        try {
          this.registerFungible(fungible);
          seededCount++;
        } catch (error) {
          this.loggingService.warn(
            `Failed to seed asset ${fungible.attributes.symbol}: ${error}`,
          );
        }
      }

      this.loggingService.info(
        `Successfully seeded ${seededCount} assets from Zerion`,
      );
    } catch (error) {
      this.loggingService.error(
        `Failed to fetch fungibles from Zerion: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Register a single fungible from Zerion
   * Uses the first implementation for address information
   */
  private registerFungible(fungible: ZerionFungible): void {
    const { symbol, name, implementations } = fungible.attributes;

    if (implementations.length === 0) {
      this.loggingService.warn(
        `Skipping asset ${symbol} - no implementations found`,
      );
      return;
    }

    // Use first implementation for chain and address
    const firstImplementation = implementations[0];

    this.assetRegistry.registerFromZerion({
      symbol,
      name,
      chain: firstImplementation.chain_id,
      address: firstImplementation.address,
      zerionFungibleId: fungible.id,
    });
  }
}
