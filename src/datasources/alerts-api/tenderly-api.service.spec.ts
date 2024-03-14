import { faker } from '@faker-js/faker';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { TenderlyApi } from '@/datasources/alerts-api/tenderly-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { INetworkService } from '@/datasources/network/network.service.interface';
import { AlertsRegistration } from '@/domain/alerts/entities/alerts-registration.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { AlertsDeletion } from '@/domain/alerts/entities/alerts-deletion.entity';

const networkService = {
  post: jest.fn(),
  delete: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>;
const mockNetworkService = jest.mocked(networkService);

describe('TenderlyApi', () => {
  let service: TenderlyApi;
  let fakeConfigurationService: FakeConfigurationService;
  let httpErrorFactory: HttpErrorFactory;

  let tenderlyBaseUri: string;
  let tenderlyApiKey: string;
  let tenderlyAccount: string;
  let tenderlyProject: string;

  beforeEach(async () => {
    jest.resetAllMocks();

    tenderlyBaseUri = faker.internet.url({ appendSlash: false });
    tenderlyApiKey = faker.string.hexadecimal({ length: 32 });
    tenderlyAccount = faker.string.sample();
    tenderlyProject = faker.string.sample();

    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('alerts.baseUri', tenderlyBaseUri);
    fakeConfigurationService.set('alerts.apiKey', tenderlyApiKey);
    fakeConfigurationService.set('alerts.account', tenderlyAccount);
    fakeConfigurationService.set('alerts.project', tenderlyProject);

    httpErrorFactory = new HttpErrorFactory();

    service = new TenderlyApi(
      fakeConfigurationService,
      mockNetworkService,
      httpErrorFactory,
    );
  });

  it('should error if configuration is not defined', async () => {
    const fakeConfigurationService = new FakeConfigurationService();
    const httpErrorFactory = new HttpErrorFactory();

    expect(
      () =>
        new TenderlyApi(
          fakeConfigurationService,
          mockNetworkService,
          httpErrorFactory,
        ),
    ).toThrow();
  });

  describe('addContract', () => {
    it('should add a contract', async () => {
      const fakeDisplayName = (): `${string}:${string}:${string}` => {
        const chain = faker.string.numeric();
        const safeAddress = faker.finance.ethereumAddress();
        const moduleAddress = faker.finance.ethereumAddress();
        return `${chain}:${safeAddress}:${moduleAddress}`;
      };

      const contract: AlertsRegistration = {
        address: faker.finance.ethereumAddress(),
        displayName: fakeDisplayName(),
        chainId: faker.string.numeric(),
      };

      await service.addContract(contract);

      expect(mockNetworkService.post).toHaveBeenCalledWith({
        url: `${tenderlyBaseUri}/api/v1/account/${tenderlyAccount}/project/${tenderlyProject}/address`,
        data: {
          address: contract.address,
          display_name: contract.displayName,
          network_id: contract.chainId,
        },
        networkRequest: {
          headers: {
            'X-Access-Key': tenderlyApiKey,
          },
        },
      });
    });

    it('should forward error', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(tenderlyBaseUri),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.post.mockRejectedValueOnce(error);

      await expect(
        service.addContract({
          address: faker.finance.ethereumAddress(),
          chainId: faker.string.numeric(),
        }),
      ).rejects.toThrow(new DataSourceError('Unexpected error', status));

      expect(mockNetworkService.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteContract', () => {
    it('should delete a contract', async () => {
      const contract: AlertsDeletion = {
        address: faker.finance.ethereumAddress(),
        chainId: faker.string.numeric(),
      };

      await service.deleteContract(contract);

      expect(mockNetworkService.delete).toHaveBeenCalledWith({
        url: `${tenderlyBaseUri}/api/v1/account/${tenderlyAccount}/project/${tenderlyProject}/contract/${contract.chainId}/${contract.address}`,
        networkRequest: {
          headers: {
            'X-Access-Key': tenderlyApiKey,
          },
        },
      });
    });

    it('should forward error', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(tenderlyBaseUri),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      mockNetworkService.delete.mockRejectedValueOnce(error);

      await expect(
        service.deleteContract({
          address: faker.finance.ethereumAddress(),
          chainId: faker.string.numeric(),
        }),
      ).rejects.toThrow(new DataSourceError('Unexpected error', status));

      expect(mockNetworkService.delete).toHaveBeenCalledTimes(1);
    });
  });
});
