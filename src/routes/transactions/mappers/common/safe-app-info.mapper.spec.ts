import { faker } from '@faker-js/faker';
import { safeAppBuilder } from '../../../../domain/safe-apps/entities/__tests__/safe-app.builder';
import { SafeAppsRepository } from '../../../../domain/safe-apps/safe-apps.repository';
import { multisigTransactionBuilder } from '../../../../domain/safe/entities/__tests__/multisig-transaction.builder';
import { ILoggingService } from '../../../../logging/logging.interface';
import { SafeAppInfo } from '../../entities/safe-app-info.entity';
import { SafeAppInfoMapper } from './safe-app-info.mapper';

describe('SafeAppInfo mapper (Unit)', () => {
  const safeAppsRepositoryMock = jest.mocked({
    getSafeApps: jest.fn(),
  } as unknown as SafeAppsRepository);

  const mockLoggingService = {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  } as unknown as ILoggingService;

  let mapper: SafeAppInfoMapper;

  beforeEach(async () => {
    jest.clearAllMocks();
    mapper = new SafeAppInfoMapper(safeAppsRepositoryMock, mockLoggingService);
  });

  it('should get a null SafeAppInfo for a transaction with no origin', async () => {
    const chainId = faker.random.numeric();
    const transaction = multisigTransactionBuilder()
      .with('origin', null)
      .build();
    const safeApps = [safeAppBuilder().build(), safeAppBuilder().build()];
    safeAppsRepositoryMock.getSafeApps.mockResolvedValue(safeApps);

    const actual = await mapper.mapSafeAppInfo(chainId, transaction);

    expect(actual).toBeNull();
  });

  it('should get a null SafeAppInfo for a transaction with no url into origin', async () => {
    const chainId = faker.random.numeric();
    const transaction = multisigTransactionBuilder()
      .with(
        'origin',
        `{ \"${faker.random.word()}\": \"${faker.random.word()}\" }`,
      )
      .build();
    const safeApps = [safeAppBuilder().build(), safeAppBuilder().build()];
    safeAppsRepositoryMock.getSafeApps.mockResolvedValue(safeApps);

    const actual = await mapper.mapSafeAppInfo(chainId, transaction);

    expect(actual).toBeNull();
  });

  it('should return null if no SafeApp is found and origin is not null', async () => {
    const chainId = faker.random.numeric();
    const safeApps = [];
    const transaction = multisigTransactionBuilder().build();
    safeAppsRepositoryMock.getSafeApps.mockResolvedValue(safeApps);

    const actual = await mapper.mapSafeAppInfo(chainId, transaction);

    expect(actual).toBeNull();
  });

  it('should get SafeAppInfo for a transaction with origin', async () => {
    const chainId = faker.random.numeric();
    const safeApp = safeAppBuilder().build();
    const anotherSafeApp = safeAppBuilder().build();
    const safeApps = [safeApp, anotherSafeApp];
    const transaction = multisigTransactionBuilder().build();
    safeAppsRepositoryMock.getSafeApps.mockResolvedValue(safeApps);
    const expected = new SafeAppInfo(
      safeApp.name,
      safeApp.url,
      safeApp.iconUrl,
    );

    const actual = await mapper.mapSafeAppInfo(chainId, transaction);

    expect(actual).toEqual(expected);
  });

  it('should return null origin on invalid JSON', async () => {
    const chainId = faker.random.numeric();
    const transaction = multisigTransactionBuilder()
      .with('origin', faker.datatype.string())
      .build();

    const actual = await mapper.mapSafeAppInfo(chainId, transaction);

    expect(actual).toBeNull();
  });

  it('should replace IPFS origin urls', async () => {
    const chainId = faker.random.numeric();
    const originUrl = 'https://ipfs.io/test';
    const safeApp = safeAppBuilder().with('url', originUrl).build();
    const safeApps = [safeApp];
    const expectedUrl = 'https://cloudflare-ipfs.com/test';
    const transaction = multisigTransactionBuilder().build();
    safeAppsRepositoryMock.getSafeApps.mockResolvedValue(safeApps);
    const expected = new SafeAppInfo(
      safeApp.name,
      expectedUrl,
      safeApp.iconUrl,
    );

    const actual = await mapper.mapSafeAppInfo(chainId, transaction);

    expect(actual).toEqual(expected);
  });
});
