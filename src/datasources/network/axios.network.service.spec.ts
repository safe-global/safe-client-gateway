import { AxiosNetworkService } from './axios.network.service';
import { Axios } from 'axios';
import { faker } from '@faker-js/faker';
import { NetworkRequest } from './entities/network.request.entity';
import { jest } from '@jest/globals';
import {
  NetworkOtherError,
  NetworkRequestError,
  NetworkResponseError,
} from './entities/network.error.entity';

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

  it(`get forwards unknown error as NetworkOtherError`, async () => {
    const url = faker.internet.url();
    (axiosMock.get as any).mockRejectedValueOnce(new Error('Axios error'));

    await expect(target.get(url)).rejects.toThrowError(
      new NetworkOtherError('Axios error'),
    );

    expect(axiosMock.get).toBeCalledTimes(1);
    expect(axiosMock.get).toBeCalledWith(url, undefined);
  });

  it(`get forwards response error as NetworkResponseError`, async () => {
    const url = faker.internet.url();
    const error = {
      response: { data: 'data', status: 100 },
    };
    (axiosMock.get as any).mockRejectedValueOnce(error);

    await expect(target.get(url)).rejects.toThrowError(
      new NetworkResponseError(error.response.data, error.response.status),
    );

    expect(axiosMock.get).toBeCalledTimes(1);
    expect(axiosMock.get).toBeCalledWith(url, undefined);
  });

  it(`get forwards response error as NetworkRequestError`, async () => {
    const url = faker.internet.url();
    const error = {
      request: 'some error',
    };
    (axiosMock.get as any).mockRejectedValueOnce(error);

    await expect(target.get(url)).rejects.toThrowError(
      new NetworkRequestError(error.request),
    );

    expect(axiosMock.get).toBeCalledTimes(1);
    expect(axiosMock.get).toBeCalledWith(url, undefined);
  });
});
