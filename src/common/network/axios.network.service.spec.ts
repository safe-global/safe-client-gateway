import { AxiosNetworkService } from './axios.network.service';
import { Axios } from 'axios';
import { faker } from '@faker-js/faker';
import { NetworkRequest } from './entities/network.request.entity';
import { jest } from '@jest/globals';

const axios = {
  get: jest.fn(),
} as unknown as Axios;

const axiosMock = jest.mocked<Axios>(axios);

describe('AxiosNetworkService', () => {
  let target: AxiosNetworkService;

  beforeEach(async () => {
    jest.clearAllMocks();
    target = new AxiosNetworkService(axiosMock);
  });

  it(`get calls axios get`, async () => {
    const url = faker.internet.url();

    await target.get(url);

    expect(axiosMock.get).toBeCalledTimes(1);
    expect(axiosMock.get).toBeCalledWith(url, undefined);
  });

  it(`get calls axios get with request`, async () => {
    const url = faker.internet.url();
    const request = <NetworkRequest>{
      params: { some_query_param: 'query_param' },
    };

    await target.get(url, request);

    expect(axiosMock.get).toBeCalledTimes(1);
    expect(axiosMock.get).toBeCalledWith(url, request);
  });

  it(`get forwards error`, async () => {
    const url = faker.internet.url();
    (axiosMock.get as any).mockRejectedValueOnce(new Error('Axios error'));

    await expect(target.get(url)).rejects.toThrow('Axios error');

    expect(axiosMock.get).toBeCalledTimes(1);
    expect(axiosMock.get).toBeCalledWith(url, undefined);
  });
});
