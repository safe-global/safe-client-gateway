// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Address } from 'viem';
import { getAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  UNAVAILABLE_FOR_LEGAL_REASONS_MESSAGE,
  UNAVAILABLE_FOR_LEGAL_REASONS_STATUS,
} from '@/datasources/errors/constants';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { singletonBuilder } from '@/modules/chains/domain/entities/__tests__/singleton.builder';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import { contractBuilder } from '@/modules/data-decoder/domain/v2/entities/__tests__/contract.builder';
import { dataDecodedBuilder } from '@/modules/data-decoder/domain/v2/entities/__tests__/data-decoded.builder';
import {
  messageBuilder,
  toJson as messageToJson,
} from '@/modules/messages/domain/entities/__tests__/message.builder';
import {
  erc721TransferBuilder,
  toJson as erc721TransferToJson,
} from '@/modules/safe/domain/entities/__tests__/erc721-transfer.builder';
import {
  moduleTransactionBuilder,
  toJson as moduleTransactionToJson,
} from '@/modules/safe/domain/entities/__tests__/module-transaction.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';
import { safeAppBuilder } from '@/modules/safe-apps/domain/entities/__tests__/safe-app.builder';
import { tokenBuilder } from '@/modules/tokens/domain/__tests__/token.builder';
import type { ProposeTransactionDto } from '@/modules/transactions/domain/entities/propose-transaction.dto.entity';
import { addConfirmationDtoBuilder } from '@/modules/transactions/routes/__tests__/entities/add-confirmation.dto.builder';
import { proposeTransactionDtoBuilder } from '@/modules/transactions/routes/entities/__tests__/propose-transaction.dto.builder';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { rawify } from '@/validation/entities/raw.entity';

describe('Safes Controller', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let dataDecoderUrl: string;
  let networkService: MockedObject<INetworkService>;

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleFixture = await createTestModule();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    dataDecoderUrl = configurationService.getOrThrow('safeDataDecoder.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterEach(async () => {
    await app?.close();
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
          return Promise.resolve({
            data: rawify(
              pageBuilder()
                .with('results', [
                  multisigTransactionToJson(
                    multisigTransactionBuilder()
                      .with('modified', new Date('2020-09-18T03:52:02Z'))
                      .with('confirmations', [])
                      .build(),
                  ),
                  multisigTransactionToJson(
                    multisigTransactionBuilder()
                      .with('modified', new Date('2020-09-16T03:52:02Z'))
                      .with('confirmations', [])
                      .build(),
                  ),
                  multisigTransactionToJson(
                    multisigTransactionBuilder()
                      .with('modified', new Date('2020-09-14T03:52:02Z'))
                      .with('confirmations', [])
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
            data: rawify(pageBuilder().build()),
            status: 200,
          });
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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
        case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
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

  it('returns 451 when the Transaction Service reports the Safe as banned', async () => {
    const chain = chainBuilder().build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const safeUrl = `${chain.transactionService}/api/v1/safes/${safeAddress}`;

    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/about/singletons/`:
          return Promise.resolve({
            data: rawify([singletonBuilder().build()]),
            status: 200,
          });
        case safeUrl:
          return Promise.reject(
            new NetworkResponseError(
              new URL(safeUrl),
              new Response(null, {
                status: UNAVAILABLE_FOR_LEGAL_REASONS_STATUS,
              }),
              // The Transaction Service reports the reason under `detail`, a key
              // HttpErrorFactory does not read; the text itself is discarded
              { detail: faker.word.words() },
            ),
          );
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safeAddress}`)
      .expect(UNAVAILABLE_FOR_LEGAL_REASONS_STATUS)
      .expect({
        code: UNAVAILABLE_FOR_LEGAL_REASONS_STATUS,
        message: UNAVAILABLE_FOR_LEGAL_REASONS_MESSAGE,
      });
  });

  describe('txQueuedTag after a queue change', () => {
    // A 2-of-2 Safe (owners A and B) with one queued transaction signed by A.
    // The mocked transaction service serves whatever `queue` holds and is
    // switched to the "after" state when it receives the write, so the Safe
    // endpoint can be read before and after with the cache primed in between.
    async function setupQueue(): Promise<{
      chain: Chain;
      safeInfo: Safe;
      queued: MultisigTransaction;
      confirmationSignature: Address;
      proposal: MultisigTransaction;
      proposalDto: ProposeTransactionDto;
      setQueue: (transactions: Array<MultisigTransaction>) => void;
    }> {
      const chain = chainBuilder().build();
      const ownerA = privateKeyToAccount(generatePrivateKey());
      const ownerB = privateKeyToAccount(generatePrivateKey());
      const singletonInfo = contractBuilder().build();
      const safeInfo = safeBuilder()
        .with('owners', [ownerA.address, ownerB.address])
        .with('threshold', 2)
        .with('masterCopy', singletonInfo.address)
        .build();
      const fallbackHandlerInfo = contractBuilder()
        .with('address', getAddress(safeInfo.fallbackHandler))
        .build();
      const guardInfo = contractBuilder()
        .with('address', getAddress(safeInfo.guard))
        .build();
      const queued = await multisigTransactionBuilder()
        .with('safe', safeInfo.address)
        .with('nonce', safeInfo.nonce)
        .with('isExecuted', false)
        .buildWithConfirmations({
          chainId: chain.chainId,
          safe: safeInfo,
          signers: [ownerA, ownerB],
          signatureType: SignatureType.Eoa,
        });
      // Same `to`/`gasToken` as the queued transaction so the address-info
      // mocks below cover both
      const proposal = await multisigTransactionBuilder()
        .with('safe', safeInfo.address)
        .with('nonce', safeInfo.nonce + 1)
        .with('isExecuted', false)
        .with('operation', Operation.CALL)
        .with('to', queued.to)
        .with('gasToken', queued.gasToken)
        .buildWithConfirmations({
          chainId: chain.chainId,
          safe: safeInfo,
          signers: [ownerA],
          signatureType: SignatureType.Eoa,
        });
      const [proposerConfirmation] = proposal.confirmations ?? [];
      const proposalDto = proposeTransactionDtoBuilder()
        .with('to', proposal.to)
        .with('value', proposal.value)
        .with('data', proposal.data)
        .with('nonce', proposal.nonce.toString())
        .with('operation', proposal.operation)
        .with('safeTxGas', String(proposal.safeTxGas))
        .with('baseGas', String(proposal.baseGas))
        .with('gasPrice', String(proposal.gasPrice))
        .with('gasToken', proposal.gasToken as Address)
        .with('refundReceiver', proposal.refundReceiver)
        .with('safeTxHash', proposal.safeTxHash)
        .with('sender', proposerConfirmation.owner)
        .with('signature', proposerConfirmation.signature)
        .build();
      const [, confirmationB] = queued.confirmations ?? [];

      let queue: Array<MultisigTransaction> = [];
      const safeApps = [safeAppBuilder().build()];
      const dataDecoded = dataDecodedBuilder().build();
      const token = tokenBuilder().build();
      const emptyPage = pageBuilder().with('results', []).build();
      const getMultisigTransactionUrl = `${chain.transactionService}/api/v2/multisig-transactions/`;

      networkService.get.mockImplementation(({ url }) => {
        if (url.startsWith(getMultisigTransactionUrl)) {
          const transaction = queue.find(
            (tx) => url === `${getMultisigTransactionUrl}${tx.safeTxHash}/`,
          );
          return transaction
            ? Promise.resolve({
                data: rawify(multisigTransactionToJson(transaction)),
                status: 200,
              })
            : Promise.reject(`Not queued: ${url}`);
        }
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${safeConfigUrl}/api/v1/safe-apps/`:
            return Promise.resolve({ data: rawify(safeApps), status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}`:
            return Promise.resolve({ data: rawify(safeInfo), status: 200 });
          case `${chain.transactionService}/api/v1/about/singletons/`:
            return Promise.resolve({
              data: rawify([singletonBuilder().build()]),
              status: 200,
            });
          case `${dataDecoderUrl}/api/v1/contracts/${singletonInfo.address}`:
            return Promise.resolve({
              data: rawify(
                pageBuilder().with('results', [singletonInfo]).build(),
              ),
              status: 200,
            });
          case `${dataDecoderUrl}/api/v1/contracts/${fallbackHandlerInfo.address}`:
            return Promise.resolve({
              data: rawify(
                pageBuilder().with('results', [fallbackHandlerInfo]).build(),
              ),
              status: 200,
            });
          case `${dataDecoderUrl}/api/v1/contracts/${guardInfo.address}`:
            return Promise.resolve({
              data: rawify(pageBuilder().with('results', [guardInfo]).build()),
              status: 200,
            });
          case `${dataDecoderUrl}/api/v1/contracts/${queued.to}`:
            return Promise.resolve({ data: rawify(emptyPage), status: 200 });
          case `${chain.transactionService}/api/v1/tokens/${queued.to}`:
          case `${chain.transactionService}/api/v1/tokens/${queued.gasToken}`:
            return Promise.resolve({ data: rawify(token), status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/transfers/`:
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/module-transactions/`:
          case `${chain.transactionService}/api/v1/safes/${safeInfo.address}/messages/`:
            return Promise.resolve({ data: rawify(emptyPage), status: 200 });
          case `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`:
            return Promise.resolve({
              data: rawify(
                pageBuilder()
                  .with('results', queue.map(multisigTransactionToJson))
                  .build(),
              ),
              status: 200,
            });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });
      networkService.post.mockImplementation(({ url }) => {
        switch (url) {
          case `${dataDecoderUrl}/api/v1/data-decoder`:
            return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      return {
        chain,
        safeInfo,
        queued,
        confirmationSignature: confirmationB.signature as Address,
        proposal,
        proposalDto,
        setQueue: (transactions: Array<MultisigTransaction>): void => {
          queue = transactions;
        },
      };
    }

    async function getTxQueuedTag(
      chainId: string,
      safeAddress: Address,
    ): Promise<string | null> {
      const response = await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/safes/${safeAddress}`)
        .expect(200);
      return response.body.txQueuedTag;
    }

    function toUnixSeconds(date: Date): string {
      return Math.floor(date.getTime() / 1000).toString();
    }

    function later(date: Date): Date {
      return new Date(
        date.getTime() + faker.number.int({ min: 1_000, max: 86_400_000 }),
      );
    }

    it.each([
      { upstream: 'bumps the transaction modified date', bumpsModified: true },
      {
        upstream: 'leaves the transaction modified date untouched',
        bumpsModified: false,
      },
    ])(
      'changes after a confirmation is added, also when the Safe info was already cached, if the transaction service $upstream',
      async ({ bumpsModified }) => {
        const { chain, safeInfo, queued, confirmationSignature, setQueue } =
          await setupQueue();
        const proposedAt = faker.date.past();
        const confirmedAt = later(proposedAt);
        const [confirmationA, confirmationB] = queued.confirmations ?? [];
        setQueue([
          {
            ...queued,
            modified: proposedAt,
            confirmations: [{ ...confirmationA, submissionDate: proposedAt }],
          },
        ]);

        // Primes the Safe, queue and transaction caches
        const tagBefore = await getTxQueuedTag(chain.chainId, safeInfo.address);
        expect(tagBefore).toBe(toUnixSeconds(proposedAt));

        // The transaction service persists the signature
        const postConfirmationUrl = `${chain.transactionService}/api/v1/multisig-transactions/${queued.safeTxHash}/confirmations/`;
        networkService.post.mockImplementation(({ url }) => {
          if (url === postConfirmationUrl) {
            setQueue([
              {
                ...queued,
                modified: bumpsModified ? confirmedAt : proposedAt,
                confirmations: [
                  { ...confirmationA, submissionDate: proposedAt },
                  { ...confirmationB, submissionDate: confirmedAt },
                ],
              },
            ]);
            return Promise.resolve({ data: rawify({}), status: 201 });
          }
          return Promise.resolve({
            data: rawify(dataDecodedBuilder().build()),
            status: 200,
          });
        });
        await request(app.getHttpServer())
          .post(
            `/v1/chains/${chain.chainId}/transactions/${queued.safeTxHash}/confirmations`,
          )
          .send(
            addConfirmationDtoBuilder()
              .with('signature', confirmationSignature)
              .build(),
          )
          .expect(200);

        const tagAfter = await getTxQueuedTag(chain.chainId, safeInfo.address);
        expect(tagAfter).not.toBe(tagBefore);
        expect(tagAfter).toBe(toUnixSeconds(confirmedAt));
      },
    );

    it('changes after a transaction is proposed, also when the Safe info was already cached', async () => {
      const { chain, safeInfo, queued, proposal, proposalDto, setQueue } =
        await setupQueue();
      const proposedAt = faker.date.past();
      const secondProposedAt = later(proposedAt);
      const [confirmationA] = queued.confirmations ?? [];
      const [proposerConfirmation] = proposal.confirmations ?? [];
      const alreadyQueued = {
        ...queued,
        modified: proposedAt,
        confirmations: [{ ...confirmationA, submissionDate: proposedAt }],
      };
      setQueue([alreadyQueued]);

      // Primes the Safe, queue and transaction caches
      const tagBefore = await getTxQueuedTag(chain.chainId, safeInfo.address);
      expect(tagBefore).toBe(toUnixSeconds(proposedAt));

      // The transaction service stores the new transaction
      const proposeUrl = `${chain.transactionService}/api/v2/safes/${safeInfo.address}/multisig-transactions/`;
      networkService.post.mockImplementation(({ url }) => {
        if (url === proposeUrl) {
          // Newest first, as the transaction service orders by `-modified`
          setQueue([
            {
              ...proposal,
              modified: secondProposedAt,
              submissionDate: secondProposedAt,
              confirmations: [
                { ...proposerConfirmation, submissionDate: secondProposedAt },
              ],
            },
            alreadyQueued,
          ]);
          return Promise.resolve({ data: rawify({}), status: 201 });
        }
        return Promise.resolve({
          data: rawify(dataDecodedBuilder().build()),
          status: 200,
        });
      });
      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/transactions/${safeInfo.address}/propose`,
        )
        .send(proposalDto)
        .expect(200);

      const tagAfter = await getTxQueuedTag(chain.chainId, safeInfo.address);
      expect(tagAfter).not.toBe(tagBefore);
      expect(tagAfter).toBe(toUnixSeconds(secondProposedAt));
    });
  });
});
