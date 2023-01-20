import { faker } from '@faker-js/faker';
import { safeAppBuilder } from '../../../../domain/safe-apps/entities/__tests__/safe-app.builder';
import { SafeAppsRepository } from '../../../../domain/safe-apps/safe-apps.repository';
import { multisigTransactionBuilder } from '../../../../domain/safe/entities/__tests__/multisig-transaction.builder';
import { SafeAppInfo } from '../../entities/safe-app-info.entity';
import { SafeAppInfoMapper } from './safe-app-info.mapper';

describe('SafeAppInfo mapper (Unit)', () => {
  const safeAppsRepositoryMock = jest.mocked({
    getSafeApps: jest.fn(),
  } as unknown as SafeAppsRepository);

  const mapper = new SafeAppInfoMapper(safeAppsRepositoryMock);

  beforeEach(async () => {
    jest.clearAllMocks();
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

  it('should get SafeAppInfo for a transaction with origin', async () => {
    const chainId = faker.random.numeric();
    const safeApp = safeAppBuilder().build();
    const anotherSafeApp = safeAppBuilder().build();
    const safeApps = [safeApp, anotherSafeApp];
    const transaction = multisigTransactionBuilder()
      .with(
        'origin',
        `{\"url\": \"${safeApp.url}\", \"name\": \"$SAFE Claiming App\"}`,
      )
      .build();
    safeAppsRepositoryMock.getSafeApps.mockResolvedValue(safeApps);
    const expected = new SafeAppInfo(
      safeApp.name,
      safeApp.url,
      safeApp.iconUrl,
    );

    const actual = await mapper.mapSafeAppInfo(chainId, transaction);

    expect(actual).toEqual(expected);
  });

  it('should return null if no SafeApp is found and origin is not null', async () => {
    const chainId = faker.random.numeric();
    const safeApps = [];
    const transaction = multisigTransactionBuilder()
      .with(
        'origin',
        `{\"url\": \"${faker.internet.url()}\", \"name\": \"$SAFE Claiming App\"}`,
      )
      .build();
    safeAppsRepositoryMock.getSafeApps.mockResolvedValue(safeApps);

    const actual = await mapper.mapSafeAppInfo(chainId, transaction);

    expect(actual).toBeNull();
  });
});
