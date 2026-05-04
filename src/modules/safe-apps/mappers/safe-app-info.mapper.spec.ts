// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { ILoggingService } from '@/logging/logging.interface';
import { multisigTransactionBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeAppBuilder } from '@/modules/safe-apps/domain/entities/__tests__/safe-app.builder';
import type { SafeApp } from '@/modules/safe-apps/domain/entities/safe-app.entity';
import type { SafeAppsRepository } from '@/modules/safe-apps/domain/safe-apps.repository';
import { SafeAppInfo } from '@/modules/transactions/routes/entities/safe-app-info.entity';
import { SafeAppInfoMapper } from '@/modules/safe-apps/mappers/safe-app-info.mapper';

describe('SafeAppInfo mapper (Unit)', () => {
  const safeAppsRepositoryMock = jest.mocked({
    getSafeApps: jest.fn(),
  } as jest.MockedObjectDeep<SafeAppsRepository>);

  const mockLoggingService: jest.MockedObjectDeep<ILoggingService> = {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  let mapper: SafeAppInfoMapper;

  beforeEach(() => {
    jest.resetAllMocks();
    mapper = new SafeAppInfoMapper(safeAppsRepositoryMock, mockLoggingService);
  });

  it('should get a null SafeAppInfo when origin is null', async () => {
    const chainId = faker.string.numeric();
    const safeTxHash = faker.string.hexadecimal({ length: 64 });
    const safeApps = [safeAppBuilder().build(), safeAppBuilder().build()];
    safeAppsRepositoryMock.getSafeApps.mockResolvedValue(safeApps);

    const actual = await mapper.mapSafeAppInfo(chainId, null, safeTxHash);

    expect(actual).toBeNull();
    expect(safeAppsRepositoryMock.getSafeApps).toHaveBeenCalledTimes(0);
  });

  it('should get a null SafeAppInfo when origin has no url', async () => {
    const chainId = faker.string.numeric();
    const safeTxHash = faker.string.hexadecimal({ length: 64 });
    const origin = `{ "${faker.word.sample()}": "${faker.word.sample()}" }`;
    const safeApps = [safeAppBuilder().build(), safeAppBuilder().build()];
    safeAppsRepositoryMock.getSafeApps.mockResolvedValue(safeApps);

    const actual = await mapper.mapSafeAppInfo(chainId, origin, safeTxHash);

    expect(actual).toBeNull();
    expect(safeAppsRepositoryMock.getSafeApps).toHaveBeenCalledTimes(0);
    expect(mockLoggingService.debug).toHaveBeenCalledWith(
      `Safe TX Hash ${safeTxHash} origin produced no URL. origin=${origin}`,
    );
  });

  it('should return null if no SafeApp is found and origin is not null', async () => {
    const chainId = faker.string.numeric();
    const safeTxHash = faker.string.hexadecimal({ length: 64 });
    const safeApps: Array<SafeApp> = [];
    const originPayload = {
      url: faker.internet.url({ appendSlash: false }),
      name: faker.word.words(),
    };
    const origin = JSON.stringify(originPayload);
    safeAppsRepositoryMock.getSafeApps.mockResolvedValue(safeApps);

    const actual = await mapper.mapSafeAppInfo(chainId, origin, safeTxHash);

    expect(actual).toBeNull();
    expect(safeAppsRepositoryMock.getSafeApps).toHaveBeenCalledTimes(1);
    expect(safeAppsRepositoryMock.getSafeApps).toHaveBeenCalledWith({
      chainId,
      onlyListed: false,
      url: originPayload.url,
    });
    expect(mockLoggingService.info).toHaveBeenCalledWith(
      `No Safe Apps matching the origin url ${originPayload.url} (safeTxHash: ${safeTxHash})`,
    );
  });

  it('should return SafeAppInfo (including id) when origin matches a SafeApp', async () => {
    const chainId = faker.string.numeric();
    const safeTxHash = faker.string.hexadecimal({ length: 64 });
    const safeApp = safeAppBuilder().build();
    const anotherSafeApp = safeAppBuilder().build();
    const safeApps = [safeApp, anotherSafeApp];
    const originPayload = {
      url: faker.internet.url({ appendSlash: false }),
      name: faker.word.words(),
    };
    const origin = JSON.stringify(originPayload);
    safeAppsRepositoryMock.getSafeApps.mockResolvedValue(safeApps);
    const expected = new SafeAppInfo(
      safeApp.id,
      safeApp.name,
      safeApp.url,
      safeApp.iconUrl,
    );

    const actual = await mapper.mapSafeAppInfo(chainId, origin, safeTxHash);

    expect(actual).toEqual(expected);
    expect(actual?.id).toBe(safeApp.id);
    expect(safeAppsRepositoryMock.getSafeApps).toHaveBeenCalledTimes(1);
    expect(safeAppsRepositoryMock.getSafeApps).toHaveBeenCalledWith({
      chainId,
      onlyListed: false,
      url: originPayload.url,
    });
  });

  it('should return null and log debug on invalid JSON origin', async () => {
    const chainId = faker.string.numeric();
    const safeTxHash = faker.string.hexadecimal({ length: 64 });
    const origin = faker.string.sample();

    const actual = await mapper.mapSafeAppInfo(chainId, origin, safeTxHash);

    expect(actual).toBeNull();
    expect(safeAppsRepositoryMock.getSafeApps).toHaveBeenCalledTimes(0);
    expect(mockLoggingService.debug).toHaveBeenCalledWith(
      `Safe TX Hash ${safeTxHash} origin produced no URL. origin=${origin}`,
    );
  });

  it('should replace IPFS origin urls', async () => {
    const chainId = faker.string.numeric();
    const safeTxHash = faker.string.hexadecimal({ length: 64 });
    const safeAppUrl = 'https://ipfs.io/test';
    const safeApp = safeAppBuilder().with('url', safeAppUrl).build();
    const safeApps = [safeApp];
    const expectedUrl = 'https://cloudflare-ipfs.com/test';
    const originPayload = {
      url: faker.internet.url({ appendSlash: false }),
      name: faker.word.words(),
    };
    const origin = JSON.stringify(originPayload);
    safeAppsRepositoryMock.getSafeApps.mockResolvedValue(safeApps);
    const expected = new SafeAppInfo(
      safeApp.id,
      safeApp.name,
      expectedUrl,
      safeApp.iconUrl,
    );

    const actual = await mapper.mapSafeAppInfo(chainId, origin, safeTxHash);

    expect(actual).toEqual(expected);
    expect(safeAppsRepositoryMock.getSafeApps).toHaveBeenCalledTimes(1);
    expect(safeAppsRepositoryMock.getSafeApps).toHaveBeenCalledWith({
      chainId,
      onlyListed: false,
      url: originPayload.url,
    });
  });
});
