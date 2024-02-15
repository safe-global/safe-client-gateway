import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { GelatoApi } from '@/datasources/relay-api/gelato-api.service';
import { faker } from '@faker-js/faker';
import { INetworkService } from '@/datasources/network/network.service.interface';
import { Hex } from 'viem';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';

const mockNetworkService = jest.mocked({
  post: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

describe('GelatoApi', () => {
  let target: GelatoApi;
  let fakeConfigurationService: FakeConfigurationService;
  let baseUri: string;
  let httpErrorFactory: HttpErrorFactory;

  beforeEach(async () => {
    jest.resetAllMocks();

    httpErrorFactory = new HttpErrorFactory();
    fakeConfigurationService = new FakeConfigurationService();
    baseUri = faker.internet.url({ appendSlash: false });
    fakeConfigurationService.set('relay.baseUri', baseUri);

    target = new GelatoApi(
      mockNetworkService,
      fakeConfigurationService,
      httpErrorFactory,
    );
  });

  it('should error if baseUri is not defined', () => {
    const fakeConfigurationService = new FakeConfigurationService();
    const httpErrorFactory = new HttpErrorFactory();

    expect(
      () =>
        new GelatoApi(
          mockNetworkService,
          fakeConfigurationService,
          httpErrorFactory,
        ),
    ).toThrow();
  });

  describe('relay', () => {
    it('should relay the payload', async () => {
      const chainId = faker.string.numeric();
      const address = faker.finance.ethereumAddress() as Hex;
      const data = faker.string.hexadecimal() as Hex;
      const apiKey = faker.string.sample();
      const taskId = faker.string.uuid();
      fakeConfigurationService.set(`relay.apiKey.${chainId}`, apiKey);
      mockNetworkService.post.mockResolvedValueOnce({
        status: 200,
        data: {
          taskId,
        },
      });

      await target.relay({
        chainId,
        to: address,
        data,
      });

      expect(mockNetworkService.post).toHaveBeenCalledWith(
        `${baseUri}/relays/v2/sponsored-call`,
        {
          sponsorApiKey: apiKey,
          chainId,
          target: address,
          data,
        },
      );
    });

    it('should add a gas buffer if a gas limit is provided', async () => {
      const chainId = faker.string.numeric();
      const address = faker.finance.ethereumAddress() as Hex;
      const data = faker.string.hexadecimal() as Hex;
      const gasLimit = faker.string.numeric();
      const apiKey = faker.string.sample();
      const taskId = faker.string.uuid();
      fakeConfigurationService.set(`relay.apiKey.${chainId}`, apiKey);
      mockNetworkService.post.mockResolvedValueOnce({
        status: 200,
        data: {
          taskId,
        },
      });

      await target.relay({
        chainId,
        to: address,
        data,
        gasLimit,
      });

      expect(mockNetworkService.post).toHaveBeenCalledWith(
        `${baseUri}/relays/v2/sponsored-call`,
        {
          sponsorApiKey: apiKey,
          chainId,
          target: address,
          data,
          gasLimit: (BigInt(gasLimit) + BigInt(150_000)).toString(),
        },
      );
    });

    it('should throw if there is no API key preset', async () => {
      const chainId = faker.string.numeric();
      const address = faker.finance.ethereumAddress() as Hex;
      const data = faker.string.hexadecimal() as Hex;

      await expect(
        target.relay({
          chainId,
          to: address,
          data,
        }),
      ).rejects.toThrow();
    });

    it('should forward error', async () => {
      const chainId = faker.string.numeric();
      const address = faker.finance.ethereumAddress() as Hex;
      const data = faker.string.hexadecimal() as Hex;
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const apiKey = faker.string.sample();
      const error = new NetworkResponseError(
        new URL(`${baseUri}/relays/v2/sponsored-call`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      fakeConfigurationService.set(`relay.apiKey.${chainId}`, apiKey);
      mockNetworkService.post.mockRejectedValueOnce(error);

      await expect(
        target.relay({
          chainId,
          to: address,
          data,
        }),
      ).rejects.toThrow(new DataSourceError('Unexpected error', status));
    });
  });
});
