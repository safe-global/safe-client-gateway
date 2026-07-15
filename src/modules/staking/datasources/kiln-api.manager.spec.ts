// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';
import type { MockedObject } from 'vitest';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { EarnApiManager } from '@/modules/earn/datasources/earn-api.manager';
import { KilnApi } from '@/modules/staking/datasources/kiln-api.service';
import { StakingApiManager } from '@/modules/staking/datasources/staking-api.manager';
import { rawify } from '@/validation/entities/raw.entity';

const configurationService = {
  getOrThrow: vi.fn(),
} as MockedObject<IConfigurationService>;

const configApi = {
  getChain: vi.fn(),
} as MockedObject<IConfigApi>;

const dataSource = {
  get: vi.fn(),
} as MockedObject<CacheFirstDataSource>;

const cacheService = {} as MockedObject<ICacheService>;

const httpErrorFactory = {} as MockedObject<HttpErrorFactory>;

describe('KilnApiManager', () => {
  let stakingApiManager: StakingApiManager;
  let earnApiManager: EarnApiManager;

  const mainnetBaseUri = faker.internet.url({ appendSlash: false });
  const mainnetApiKey = faker.string.hexadecimal({ length: 32 });
  const testnetBaseUri = faker.internet.url({ appendSlash: false });
  const testnetApiKey = faker.string.hexadecimal({ length: 32 });

  function mockConfig(widget: 'staking' | 'earn'): void {
    configurationService.getOrThrow.mockImplementation((key) => {
      if (key === `${widget}.mainnet.baseUri`) return mainnetBaseUri;
      if (key === `${widget}.mainnet.apiKey`) return mainnetApiKey;
      if (key === `${widget}.testnet.baseUri`) return testnetBaseUri;
      if (key === `${widget}.testnet.apiKey`) return testnetApiKey;
      if (key === 'expirationTimeInSeconds.staking') return faker.number.int();
      if (key === 'expirationTimeInSeconds.notFound.default')
        return faker.number.int();

      throw new Error(`Unexpected key: ${key}`);
    });
  }

  beforeEach(async () => {
    vi.resetAllMocks();

    // Instantiate through Nest to cover the constructor being inherited
    // from the abstract KilnApiManager, as the modules provide these
    // classes via dependency injection.
    const moduleRef = await Test.createTestingModule({
      providers: [
        StakingApiManager,
        EarnApiManager,
        { provide: CacheFirstDataSource, useValue: dataSource },
        { provide: IConfigurationService, useValue: configurationService },
        { provide: IConfigApi, useValue: configApi },
        { provide: HttpErrorFactory, useValue: httpErrorFactory },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    stakingApiManager = moduleRef.get(StakingApiManager);
    earnApiManager = moduleRef.get(EarnApiManager);
  });

  it.each([
    ['staking', false],
    ['staking', true],
    ['earn', false],
    ['earn', true],
  ] as const)('should create a KilnApi from the %s configuration (testnet: %s)', async (widget, isTestnet) => {
    const target = { staking: stakingApiManager, earn: earnApiManager }[widget];
    const env = isTestnet ? 'testnet' : 'mainnet';
    const chain = chainBuilder().with('isTestnet', isTestnet).build();
    configApi.getChain.mockResolvedValue(rawify(chain));
    mockConfig(widget);

    const api = await target.getApi(chain.chainId);

    expect(api).toBeInstanceOf(KilnApi);
    expect(configurationService.getOrThrow).toHaveBeenCalledWith(
      `${widget}.${env}.baseUri`,
    );
    expect(configurationService.getOrThrow).toHaveBeenCalledWith(
      `${widget}.${env}.apiKey`,
    );
  });

  it('should cache the KilnApi instance per chain', async () => {
    const chain = chainBuilder().with('isTestnet', false).build();
    configApi.getChain.mockResolvedValue(rawify(chain));
    mockConfig('staking');

    const first = await stakingApiManager.getApi(chain.chainId);
    const second = await stakingApiManager.getApi(chain.chainId);

    expect(second).toBe(first);
    expect(configApi.getChain).toHaveBeenCalledTimes(1);
  });

  it('should create a new KilnApi instance after destruction', async () => {
    const chain = chainBuilder().with('isTestnet', false).build();
    configApi.getChain.mockResolvedValue(rawify(chain));
    mockConfig('staking');

    const first = await stakingApiManager.getApi(chain.chainId);
    stakingApiManager.destroyApi(chain.chainId);
    const second = await stakingApiManager.getApi(chain.chainId);

    expect(second).not.toBe(first);
    expect(configApi.getChain).toHaveBeenCalledTimes(2);
  });
});
