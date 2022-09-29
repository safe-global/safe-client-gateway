import { INestApplication } from '@nestjs/common';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../../config/__tests__/test.configuration.module';
import {
  fakeCacheService,
  TestCacheModule,
} from '../../datasources/cache/__tests__/test.cache.module';
import { Test, TestingModule } from '@nestjs/testing';
import { DomainModule } from '../../domain.module';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../datasources/network/__tests__/test.network.module';
import { DataSourceErrorFilter } from '../common/filters/data-source-error.filter';
import { SafesModule } from './safes.module';
import * as request from 'supertest';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';
import { safeBuilder } from '../../domain/safe/entities/__tests__/safe.builder';
import { masterCopyBuilder } from '../../domain/chains/entities/__tests__/master-copy.builder';
import { contractBuilder } from '../../domain/contracts/entities/__tests__/contract.builder';
import { pageBuilder } from '../../domain/entities/__tests__/page.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '../../domain/safe/entities/__tests__/multisig-transaction.builder';
import {
  ethereumTransactionBuilder,
  toJson as ethereumTransactionToJson,
} from '../../domain/safe/entities/__tests__/ethereum-transaction.builder';
import { faker } from '@faker-js/faker';
import {
  erc721TransferBuilder,
  toJson as erc721TransferToJson,
} from '../../domain/safe/entities/__tests__/erc721-transfer.builder';
import {
  moduleTransactionBuilder,
  toJson as moduleTransactionToJson,
} from '../../domain/safe/entities/__tests__/module-transaction.builder';

describe('Safes Controller (Unit)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    fakeConfigurationService.set(
      'safeConfig.baseUri',
      'https://test.safe.config',
    );

    fakeConfigurationService.set(
      'exchange.baseUri',
      'https://test.exchange.service',
    );

    fakeConfigurationService.set('exchange.apiKey', 'https://test.api.key');
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeCacheService.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        SafesModule,
        // common
        DomainModule,
        TestCacheModule,
        TestConfigurationModule,
        TestNetworkModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new DataSourceErrorFilter());

    await app.init();
  });

  it('safe info is correctly serialised', async () => {
    const chain = chainBuilder()
      .with('recommendedMasterCopyVersion', '5.0.0')
      .build();
    const owner = faker.finance.ethereumAddress();
    const masterCopies = [masterCopyBuilder().with('version', '5.0.0').build()];
    const masterCopyInfo = contractBuilder()
      .with('address', masterCopies[0].address)
      .build();
    const safeInfo = safeBuilder()
      .with('owners', [owner])
      .with('masterCopy', masterCopies[0].address)
      .with('version', '5.0.0')
      .build();
    const fallbackHandlerInfo = contractBuilder()
      .with('address', safeInfo.fallbackHandler)
      .build();
    const guardInfo = contractBuilder().with('address', safeInfo.guard).build();

    const collectibleTransfers = pageBuilder()
      .with('results', [
        erc721TransferToJson(
          erc721TransferBuilder()
            .with('executionDate', new Date('2016-09-19T02:55:04+0000'))
            .build(),
        ),
      ])
      .build();

    const queuedTransactions = pageBuilder()
      .with('results', [
        multisigTransactionToJson(
          multisigTransactionBuilder()
            .with('modified', new Date('2049-01-30T14:23:07Z'))
            .build(),
        ),
      ])
      .build();

    const allTransactions = pageBuilder()
      .with('results', [
        ethereumTransactionToJson(
          ethereumTransactionBuilder()
            .with('executionDate', new Date('2073-03-12T12:29:06Z'))
            .build(),
        ),
      ])
      .build();

    mockNetworkService.get.mockResolvedValueOnce({ data: chain });
    mockNetworkService.get.mockResolvedValueOnce({ data: safeInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopies });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopyInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: fallbackHandlerInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: guardInfo });
    mockNetworkService.get.mockResolvedValueOnce({
      data: collectibleTransfers,
    });
    mockNetworkService.get.mockResolvedValueOnce({
      data: queuedTransactions,
    });
    mockNetworkService.get.mockResolvedValueOnce({ data: allTransactions });

    await request(app.getHttpServer())
      .get(`/chains/${chain.chainId}/safes/${safeInfo.address}`)
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
          value: masterCopyInfo.address,
          name: masterCopyInfo.displayName,
          logoUri: masterCopyInfo.logoUri,
        },
        implementationVersionState: 'UP_TO_DATE',
        collectiblesTag: '1474253704',
        txQueuedTag: '2495629387',
        txHistoryTag: '3256547346',
        modules: null,
        fallbackHandler: {
          value: fallbackHandlerInfo.address,
          name: fallbackHandlerInfo.displayName,
          logoUri: fallbackHandlerInfo.logoUri,
        },
        guard: {
          value: guardInfo.address,
          name: guardInfo.displayName,
          logoUri: guardInfo.logoUri,
        },
        version: safeInfo.version,
      });
  });

  it('Version State is UNKNOWN when safe has an invalid safe version', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder().with('version', 'vI.N.V.A.L.I.D').build();
    const fallbackHandlerInfo = contractBuilder().build();
    const guardInfo = contractBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const allTransactions = pageBuilder().build();
    mockNetworkService.get.mockResolvedValueOnce({ data: chain });
    mockNetworkService.get.mockResolvedValueOnce({ data: safeInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopies });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopyInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: fallbackHandlerInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: guardInfo });
    mockNetworkService.get.mockResolvedValueOnce({
      data: collectibleTransfers,
    });
    mockNetworkService.get.mockResolvedValueOnce({
      data: queuedTransactions,
    });
    mockNetworkService.get.mockResolvedValueOnce({ data: allTransactions });

    await request(app.getHttpServer())
      .get(`/chains/${chain.chainId}/safes/${safeInfo.address}`)
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
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder().build();
    const fallbackHandlerInfo = contractBuilder().build();
    const guardInfo = contractBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const allTransactions = pageBuilder().build();
    mockNetworkService.get.mockResolvedValueOnce({ data: chain });
    mockNetworkService.get.mockResolvedValueOnce({ data: safeInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopies });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopyInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: fallbackHandlerInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: guardInfo });
    mockNetworkService.get.mockResolvedValueOnce({
      data: collectibleTransfers,
    });
    mockNetworkService.get.mockResolvedValueOnce({
      data: queuedTransactions,
    });
    mockNetworkService.get.mockResolvedValueOnce({ data: allTransactions });

    await request(app.getHttpServer())
      .get(`/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          implementationVersionState: 'UNKNOWN',
        }),
      );
  });

  it('Version State is UNKNOWN if master copy is not supported', async () => {
    const chain = chainBuilder().build();
    const supportedMasterCopy = faker.finance.ethereumAddress();
    const masterCopies = [
      masterCopyBuilder().with('address', supportedMasterCopy).build(),
    ];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder().build();
    const fallbackHandlerInfo = contractBuilder().build();
    const guardInfo = contractBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const allTransactions = pageBuilder().build();
    mockNetworkService.get.mockResolvedValueOnce({ data: chain });
    mockNetworkService.get.mockResolvedValueOnce({ data: safeInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopies });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopyInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: fallbackHandlerInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: guardInfo });
    mockNetworkService.get.mockResolvedValueOnce({
      data: collectibleTransfers,
    });
    mockNetworkService.get.mockResolvedValueOnce({
      data: queuedTransactions,
    });
    mockNetworkService.get.mockResolvedValueOnce({ data: allTransactions });

    await request(app.getHttpServer())
      .get(`/chains/${chain.chainId}/safes/${safeInfo.address}`)
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
    const supportedMasterCopy = faker.finance.ethereumAddress();
    const masterCopies = [
      masterCopyBuilder().with('address', supportedMasterCopy).build(),
    ];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder()
      .with('masterCopy', supportedMasterCopy)
      .with('version', '4.0.0')
      .build();
    const fallbackHandlerInfo = contractBuilder().build();
    const guardInfo = contractBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const allTransactions = pageBuilder().build();
    mockNetworkService.get.mockResolvedValueOnce({ data: chain });
    mockNetworkService.get.mockResolvedValueOnce({ data: safeInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopies });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopyInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: fallbackHandlerInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: guardInfo });
    mockNetworkService.get.mockResolvedValueOnce({
      data: collectibleTransfers,
    });
    mockNetworkService.get.mockResolvedValueOnce({
      data: queuedTransactions,
    });
    mockNetworkService.get.mockResolvedValueOnce({ data: allTransactions });

    await request(app.getHttpServer())
      .get(`/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          implementationVersionState: 'OUTDATED',
        }),
      );
  });

  it('txHistoryTag is computed from Multisig transaction with modified date', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder().build();
    const fallbackHandlerInfo = contractBuilder().build();
    const guardInfo = contractBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const allTransactions = pageBuilder()
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
      .build();
    mockNetworkService.get.mockResolvedValueOnce({ data: chain });
    mockNetworkService.get.mockResolvedValueOnce({ data: safeInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopies });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopyInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: fallbackHandlerInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: guardInfo });
    mockNetworkService.get.mockResolvedValueOnce({
      data: collectibleTransfers,
    });
    mockNetworkService.get.mockResolvedValueOnce({
      data: queuedTransactions,
    });
    mockNetworkService.get.mockResolvedValueOnce({ data: allTransactions });

    await request(app.getHttpServer())
      .get(`/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: '1600401122',
        }),
      );
  });

  it('txHistoryTag is computed from Multisig transaction without modified date', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder().build();
    const fallbackHandlerInfo = contractBuilder().build();
    const guardInfo = contractBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const allTransactions = pageBuilder()
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
      .build();
    mockNetworkService.get.mockResolvedValueOnce({ data: chain });
    mockNetworkService.get.mockResolvedValueOnce({ data: safeInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopies });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopyInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: fallbackHandlerInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: guardInfo });
    mockNetworkService.get.mockResolvedValueOnce({
      data: collectibleTransfers,
    });
    mockNetworkService.get.mockResolvedValueOnce({
      data: queuedTransactions,
    });
    mockNetworkService.get.mockResolvedValueOnce({ data: allTransactions });

    await request(app.getHttpServer())
      .get(`/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: '1600314722',
        }),
      );
  });

  it('txHistoryTag is computed from Ethereum transaction', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder().build();
    const fallbackHandlerInfo = contractBuilder().build();
    const guardInfo = contractBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const allTransactions = pageBuilder()
      .with('results', [
        ethereumTransactionToJson(
          ethereumTransactionBuilder()
            .with('executionDate', new Date('2020-09-17T03:52:02Z'))
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
      .build();
    mockNetworkService.get.mockResolvedValueOnce({ data: chain });
    mockNetworkService.get.mockResolvedValueOnce({ data: safeInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopies });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopyInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: fallbackHandlerInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: guardInfo });
    mockNetworkService.get.mockResolvedValueOnce({
      data: collectibleTransfers,
    });
    mockNetworkService.get.mockResolvedValueOnce({
      data: queuedTransactions,
    });
    mockNetworkService.get.mockResolvedValueOnce({ data: allTransactions });

    await request(app.getHttpServer())
      .get(`/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: '1600314722',
        }),
      );
  });

  it('txHistoryTag is computed from Module transaction', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder().build();
    const fallbackHandlerInfo = contractBuilder().build();
    const guardInfo = contractBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const allTransactions = pageBuilder()
      .with('results', [
        moduleTransactionToJson(
          moduleTransactionBuilder()
            .with('executionDate', new Date('2020-09-17T03:52:02Z'))
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
      .build();
    mockNetworkService.get.mockResolvedValueOnce({ data: chain });
    mockNetworkService.get.mockResolvedValueOnce({ data: safeInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopies });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopyInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: fallbackHandlerInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: guardInfo });
    mockNetworkService.get.mockResolvedValueOnce({
      data: collectibleTransfers,
    });
    mockNetworkService.get.mockResolvedValueOnce({
      data: queuedTransactions,
    });
    mockNetworkService.get.mockResolvedValueOnce({ data: allTransactions });

    await request(app.getHttpServer())
      .get(`/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          txHistoryTag: '1600314722',
        }),
      );
  });

  it('modules are computed with the respective address info', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const module1 = faker.finance.ethereumAddress();
    const module2 = faker.finance.ethereumAddress();
    const module3 = faker.finance.ethereumAddress();
    const safeInfo = safeBuilder()
      .with('modules', [module1, module2, module3])
      .build();
    const moduleInfo1 = contractBuilder().with('address', module1).build();
    const moduleInfo2 = contractBuilder().with('address', module2).build();
    const moduleInfo3 = contractBuilder().with('address', module3).build();
    const fallbackHandlerInfo = contractBuilder().build();
    const guardInfo = contractBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const allTransactions = pageBuilder().build();
    mockNetworkService.get.mockResolvedValueOnce({ data: chain });
    mockNetworkService.get.mockResolvedValueOnce({ data: safeInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopies });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopyInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: moduleInfo1 });
    mockNetworkService.get.mockResolvedValueOnce({ data: moduleInfo2 });
    mockNetworkService.get.mockResolvedValueOnce({ data: moduleInfo3 });
    mockNetworkService.get.mockResolvedValueOnce({ data: fallbackHandlerInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: guardInfo });
    mockNetworkService.get.mockResolvedValueOnce({
      data: collectibleTransfers,
    });
    mockNetworkService.get.mockResolvedValueOnce({
      data: queuedTransactions,
    });
    mockNetworkService.get.mockResolvedValueOnce({ data: allTransactions });

    await request(app.getHttpServer())
      .get(`/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          modules: [
            {
              logoUri: moduleInfo1.logoUri,
              name: moduleInfo1.displayName,
              value: moduleInfo1.address,
            },
            {
              logoUri: moduleInfo2.logoUri,
              name: moduleInfo2.displayName,
              value: moduleInfo2.address,
            },
            {
              logoUri: moduleInfo3.logoUri,
              name: moduleInfo3.displayName,
              value: moduleInfo3.address,
            },
          ],
        }),
      );
  });

  it('modules are null when module collection is empty', async () => {
    const chain = chainBuilder().build();
    const masterCopies = [masterCopyBuilder().build()];
    const masterCopyInfo = contractBuilder().build();
    const safeInfo = safeBuilder().with('modules', []).build();

    const fallbackHandlerInfo = contractBuilder().build();
    const guardInfo = contractBuilder().build();
    const collectibleTransfers = pageBuilder().build();
    const queuedTransactions = pageBuilder().build();
    const allTransactions = pageBuilder().build();
    mockNetworkService.get.mockResolvedValueOnce({ data: chain });
    mockNetworkService.get.mockResolvedValueOnce({ data: safeInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopies });
    mockNetworkService.get.mockResolvedValueOnce({ data: masterCopyInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: fallbackHandlerInfo });
    mockNetworkService.get.mockResolvedValueOnce({ data: guardInfo });
    mockNetworkService.get.mockResolvedValueOnce({
      data: collectibleTransfers,
    });
    mockNetworkService.get.mockResolvedValueOnce({
      data: queuedTransactions,
    });
    mockNetworkService.get.mockResolvedValueOnce({ data: allTransactions });

    await request(app.getHttpServer())
      .get(`/chains/${chain.chainId}/safes/${safeInfo.address}`)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          modules: null,
        }),
      );
  });
});
