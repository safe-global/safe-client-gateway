import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import request from 'supertest';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'net';
import { rawify } from '@/validation/entities/raw.entity';
import { createTestModule } from '@/__tests__/testing-module';

describe('Safes Controller Nonces (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string | undefined;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let configurationService: jest.MockedObjectDeep<IConfigurationService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture = await createTestModule();

    configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  it('returns latest transaction nonce + 1 if greater than safe nonce', async () => {
    const chain = chainBuilder().build();
    const safeInfo = safeBuilder().with('nonce', 5).build();
    const multisigTransactions = [
      multisigTransactionBuilder().with('nonce', 6).build(),
    ];
    const multisigTransactionsPage = pageBuilder()
      .with(
        'results',
        multisigTransactions.map((tx) => multisigTransactionToJson(tx)),
      )
      .build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(multisigTransactionsPage),
            status: 200,
          });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}/nonces`)
      .expect(200)
      .expect({
        currentNonce: safeInfo.nonce,
        recommendedNonce: multisigTransactions[0].nonce + 1,
      });
  });

  it('returns safe nonce if greater than latest transaction', async () => {
    const chain = chainBuilder().build();
    const safeInfo = safeBuilder().with('nonce', 10).build();
    const multisigTransactions = [
      multisigTransactionBuilder().with('nonce', 6).build(),
    ];
    const multisigTransactionsPage = pageBuilder()
      .with(
        'results',
        multisigTransactions.map((tx) => multisigTransactionToJson(tx)),
      )
      .build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(multisigTransactionsPage),
            status: 200,
          });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}/nonces`)
      .expect(200)
      .expect({
        currentNonce: safeInfo.nonce,
        recommendedNonce: safeInfo.nonce,
      });
  });

  it('returns safe nonce if there are no transactions', async () => {
    const chain = chainBuilder().build();
    const safeInfo = safeBuilder().build();
    const multisigTransactionsPage = pageBuilder().with('results', []).build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(multisigTransactionsPage),
            status: 200,
          });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}/nonces`)
      .expect(200)
      .expect({
        currentNonce: safeInfo.nonce,
        recommendedNonce: safeInfo.nonce,
      });
  });
});
