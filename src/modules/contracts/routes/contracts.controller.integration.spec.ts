import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { contractBuilder } from '@/modules/data-decoder/domain/v2/entities/__tests__/contract.builder';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { Server } from 'net';
import { rawify } from '@/validation/entities/raw.entity';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';

describe('Contracts controller', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let safeDataDecoderUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeAll(async () => {
    const moduleFixture = await createTestModule();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    safeDataDecoderUrl = configurationService.getOrThrow(
      'safeDataDecoder.baseUri',
    );
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('GET contract data for an address', () => {
    it('Success', async () => {
      const chain = chainBuilder().build();
      const contract = contractBuilder().build();
      const contractPage = pageBuilder().with('results', [contract]).build();

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${safeDataDecoderUrl}/api/v1/contracts/${contract.address}`:
            return Promise.resolve({
              data: rawify(contractPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${contract.address}`)
        .expect(200)
        .expect({
          address: contract.address,
          contractAbi: {
            abi: contract.abi?.abiJson,
          },
          displayName: contract.displayName,
          logoUri: contract.logoUrl,
          name: contract.name,
          trustedForDelegateCall: contract.trustedForDelegateCall,
        });
    });

    it('Failure: Config API fails', async () => {
      const chain = chainBuilder().build();
      const contract = contractBuilder().build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.reject(new Error());
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${contract.address}`)
        .expect(503);
    });

    it('Failure: Decoder API fails', async () => {
      const chain = chainBuilder().build();
      const contract = contractBuilder().build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case safeDataDecoderUrl:
            return Promise.reject(
              new NetworkResponseError(new URL(safeDataDecoderUrl), {
                status: 503,
              } as Response),
            );
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${contract.address}`)
        .expect(503);
    });

    it('Should pass validation if name is null', async () => {
      const chain = chainBuilder().build();
      const contract = contractBuilder().build();
      const contractPage = pageBuilder()
        .with('results', [{ ...contract, name: null }])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${safeDataDecoderUrl}/api/v1/contracts/${contract.address}`:
            return Promise.resolve({
              data: rawify(contractPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${contract.address}`)
        .expect(200)
        .expect({
          address: contract.address,
          name: '',
          displayName: contract.displayName,
          logoUri: contract.logoUrl,
          contractAbi: {
            abi: contract.abi?.abiJson,
          },
          trustedForDelegateCall: contract.trustedForDelegateCall,
        });
    });

    it('Should pass validation if displayName is null', async () => {
      const chain = chainBuilder().build();
      const contract = contractBuilder().build();
      const contractPage = pageBuilder()
        .with('results', [{ ...contract, displayName: null }])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${safeDataDecoderUrl}/api/v1/contracts/${contract.address}`:
            return Promise.resolve({
              data: rawify(contractPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${contract.address}`)
        .expect(200)
        .expect({
          address: contract.address,
          name: contract.name,
          displayName: '',
          logoUri: contract.logoUrl,
          contractAbi: {
            abi: contract.abi?.abiJson,
          },
          trustedForDelegateCall: contract.trustedForDelegateCall,
        });
    });

    it('Should get a validation error', async () => {
      const chain = chainBuilder().build();
      const contract = contractBuilder().build();
      const contractPage = pageBuilder()
        .with('results', [{ ...contract, address: false }])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: rawify(chain), status: 200 });
          case `${safeDataDecoderUrl}/api/v1/contracts/${contract.address}`:
            return Promise.resolve({
              data: rawify(contractPage),
              status: 200,
            });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/contracts/${contract.address}`)
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
    });
  });
});
