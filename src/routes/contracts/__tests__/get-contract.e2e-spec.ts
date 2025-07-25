import request from 'supertest';
import type { RedisClientType } from 'redis';
import type { INestApplication } from '@nestjs/common';
import { redisClientFactory } from '@/__tests__/redis-client.factory';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import type { Server } from 'net';
import { createBaseTestModule } from '@/__tests__/testing-module';

describe('Get contract e2e test', () => {
  let app: INestApplication<Server>;
  let redisClient: RedisClientType;
  const chainId = '1'; // Mainnet
  const cacheKeyPrefix = crypto.randomUUID();

  beforeAll(async () => {
    const moduleRef = await createBaseTestModule();

    app = await new TestAppProvider().provide(moduleRef);
    await app.init();
    redisClient = await redisClientFactory();
  });

  afterAll(async () => {
    await app.close();
    await redisClient.quit();
  });

  it('GET /contracts/<address>', async () => {
    const contractAddress = '0x7cbB62EaA69F79e6873cD1ecB2392971036cFAa4';
    const expectedResponse = {
      address: '0x7cbB62EaA69F79e6873cD1ecB2392971036cFAa4',
      name: 'CreateCall',
      displayName: 'Safe: CreateCall 1.3.0',
      logoUri:
        'https://safe-transaction-assets.staging.5afe.dev/contracts/logos/0x7cbB62EaA69F79e6873cD1ecB2392971036cFAa4.png',
      contractAbi: {
        abi: [
          {
            name: 'ContractCreation',
            type: 'event',
            inputs: [
              {
                name: 'newContract',
                type: 'address',
                indexed: false,
                internalType: 'address',
              },
            ],
            anonymous: false,
          },
          {
            name: 'performCreate',
            type: 'function',
            inputs: [
              {
                name: 'value',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'deploymentData',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
            outputs: [
              {
                name: 'newContract',
                type: 'address',
                internalType: 'address',
              },
            ],
            stateMutability: 'nonpayable',
          },
          {
            name: 'performCreate2',
            type: 'function',
            inputs: [
              {
                name: 'value',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'deploymentData',
                type: 'bytes',
                internalType: 'bytes',
              },
              {
                name: 'salt',
                type: 'bytes32',
                internalType: 'bytes32',
              },
            ],
            outputs: [
              {
                name: 'newContract',
                type: 'address',
                internalType: 'address',
              },
            ],
            stateMutability: 'nonpayable',
          },
        ],
        description: 'CreateCall',
        relevance: 100,
      },
      trustedForDelegateCall: false,
    };

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/contracts/${contractAddress}`)
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual(expectedResponse);
      });

    const cacheContent = await redisClient.hGet(
      `${cacheKeyPrefix}-${chainId}_contract_${contractAddress}`,
      '',
    );
    expect(cacheContent).toEqual(JSON.stringify(expectedResponse));
  });
});
