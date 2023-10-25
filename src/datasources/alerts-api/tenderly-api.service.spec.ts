import { faker } from '@faker-js/faker';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { TenderlyApi } from '@/datasources/alerts-api/tenderly-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { INetworkService } from '@/datasources/network/network.service.interface';
import { Contract, ContractId } from '@/domain/alerts/entities/alerts.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';

const networkService = {
  post: jest.fn(),
  delete: jest.fn(),
} as unknown as INetworkService;
const mockNetworkService = jest.mocked(networkService);

const httpErrorFactory = {
  from: jest.fn(),
} as unknown as HttpErrorFactory;
const mockHttpErrorFactory = jest.mocked(httpErrorFactory);

describe('TenderlyApi', () => {
  let service: TenderlyApi;
  let fakeConfigurationService: FakeConfigurationService;

  let tenderlyBaseUri: string;
  let tenderlyApiKey: string;
  let tenderlyAccount: string;
  let tenderlyProject: string;

  beforeEach(async () => {
    jest.clearAllMocks();

    tenderlyBaseUri = faker.internet.url({ appendSlash: false });
    tenderlyApiKey = faker.string.hexadecimal({ length: 32 });
    tenderlyAccount = faker.string.sample();
    tenderlyProject = faker.string.sample();

    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('alerts.baseUri', tenderlyBaseUri);
    fakeConfigurationService.set('alerts.apiKey', tenderlyApiKey);
    fakeConfigurationService.set('alerts.account', tenderlyAccount);
    fakeConfigurationService.set('alerts.project', tenderlyProject);

    service = new TenderlyApi(
      fakeConfigurationService,
      mockNetworkService,
      mockHttpErrorFactory,
    );
  });

  it('should error if configuration is not defined', async () => {
    const fakeConfigurationService = new FakeConfigurationService();

    expect(
      () =>
        new TenderlyApi(
          fakeConfigurationService,
          mockNetworkService,
          mockHttpErrorFactory,
        ),
    ).toThrow();
  });

  describe('Adding contracts', () => {
    it('should add contracts', async () => {
      const contracts: Array<Contract> = [
        {
          address: faker.finance.ethereumAddress(),
          displayName: faker.word.words(),
          chainId: faker.string.numeric(),
        },
        {
          address: faker.finance.ethereumAddress(),
          displayName: faker.word.words(),
          chainId: faker.string.numeric(),
        },
        {
          address: faker.finance.ethereumAddress(),
          displayName: faker.word.words(),
          chainId: faker.string.numeric(),
        },
      ];

      await service.addContracts(contracts);

      expect(mockNetworkService.post).toBeCalledWith(
        `${tenderlyBaseUri}/api/v2/accounts/${tenderlyAccount}/projects/${tenderlyProject}/contracts`,
        {
          headers: {
            'X-Access-Key': tenderlyApiKey,
          },
          params: {
            contracts: contracts.map((contract) => ({
              address: contract.address,
              display_name: contract.displayName,
              network_id: contract.chainId,
            })),
          },
        },
      );
      expect(mockHttpErrorFactory.from).not.toHaveBeenCalled();
    });

    it('should forward error', async () => {
      mockNetworkService.post.mockImplementation(() =>
        Promise.reject('Unexpected error'),
      );
      mockHttpErrorFactory.from.mockImplementation(
        () => new DataSourceError('Unexpected error'),
      );

      await service.addContracts([]);

      expect(mockNetworkService.post).toHaveBeenCalledTimes(1);
      expect(mockHttpErrorFactory.from).toBeCalledTimes(1);
    });
  });

  describe('Removing contracts', () => {
    it('should remove contracts', async () => {
      const contractIds: Array<ContractId> = [
        `${faker.string.numeric()}:${faker.finance.ethereumAddress()}`,
        `${faker.string.numeric()}:${faker.finance.ethereumAddress()}`,
        `${faker.string.numeric()}:${faker.finance.ethereumAddress()}`,
      ];

      await service.removeContracts(contractIds);

      expect(mockNetworkService.delete).toBeCalledWith(
        `${tenderlyBaseUri}/api/v2/accounts/${tenderlyAccount}/projects/${tenderlyProject}/contracts`,
        {
          headers: {
            'X-Access-Key': tenderlyApiKey,
          },
          params: {
            contract_ids: contractIds,
          },
        },
      );
      expect(mockHttpErrorFactory.from).not.toHaveBeenCalled();
    });

    it('should forward error', async () => {
      mockNetworkService.delete.mockImplementation(() =>
        Promise.reject('Unexpected error'),
      );
      mockHttpErrorFactory.from.mockImplementation(
        () => new DataSourceError('Unexpected error'),
      );

      await service.removeContracts([]);

      expect(mockNetworkService.delete).toHaveBeenCalledTimes(1);
      expect(mockHttpErrorFactory.from).toBeCalledTimes(1);
    });
  });
});
