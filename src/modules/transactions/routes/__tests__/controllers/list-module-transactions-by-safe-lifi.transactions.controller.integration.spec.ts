// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { type Address, getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '#/__tests__/test-app.provider';
import { createTestModule } from '#/__tests__/testing-module';
import { IConfigurationService } from '#/config/configuration.service.interface';
import configuration from '#/config/entities/__tests__/configuration';
import type { INetworkService } from '#/datasources/network/network.service.interface';
import { NetworkService } from '#/datasources/network/network.service.interface';
import { pageBuilder } from '#/domain/entities/__tests__/page.builder';
import {
  swapDataStructBuilder,
  swapTokensSingleV3ERC20ToERC20Encoder,
} from '#/modules/bridge/domain/contracts/decoders/__tests__/across-v3-encoder.builder';
import { bridgeChainBuilder } from '#/modules/bridge/domain/entities/__tests__/bridge-chain.builder';
import { failedStatusDataBuilder } from '#/modules/bridge/domain/entities/__tests__/bridge-status.builder';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import type { Chain } from '#/modules/chains/domain/entities/chain.entity';
import { contractBuilder } from '#/modules/data-decoder/domain/v2/entities/__tests__/contract.builder';
import { erc20TransferEncoder } from '#/modules/relay/domain/contracts/__tests__/encoders/erc20-encoder.builder';
import {
  moduleTransactionBuilder,
  toJson as moduleTransactionToJson,
} from '#/modules/safe/domain/entities/__tests__/module-transaction.builder';
import type { ModuleTransaction } from '#/modules/safe/domain/entities/module-transaction.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import { erc20TokenBuilder } from '#/modules/tokens/domain/__tests__/token.builder';
import { rawify } from '#/validation/entities/raw.entity';

describe('List module transactions by Safe with LiFi mapping - Transactions Controller', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let safeDecoderUrl: string;
  let bridgeUrl: string;
  let networkService: MockedObject<INetworkService>;

  beforeEach(async () => {
    vi.resetAllMocks();

    const baseConfiguration = configuration();
    const testConfiguration = (): typeof baseConfiguration => ({
      ...baseConfiguration,
      features: {
        ...baseConfiguration.features,
        lifiTransactionsMapping: true,
      },
    });
    const moduleFixture = await createTestModule({ config: testConfiguration });

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    safeDecoderUrl = configurationService.getOrThrow('safeDataDecoder.baseUri');
    bridgeUrl = configurationService.getOrThrow('bridge.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterEach(async () => {
    await app?.close();
  });

  function mockUpstreams(args: {
    chain: Chain;
    diamondAddress: ModuleTransaction['to'];
    moduleTransactions: Array<ModuleTransaction>;
  }) {
    const getContract = vi.fn((address: Address) =>
      contractBuilder().with('address', address).build(),
    );
    const { chain, diamondAddress, moduleTransactions } = args;
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getModuleTransactionsUrlPattern = `${chain.transactionService}/api/v1/safes/`;
    const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/`;
    const getContractUrlPattern = `${safeDecoderUrl}/api/v1/contracts/`;
    networkService.get.mockImplementation(({ url }) => {
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === `${bridgeUrl}/v1/chains`) {
        return Promise.resolve({
          data: rawify({
            chains: [
              bridgeChainBuilder()
                .with('id', chain.chainId)
                .with('diamondAddress', diamondAddress)
                .build(),
            ],
          }),
          status: 200,
        });
      }
      if (url === `${bridgeUrl}/v1/status`) {
        return Promise.resolve({
          data: rawify(failedStatusDataBuilder().build()),
          status: 200,
        });
      }
      if (url.startsWith(getTokenUrlPattern)) {
        return Promise.resolve({
          data: rawify(erc20TokenBuilder().build()),
          status: 200,
        });
      }
      if (url.startsWith(getContractUrlPattern)) {
        const address = getAddress(url.slice(getContractUrlPattern.length));
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('count', 1)
              .with('results', [getContract(address)])
              .build(),
          ),
          status: 200,
        });
      }
      if (url.startsWith(getModuleTransactionsUrlPattern)) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('results', moduleTransactions.map(moduleTransactionToJson))
              .build(),
          ),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    return getContract;
  }

  it('Does not get the LiFi chains for transactions that do not call LiFi', async () => {
    const chain = chainBuilder().build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const moduleTransactions = faker.helpers.multiple(
      () =>
        moduleTransactionBuilder()
          .with('safe', safeAddress)
          .with('data', erc20TransferEncoder().encode())
          .with('operation', Operation.CALL)
          .with('value', '0')
          .build(),
      { count: { min: 2, max: 5 } },
    );
    mockUpstreams({
      chain,
      diamondAddress: getAddress(faker.finance.ethereumAddress()),
      moduleTransactions,
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safeAddress}/module-transactions`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toHaveLength(moduleTransactions.length);
      });

    expect(networkService.get).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: `${bridgeUrl}/v1/chains` }),
    );
  });

  it('Maps LiFi swaps on one page with one contract fetch per recipient', async () => {
    const chain = chainBuilder().build();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const diamondAddress = getAddress(faker.finance.ethereumAddress());
    const swapData = swapDataStructBuilder()
      .with('sendingAssetId', getAddress(faker.finance.ethereumAddress()))
      .with('receivingAssetId', getAddress(faker.finance.ethereumAddress()))
      .build();
    const moduleAddress = getAddress(faker.finance.ethereumAddress());
    const moduleTransactions = faker.helpers.multiple(
      () =>
        moduleTransactionBuilder()
          .with('safe', safeAddress)
          .with('module', moduleAddress)
          .with('to', diamondAddress)
          .with(
            'data',
            swapTokensSingleV3ERC20ToERC20Encoder()
              .with('receiver', safeAddress)
              .with('swapData', swapData)
              .encode(),
          )
          .with('operation', Operation.CALL)
          .with('value', '0')
          .build(),
      { count: 2 },
    );
    const getContract = mockUpstreams({
      chain,
      diamondAddress,
      moduleTransactions,
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safeAddress}/module-transactions`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toMatchObject(
          moduleTransactions.map(() => ({
            transaction: {
              txInfo: {
                type: 'Swap',
                recipient: { value: safeAddress },
                fromAmount: swapData.fromAmount.toString(),
              },
            },
          })),
        );
      });

    expect(getContract).toHaveBeenCalledWith(safeAddress);
    expect(getContract).toHaveBeenCalledWith(moduleAddress);
    expect(getContract).toHaveBeenCalledTimes(2);
    expect(networkService.get).toHaveBeenCalledWith(
      expect.objectContaining({ url: `${bridgeUrl}/v1/chains` }),
    );
  });
});
