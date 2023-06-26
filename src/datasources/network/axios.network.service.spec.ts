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
import { ILoggingService } from '../../logging/logging.interface';

const axios = {
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
} as unknown as Axios;

const axiosMock = jest.mocked<Axios>(axios);

const loggingService = {
  debug: jest.fn(),
} as unknown as ILoggingService;

const loggingServiceMock = jest.mocked(loggingService);

describe('AxiosNetworkService', () => {
  let target: AxiosNetworkService;

  beforeEach(async () => {
    jest.clearAllMocks();
    target = new AxiosNetworkService(axiosMock, loggingServiceMock);
  });

  describe('GET requests', () => {
    it(`get calls axios get`, async () => {
      const url = faker.internet.url({ appendSlash: false });

      await target.get(url);

      expect(axiosMock.get).toBeCalledTimes(1);
      expect(axiosMock.get).toBeCalledWith(url, undefined);
    });

    it(`get calls axios get with request`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const request = <NetworkRequest>{
        params: { some_query_param: 'query_param' },
      };

      await target.get(url, request);

      expect(axiosMock.get).toBeCalledTimes(1);
      expect(axiosMock.get).toBeCalledWith(url, request);
    });

    it(`get forwards unknown error as NetworkOtherError`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      (axiosMock.get as any).mockRejectedValueOnce(new Error('Axios error'));

      await expect(target.get(url)).rejects.toThrowError(
        new NetworkOtherError('Axios error'),
      );

      expect(axiosMock.get).toBeCalledTimes(1);
      expect(axiosMock.get).toBeCalledWith(url, undefined);
    });

    it(`get forwards response error as NetworkResponseError`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const error = {
        response: { data: 'data', status: 100 },
        request: {},
      };
      (axiosMock.get as any).mockRejectedValueOnce(error);

      await expect(target.get(url)).rejects.toThrowError(
        new NetworkResponseError(error.response.data, error.response.status),
      );

      expect(axiosMock.get).toBeCalledTimes(1);
      expect(axiosMock.get).toBeCalledWith(url, undefined);
    });

    it(`get forwards response error as NetworkRequestError`, async () => {
      const url = faker.internet.url({ appendSlash: false });
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

    it(`get logs response error`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const error = {
        response: {
          data: 'data',
          status: 100,
          statusText: 'Some error happened',
        },
        request: {
          protocol: faker.internet.protocol(),
          host: faker.internet.domainName(),
          path: faker.system.filePath(),
        },
      };
      (axiosMock.get as any).mockRejectedValueOnce(error);

      await expect(target.get(url)).rejects.toThrowError(
        new NetworkRequestError(error.request),
      );

      expect(loggingService.debug).toBeCalledTimes(1);
      expect(loggingService.debug).toBeCalledWith({
        type: 'external_request',
        protocol: error.request.protocol,
        target_host: error.request.host,
        path: error.request.path,
        request_status: error.response.status,
        detail: error.response.statusText,
        response_time_ms: expect.any(Number),
      });
    });
  });

  describe('POST requests', () => {
    it(`post calls axios post`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { [faker.word.sample()]: faker.string.alphanumeric() };

      await target.post(url, data);

      expect(axiosMock.post).toBeCalledTimes(1);
      expect(axiosMock.post).toBeCalledWith(url, data, undefined);
    });

    it(`post calls axios post with request`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { [faker.word.sample()]: faker.string.alphanumeric() };
      const request = <NetworkRequest>{
        params: { some_query_param: 'query_param' },
      };

      await target.post(url, data, request);

      expect(axiosMock.post).toBeCalledTimes(1);
      expect(axiosMock.post).toBeCalledWith(url, data, request);
    });

    it(`post forwards unknown error as NetworkOtherError`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { [faker.word.sample()]: faker.string.alphanumeric() };
      (axiosMock.post as any).mockRejectedValueOnce(new Error('Axios error'));

      await expect(target.post(url, data)).rejects.toThrowError(
        new NetworkOtherError('Axios error'),
      );

      expect(axiosMock.post).toBeCalledTimes(1);
      expect(axiosMock.post).toBeCalledWith(url, data, undefined);
    });

    it(`post forwards response error as NetworkResponseError`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { [faker.word.sample()]: faker.string.alphanumeric() };
      const error = {
        response: { data: 'data', status: 100 },
        request: {},
      };
      (axiosMock.post as any).mockRejectedValueOnce(error);

      await expect(target.post(url, data)).rejects.toThrowError(
        new NetworkResponseError(error.response.data, error.response.status),
      );

      expect(axiosMock.post).toBeCalledTimes(1);
      expect(axiosMock.post).toBeCalledWith(url, data, undefined);
    });

    it(`post forwards response error as NetworkRequestError`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { [faker.word.sample()]: faker.string.alphanumeric() };
      const error = {
        request: 'some error',
      };
      (axiosMock.post as any).mockRejectedValueOnce(error);

      await expect(target.post(url, data)).rejects.toThrowError(
        new NetworkRequestError(error.request),
      );

      expect(axiosMock.post).toBeCalledTimes(1);
      expect(axiosMock.post).toBeCalledWith(url, data, undefined);
    });

    it(`post logs response error`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const error = {
        response: {
          data: 'data',
          status: 100,
          statusText: 'Some error happened',
        },
        request: {
          protocol: faker.internet.protocol(),
          host: faker.internet.domainName(),
          path: faker.system.filePath(),
        },
      };
      (axiosMock.post as any).mockRejectedValueOnce(error);

      await expect(target.post(url, {})).rejects.toThrowError(
        new NetworkRequestError(error.request),
      );

      expect(loggingService.debug).toBeCalledTimes(1);
      expect(loggingService.debug).toBeCalledWith({
        type: 'external_request',
        protocol: error.request.protocol,
        target_host: error.request.host,
        path: error.request.path,
        request_status: error.response.status,
        detail: error.response.statusText,
        response_time_ms: expect.any(Number),
      });
    });
  });

  describe('DELETE requests', () => {
    it(`delete calls axios delete`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { some_data: 'some_data' };

      await target.delete(url, data);

      expect(axiosMock.delete).toBeCalledTimes(1);
      expect(axiosMock.delete).toBeCalledWith(url, { data: data });
    });

    it(`delete forwards unknown error as NetworkOtherError`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { some_data: 'some_data' };
      axiosMock.delete.mockRejectedValueOnce(new Error('Axios error'));

      await expect(target.delete(url, data)).rejects.toThrowError(
        new NetworkOtherError('Axios error'),
      );

      expect(axiosMock.delete).toBeCalledTimes(1);
      expect(axiosMock.delete).toBeCalledWith(url, { data: data });
    });

    it(`delete forwards response error as NetworkResponseError`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { some_data: 'some_data' };
      const error = {
        response: { data: 'data', status: 100 },
        request: {},
      };
      axiosMock.delete.mockRejectedValueOnce(error);

      await expect(target.delete(url, data)).rejects.toThrowError(
        new NetworkResponseError(error.response.data, error.response.status),
      );

      expect(axiosMock.delete).toBeCalledTimes(1);
      expect(axiosMock.delete).toBeCalledWith(url, { data: data });
    });

    it(`delete forwards response error as NetworkRequestError`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { some_data: 'some_data' };
      const error = {
        request: 'some error',
      };
      axiosMock.delete.mockRejectedValueOnce(error);

      await expect(target.delete(url, data)).rejects.toThrowError(
        new NetworkRequestError(error.request),
      );

      expect(axiosMock.delete).toBeCalledTimes(1);
      expect(axiosMock.delete).toBeCalledWith(url, { data: data });
    });

    it(`delete logs response error`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const error = {
        response: {
          data: 'data',
          status: 100,
          statusText: 'Some error happened',
        },
        request: {
          protocol: faker.internet.protocol(),
          host: faker.internet.domainName(),
          path: faker.system.filePath(),
        },
      };
      (axiosMock.delete as any).mockRejectedValueOnce(error);

      await expect(target.delete(url)).rejects.toThrowError(
        new NetworkRequestError(error.request),
      );

      expect(loggingService.debug).toBeCalledTimes(1);
      expect(loggingService.debug).toBeCalledWith({
        type: 'external_request',
        protocol: error.request.protocol,
        target_host: error.request.host,
        path: error.request.path,
        request_status: error.response.status,
        detail: error.response.statusText,
        response_time_ms: expect.any(Number),
      });
    });
  });
});
