// SPDX-License-Identifier: FSL-1.1-MIT
import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAddress, type PublicClient } from 'viem';
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
import { IBlockchainApiManager } from '#/domain/interfaces/blockchain-api.manager.interface';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import { erc20ApproveEncoder } from '#/modules/relay/domain/contracts/__tests__/encoders/erc20-encoder.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import { rawify } from '#/validation/entities/raw.entity';

describe('Token approvals controller', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: MockedObject<INetworkService>;
  let blockchainApiManager: IBlockchainApiManager;

  const client = {
    getTransactionReceipt: vi.fn(),
    multicall: vi.fn(),
  } as unknown as MockedObject<PublicClient>;

  beforeAll(async () => {
    const moduleFixture = await createTestModule();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);
    blockchainApiManager = moduleFixture.get(IBlockchainApiManager);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(blockchainApiManager, 'getApi').mockResolvedValue(client);
  });

  describe('GET /v1/chains/:chainId/safes/:safeAddress/token-approvals', () => {
    it('returns the live approvals of the Safe', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const tokenAddress = getAddress(faker.finance.ethereumAddress());
      const spender = getAddress(faker.finance.ethereumAddress());
      const allowance = faker.number.bigInt({ min: 1n });
      const transaction = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('to', tokenAddress)
        .with('data', erc20ApproveEncoder().with('spender', spender).encode())
        .with('operation', Operation.CALL)
        .with('isExecuted', true)
        .with('isSuccessful', true)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${chain.transactionService}/api/v2/safes/${safeAddress}/multisig-transactions/`:
            return Promise.resolve({
              data: rawify(
                pageBuilder()
                  .with('count', 1)
                  .with('results', [multisigTransactionToJson(transaction)])
                  .build(),
              ),
              status: 200,
            });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}/module-transactions/`:
            return Promise.resolve({
              data: rawify(
                pageBuilder().with('count', 0).with('results', []).build(),
              ),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });
      client.multicall.mockResolvedValue([
        { status: 'success', result: allowance },
      ]);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/safes/${safeAddress}/token-approvals`)
        .expect(200)
        .expect({
          approvals: [
            { tokenAddress, spender, allowance: allowance.toString() },
          ],
          isHistoryComplete: true,
        });
    });

    it('rejects an invalid Safe address', async () => {
      await request(app.getHttpServer())
        .get(
          `/v1/chains/${faker.string.numeric()}/safes/${faker.string.alphanumeric()}/token-approvals`,
        )
        .expect(422);

      expect(networkService.get).not.toHaveBeenCalled();
    });
  });
});
