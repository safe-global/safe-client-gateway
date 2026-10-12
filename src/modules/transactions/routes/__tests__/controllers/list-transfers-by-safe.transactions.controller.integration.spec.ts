// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '#/__tests__/test-app.provider';
import { createTestModule } from '#/__tests__/testing-module';
import { IConfigurationService } from '#/config/configuration.service.interface';
import type { INetworkService } from '#/datasources/network/network.service.interface';
import { NetworkService } from '#/datasources/network/network.service.interface';
import { pageBuilder } from '#/domain/entities/__tests__/page.builder';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import type { Chain } from '#/modules/chains/domain/entities/chain.entity';
import {
  erc20TransferBuilder,
  toJson as erc20TransferToJson,
} from '#/modules/safe/domain/entities/__tests__/erc20-transfer.builder';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';
import { erc20TokenBuilder } from '#/modules/tokens/domain/__tests__/token.builder';
import type { Token } from '#/modules/tokens/domain/entities/token.entity';
import { rawify } from '#/validation/entities/raw.entity';

describe('List transfers by Safe - Transactions Controller', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let safeDecoderUrl: string;
  let networkService: MockedObject<INetworkService>;

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleFixture = await createTestModule();
    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    safeDecoderUrl = configurationService.getOrThrow('safeDataDecoder.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterEach(async () => {
    await app?.close();
  });

  function mockNetwork(args: {
    chain: Chain;
    safe: Safe;
    transfers: Array<unknown>;
    token: Token;
  }): void {
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${args.chain.chainId}`;
      const getTransfersUrl = `${args.chain.transactionService}/api/v1/safes/${args.safe.address}/transfers/`;
      const getSafeUrl = `${args.chain.transactionService}/api/v1/safes/${args.safe.address}`;
      const getContractUrlPattern = `${safeDecoderUrl}/api/v1/contracts/`;
      const getTokenUrl = `${args.chain.transactionService}/api/v1/tokens/${args.token.address}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(args.chain), status: 200 });
      }
      if (url === getTransfersUrl) {
        return Promise.resolve({
          data: rawify(pageBuilder().with('results', args.transfers).build()),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(args.safe), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ detail: 'Not found' });
      }
      if (url === getTokenUrl) {
        return Promise.resolve({ data: rawify(args.token), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
  }

  it('should forward the recipient, sender, token and date filters to the Transaction Service', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const to = getAddress(faker.finance.ethereumAddress());
    const from = getAddress(faker.finance.ethereumAddress());
    const token = erc20TokenBuilder().with('trusted', true).build();
    const executionDateGte = faker.date.past().toISOString();
    const executionDateLte = faker.date.recent().toISOString();
    mockNetwork({ chain, safe, transfers: [], token });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safe.address}/transfers/`)
      .query({
        to,
        from,
        token_address: token.address,
        execution_date__gte: executionDateGte,
        execution_date__lte: executionDateLte,
      })
      .expect(200);

    expect(networkService.get).toHaveBeenCalledWith({
      url: `${chain.transactionService}/api/v1/safes/${safe.address}/transfers/`,
      networkRequest: expect.objectContaining({
        params: expect.objectContaining({
          to,
          _from: from,
          token_address: token.address,
          execution_date__gte: executionDateGte,
          execution_date__lte: executionDateLte,
        }),
      }),
    });
  });

  it('should return an ERC-20 transfer sent by the Safe as outgoing to its recipient', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const recipient = getAddress(faker.finance.ethereumAddress());
    const erc20Transfer = erc20TransferBuilder()
      .with('from', safe.address)
      .with('to', recipient)
      .with('value', faker.number.int({ min: 1 }).toString())
      .build();
    const token = erc20TokenBuilder()
      .with('address', getAddress(erc20Transfer.tokenAddress))
      .with('trusted', true)
      .build();
    mockNetwork({
      chain,
      safe,
      transfers: [erc20TransferToJson(erc20Transfer)],
      token,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safe.address}/transfers/`)
      .query({ to: recipient })
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                txHash: erc20Transfer.transactionHash,
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: safe.address },
                  recipient: { value: recipient },
                  direction: 'OUTGOING',
                  transferInfo: {
                    type: 'ERC20',
                    tokenAddress: erc20Transfer.tokenAddress,
                    value: erc20Transfer.value,
                  },
                },
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });

  it('should drop transfers of untrusted tokens by default', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const recipient = getAddress(faker.finance.ethereumAddress());
    const erc20Transfer = erc20TransferBuilder()
      .with('from', safe.address)
      .with('to', recipient)
      .with('value', faker.number.int({ min: 1 }).toString())
      .build();
    const token = erc20TokenBuilder()
      .with('address', getAddress(erc20Transfer.tokenAddress))
      .with('trusted', false)
      .build();
    mockNetwork({
      chain,
      safe,
      transfers: [erc20TransferToJson(erc20Transfer)],
      token,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safe.address}/transfers/`)
      .query({ to: recipient })
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toEqual([]);
      });
  });

  it('should reject an invalid recipient address', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safe.address}/transfers/`)
      .query({ to: faker.string.alpha(10) })
      .expect(422);

    expect(networkService.get).not.toHaveBeenCalled();
  });

  it('should reject a date that is not ISO 8601', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/safes/${safe.address}/transfers/`)
      .query({ execution_date__gte: faker.string.alpha(10) })
      .expect(422);

    expect(networkService.get).not.toHaveBeenCalled();
  });
});
