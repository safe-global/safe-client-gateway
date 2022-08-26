import { AxiosNetworkService } from './axios.network.service';
import { AxiosInstance } from 'axios';
import { HttpService } from '@nestjs/axios';
import { faker } from '@faker-js/faker';
import { NetworkRequest } from './entities/network.request.entity';
import { jest } from '@jest/globals';

const axiosRef = {
  get: jest.fn(),
} as unknown as AxiosInstance;

const httpService = {
  axiosRef: axiosRef,
} as unknown as HttpService;
const httpServiceMock = jest.mocked<HttpService>(httpService);
const axiosRefMock = jest.mocked<AxiosInstance>(httpServiceMock.axiosRef);

describe('AxiosNetworkService', () => {
  let target: AxiosNetworkService;

  beforeEach(async () => {
    jest.clearAllMocks();
    target = new AxiosNetworkService(httpServiceMock);
  });

  it(`get calls axios get`, async () => {
    const url = faker.internet.url();

    await target.get(url);

    expect(axiosRefMock.get).toBeCalledTimes(1);
    expect(axiosRefMock.get).toBeCalledWith(url, undefined);
  });

  it(`get calls axios get with request`, async () => {
    const url = faker.internet.url();
    const request = <NetworkRequest>{
      params: { some_query_param: 'query_param' },
    };

    await target.get(url, request);

    expect(axiosRefMock.get).toBeCalledTimes(1);
    expect(axiosRefMock.get).toBeCalledWith(url, request);
  });

  // TODO Property 'mockResolvedValueOnce' does not exist on type '<T = any, R = AxiosResponse<T, any>, D = any>(url: string, config?: AxiosRequestConfig<D>) => Promise<R>'
  // it(`get forwards error`, async () => {
  //   const url = faker.internet.url();
  //   axiosRefMock.get.mockResolvedValueOnce();
  //
  //   await target.get(url);
  //
  //   expect(axiosRefMock.get).toBeCalledTimes(1);
  //   expect(axiosRefMock.get).toBeCalledWith(url);
  // });
});
