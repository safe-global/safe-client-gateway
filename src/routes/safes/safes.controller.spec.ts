import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { singletonBuilder } from '@/domain/chains/entities/__tests__/singleton.builder';
import { contractBuilder } from '@/domain/data-decoder/v2/entities/__tests__/contract.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { faker } from '@faker-js/faker';
import {
  erc721TransferBuilder,
  toJson as erc721TransferToJson,
} from '@/domain/safe/entities/__tests__/erc721-transfer.builder';
import {
  moduleTransactionBuilder,
  toJson as moduleTransactionToJson,
} from '@/domain/safe/entities/__tests__/module-transaction.builder';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  messageBuilder,
  toJson as messageToJson,
} from '@/domain/messages/entities/__tests__/message.builder';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { getAddress } from 'viem';
import type { Server } from 'net';
import { rawify } from '@/validation/entities/raw.entity';
import { createTestModule } from '@/__tests__/testing-module';

describe('Safes Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let dataDecoderUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture = await createTestModule();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    dataDecoderUrl = configurationService.getOrThrow('safeDataDecoder.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  it('safe info is correctly serialised', async () => {
    const masterCopyVersion = faker.system.semver();
    const chain = chainBuilder()
      .with('recommendedMasterCopyVersion', masterCopyVersion)
      .build();
    const owner = getAddress(faker.finance.ethereumAddress());
    const singleton = faker.finance.ethereumAddress();
    const singletons = [
      singletonBuilder()
        .with('address', getAddress(singleton))
        .with('version', masterCopyVersion)
        .build(),
    ];
    const singletonInfo = contractBuilder()
      .with('address', getAddress(singletons[0].address))
      .build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const safeInfo = safeBuilder()
      .with('owners', [owner])
      .with('masterCopy', singletons[0].address)
      .with('version', masterCopyVersion)
      .build();

    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();

    const moduleTransactions = pageBuilder()
      .with('results', [
        moduleTransactionToJson(
          moduleTransactionBuilder()
            .with('executionDate', new Date('2073-03-12T12:29:06Z'))
            .build(),
        ),
      ])
      .build();

    const messages = pageBuilder()
      .with('results', [
        messageToJson(
          messageBuilder()
            .with('modified', new Date('2023-03-12T12:29:06Z'))
            .build(),
        ),
      ])
      .build();

    networkService.get.mockImplementation(async ({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(
              pageBuilder()
                .with('results', [
                  erc721TransferToJson(
                    erc721TransferBuilder()
                      .with(
                        'executionDate',
                        new Date('2016-09-19T02:55:04+0000'),
                      )
                      .build(),
                  ),
                ])
                .build(),
            ),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(
              pageBuilder()
                .with('results', [
                  multisigTransactionToJson(
                    multisigTransactionBuilder()
                      .with('modified', new Date('2049-01-30T14:23:07Z'))
                      .build(),
                  ),
                ])
                .build(),
            ),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect({
        address: {
          value: safeInfo.address,
          name: null,
          logoUri: null,
        },
        chainId: chain.chainId,
        nonce: safeInfo.nonce,
        threshold: safeInfo.threshold,
        owners: [
          {
            value: owner,
            name: null,
            logoUri: null,
          },
        ],
        implementation: {
          value: singletonInfo.address,
          name: singletonInfo.displayName,
          logoUri: singletonInfo.logoUrl,
        },
        implementationVersionState: 'UP_TO_DATE',
        collectiblesTag: '1474253704',
        txQueuedTag: '2495629387',
        txHistoryTag: '3256547346',
        messagesTag: '1678624146',
        modules: null,
        fallbackHandler: {
          value: getAddress(fallbackHandlerInfo.address),
          name: fallbackHandlerInfo.displayName,
          logoUri: fallbackHandlerInfo.logoUrl,
        },
        guard: {
          value: getAddress(guardInfo.address),
          name: guardInfo.displayName,
          logoUri: guardInfo.logoUrl,
        },
        version: safeInfo.version,
      });
  });

  it('Version State is UNKNOWN when safe version is null', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .with('version', null)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();

    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(queuedTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          implementationVersionState: 'UNKNOWN',
        }),
      );
  });

  it('Version State is UNKNOWN when safe has an invalid safe version', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .with('version', 'vI.N.V.A.L.I.D')
      .build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();

    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(queuedTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          implementationVersionState: 'UNKNOWN',
        }),
      );
  });

  it('Version State is UNKNOWN when chain has an invalid recommended safe version', async () => {
    const chain = chainBuilder()
      .with('recommendedMasterCopyVersion', 'vI.N.V.A.L.I.D')
      .build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();

    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(queuedTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          implementationVersionState: 'UNKNOWN',
        }),
      );
  });

  it('Version State is UNKNOWN if singleton is not supported', async () => {
    const chain = chainBuilder().build();
    const supportedMasterCopy = faker.finance.ethereumAddress();
    const singletons = [
      singletonBuilder()
        .with('address', getAddress(supportedMasterCopy))
        .build(),
    ];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .build();

    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(queuedTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          implementationVersionState: 'UNKNOWN',
        }),
      );
  });

  it('Version State is OUTDATED if safe version is not recommended', async () => {
    const chain = chainBuilder()
      .with('recommendedMasterCopyVersion', '5.0.0')
      .build();
    const supportedMasterCopy = getAddress(faker.finance.ethereumAddress());
    const singletons = [
      singletonBuilder().with('address', supportedMasterCopy).build(),
    ];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const safeInfo = safeBuilder()
      .with('masterCopy', supportedMasterCopy)
      .with('version', '4.0.0')
      .build();

    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(queuedTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          implementationVersionState: 'OUTDATED',
        }),
      );
  });

  it('txQueuedTag is computed from Multisig transaction with modified date', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();
    const collectibleTransfers = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(async ({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(
              pageBuilder()
                .with('results', [
                  multisigTransactionToJson(
                    multisigTransactionBuilder()
                      .with('modified', new Date('2020-09-18T03:52:02Z'))
                      .build(),
                  ),
                  multisigTransactionToJson(
                    multisigTransactionBuilder()
                      .with('modified', new Date('2020-09-16T03:52:02Z'))
                      .build(),
                  ),
                  multisigTransactionToJson(
                    multisigTransactionBuilder()
                      .with('modified', new Date('2020-09-14T03:52:02Z'))
                      .build(),
                  ),
                ])
                .build(),
            ),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txQueuedTag: '1600401122',
        }),
      );
  });

  it('txQueuedTag is null if there are no Multisig transactions', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();

    const multisigTransactions = pageBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(multisigTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txQueuedTag: null,
        }),
      );
  });

  it('txQueuedTag is null if Multisig transactions throw', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();

    const collectibleTransfers = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.reject({ status: 500 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txQueuedTag: null,
        }),
      );
  });

  it('collectiblesTag is computed from Ethereum transaction with executionDate date', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();

    const multisigTransactions = pageBuilder().build();
    const collectibleTransfers = pageBuilder()
      .with('results', [
        erc721TransferToJson(
          erc721TransferBuilder()
            .with('executionDate', new Date('2020-09-18T03:52:02Z'))
            .build(),
        ),
        erc721TransferToJson(
          erc721TransferBuilder()
            .with('executionDate', new Date('2020-09-16T03:52:02Z'))
            .build(),
        ),
        erc721TransferToJson(
          erc721TransferBuilder()
            .with('executionDate', new Date('2020-09-14T03:52:02Z'))
            .build(),
        ),
      ])
      .build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(multisigTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          collectiblesTag: '1600401122',
        }),
      );
  });

  it('collectiblesTag is null if there are no Ethereum transactions', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .build();

    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();

    const multisigTransactions = pageBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(multisigTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          collectiblesTag: null,
        }),
      );
  });

  it('collectiblesTag is null if Ethereum transactions throw', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();
    const multisigTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.reject({ status: 500 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(multisigTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          collectiblesTag: null,
        }),
      );
  });

  it('txHistoryTag is computed from Multisig transaction with modified date', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();
    const collectibleTransfers = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(async ({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(
              pageBuilder()
                .with('results', [
                  multisigTransactionToJson(
                    multisigTransactionBuilder()
                      .with('modified', new Date('2020-09-18T03:52:02Z'))
                      .build(),
                  ),
                  multisigTransactionToJson(
                    multisigTransactionBuilder()
                      .with('modified', new Date('2020-09-16T03:52:02Z'))
                      .build(),
                  ),
                  multisigTransactionToJson(
                    multisigTransactionBuilder()
                      .with('modified', new Date('2020-09-14T03:52:02Z'))
                      .build(),
                  ),
                ])
                .build(),
            ),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: '1600401122',
        }),
      );
  });

  it('txHistoryTag is computed from Multisig transaction without modified date', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();

    const collectibleTransfers = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(async ({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(
              pageBuilder()
                .with('results', [
                  multisigTransactionToJson(
                    multisigTransactionBuilder()
                      .with('modified', null)
                      .with('submissionDate', new Date('2020-09-17T03:52:02Z'))
                      .build(),
                  ),
                  multisigTransactionToJson(
                    multisigTransactionBuilder()
                      .with('modified', new Date('2020-09-16T03:52:02Z'))
                      .with('submissionDate', new Date('2020-09-16T03:52:02Z'))
                      .build(),
                  ),
                  multisigTransactionToJson(
                    multisigTransactionBuilder()
                      .with('modified', new Date('2020-09-14T03:52:02Z'))
                      .with('submissionDate', new Date('2020-09-14T03:52:02Z'))
                      .build(),
                  ),
                ])
                .build(),
            ),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: '1600314722',
        }),
      );
  });

  it('txHistoryTag is computed from Ethereum transaction', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();

    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(async ({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(
              pageBuilder()
                .with('results', [
                  erc721TransferToJson(
                    erc721TransferBuilder()
                      .with('executionDate', new Date('2020-09-17T03:52:02Z'))
                      .build(),
                  ),
                ])
                .build(),
            ),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(
              pageBuilder()
                .with('results', [
                  multisigTransactionToJson(
                    multisigTransactionBuilder()
                      .with('modified', new Date('2020-09-16T03:52:02Z'))
                      .with('submissionDate', new Date('2020-09-16T03:52:02Z'))
                      .build(),
                  ),
                ])
                .build(),
            ),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: '1600314722',
        }),
      );
  });

  it('txHistoryTag is computed from Module transaction', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();
    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();

    const messages = pageBuilder().build();

    networkService.get.mockImplementation(async ({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(pageBuilder().build()),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(
              pageBuilder()
                .with('results', [
                  multisigTransactionToJson(
                    multisigTransactionBuilder()
                      .with('modified', new Date('2020-09-16T03:52:02Z'))
                      .with('submissionDate', new Date('2020-09-16T03:52:02Z'))
                      .build(),
                  ),
                ])
                .build(),
            ),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(
              pageBuilder()
                .with('results', [
                  moduleTransactionToJson(
                    moduleTransactionBuilder()
                      .with('executionDate', new Date('2020-09-17T03:52:02Z'))
                      .build(),
                  ),
                ])
                .build(),
            ),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: '1600314722',
        }),
      );
  });

  it('txHistoryTag is null if there are no Multisig/Ethereum/Module transactions', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();

    const multisigTransactions = pageBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(multisigTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: null,
        }),
      );
  });

  it('txHistoryTag is computed from Ethereum transaction if Multisig transactions throw', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();
    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();
    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();

    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(
              pageBuilder()
                .with('results', [
                  erc721TransferToJson(
                    erc721TransferBuilder()
                      .with('executionDate', new Date('2020-09-17T03:52:02Z'))
                      .build(),
                  ),
                ])
                .build(),
            ),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.reject({ status: 500 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(pageBuilder().build()),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: '1600314722',
        }),
      );
  });

  it('txHistoryTag is computed from Module transaction if Multisig/Ethereum transactions throw', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();
    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();

    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.reject({ status: 500 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.reject({ status: 500 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(
              pageBuilder()
                .with('results', [
                  moduleTransactionToJson(
                    moduleTransactionBuilder()
                      .with('executionDate', new Date('2020-09-17T03:52:02Z'))
                      .build(),
                  ),
                ])
                .build(),
            ),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: '1600314722',
        }),
      );
  });

  it('txHistoryTag is null if Multisig/Ethereum/Module transactions throw', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();
    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .build();

    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();

    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.reject({ status: 500 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.reject({ status: 500 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.reject({ status: 500 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: null,
        }),
      );
  });

  it('messagesTag is the latest modified timestamp', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();

    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();

    const messages = pageBuilder()
      .with('results', [
        messageToJson(
          messageBuilder()
            .with('modified', new Date('2023-03-12T12:29:06Z'))
            .build(),
        ),
        messageToJson(
          messageBuilder()
            .with('modified', new Date('2023-07-12T12:29:06Z'))
            .build(),
        ),
        messageToJson(
          messageBuilder()
            .with('modified', new Date('2023-02-12T12:29:06Z'))
            .build(),
        ),
      ])
      .build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(queuedTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          messagesTag: '1689164946',
        }),
      );
  });

  it('messagesTag is null if there are no messages', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();

    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();

    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();

    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();

    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(queuedTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          messagesTag: null,
        }),
      );
  });

  it('modules are computed with the respective address info', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();
    const module1 = getAddress(faker.finance.ethereumAddress());
    const module2 = getAddress(faker.finance.ethereumAddress());
    const module3 = getAddress(faker.finance.ethereumAddress());
    const safeInfo = safeBuilder()
      .with('masterCopy', singletonInfo.address)
      .with('modules', [module1, module2, module3])
      .build();
    const moduleInfo1 = contractBuilder().with('address', module1).build();
    const module1Page = pageBuilder().with('results', [moduleInfo1]).build();
    const moduleInfo2 = contractBuilder().with('address', module2).build();
    const module2Page = pageBuilder().with('results', [moduleInfo2]).build();
    const moduleInfo3 = contractBuilder().with('address', module3).build();
    const module3Page = pageBuilder().with('results', [moduleInfo3]).build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const fallbackHandlerPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${module1}`:
          return Promise.resolve({ data: rawify(module1Page), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${module2}`:
          return Promise.resolve({ data: rawify(module2Page), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${module3}`:
          return Promise.resolve({ data: rawify(module3Page), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackHandlerPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(queuedTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          modules: [
            {
              logoUri: moduleInfo1.logoUrl,
              name: moduleInfo1.displayName,
              value: moduleInfo1.address,
            },
            {
              logoUri: moduleInfo2.logoUrl,
              name: moduleInfo2.displayName,
              value: moduleInfo2.address,
            },
            {
              logoUri: moduleInfo3.logoUrl,
              name: moduleInfo3.displayName,
              value: moduleInfo3.address,
            },
          ],
        }),
      );
  });

  it('modules are null when module collection is empty', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();
    const safeInfo = safeBuilder()
      .with('modules', [])
      .with('masterCopy', singletonInfo.address)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackHandlerPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();
    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackHandlerPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(queuedTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          modules: null,
        }),
      );
  });

  it('fallback handler guard returns null if it is a null address', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();
    const safeInfo = safeBuilder()
      .with('fallbackHandler', NULL_ADDRESS)
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', getAddress(safeInfo.fallbackHandler))
      .build();
    const fallbackHandlerPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();
    const guardInfo = contractBuilder().build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${safeInfo.fallbackHandler}`:
          return Promise.resolve({
            data: rawify(fallbackHandlerPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(queuedTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({
          fallbackHandler: null,
        }),
      );
  });

  it('fallback handler is serialised if there is no address info', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();
    const safeInfo = safeBuilder().build();
    const guardInfo = contractBuilder().build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${safeInfo.fallbackHandler}`:
          // Return 404 for Fallback Handler Info
          return Promise.reject({ status: 404 });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(queuedTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({
          fallbackHandler: {
            value: safeInfo.fallbackHandler,
            name: null,
            logoUri: null,
          },
        }),
      );
  });

  it('guard returns null if it is a null address', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();
    const safeInfo = safeBuilder().with('guard', NULL_ADDRESS).build();
    const fallbackHandlerInfo = contractBuilder().build();
    const fallbackHandlerPage = pageBuilder()
      .with('results', [fallbackHandlerInfo])
      .build();
    const guardInfo = contractBuilder()
      .with('address', getAddress(safeInfo.guard))
      .build();
    const guardPage = pageBuilder().with('results', [guardInfo]).build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
          return Promise.resolve({
            data: rawify(fallbackHandlerPage),
            status: 200,
          });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          return Promise.resolve({ data: rawify(guardPage), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(queuedTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          guard: null,
        }),
      );
  });

  it('guard is serialised if there is no address info', async () => {
    const chain = chainBuilder().build();
    const singletons = [singletonBuilder().build()];
    const singletonInfo = contractBuilder().build();
    const singletonPage = pageBuilder()
      .with('results', [singletonInfo])
      .build();
    const safeInfo = safeBuilder().build();
    const fallbackInfo = contractBuilder().build();
    const fallbackPage = pageBuilder().with('results', [fallbackInfo]).build();
    const guardInfo = contractBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const moduleTransactions = pageBuilder().build();
    const messages = pageBuilder().build();

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
          return Promise.resolve({ data: rawify(safeInfo), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({ data: rawify(singletons), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
          return Promise.resolve({ data: rawify(singletonPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${safeInfo.fallbackHandler}`:
          return Promise.resolve({ data: rawify(fallbackPage), status: 200 });
        case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
          // Return 404 for Guard Info
          return Promise.reject({ status: 404 });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          return Promise.resolve({
            data: rawify(collectibleTransfers),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(queuedTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          return Promise.resolve({
            data: rawify(moduleTransactions),
            status: 200,
          });
        case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
          return Promise.resolve({ data: rawify(messages), status: 200 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({
          guard: {
            value: safeInfo.guard,
            name: null,
            logoUri: null,
          },
        }),
      );
  });
});
