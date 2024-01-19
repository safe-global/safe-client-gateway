import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { ILoggingService } from '@/logging/logging.interface';
import {
  NetworkOtherError,
  NetworkResponseError,
  NetworkRequestError,
} from '@/datasources/network/entities/network.error.entity';
import { NetworkRequest } from '@/datasources/network/entities/network.request.entity';
import { FetchClient } from '@/datasources/network/fetch.client';
import { FetchNetworkService } from '@/datasources/network/fetch.network.service';

const fetchClient = jest.fn() as unknown as FetchClient;

const fetchClientMock = jest.mocked<FetchClient>(fetchClient);

const loggingService = {
  debug: jest.fn(),
} as unknown as ILoggingService;

const loggingServiceMock = jest.mocked(loggingService);

describe('FetchNetworkService', () => {
  let target: FetchNetworkService;

  beforeEach(async () => {
    jest.clearAllMocks();
    target = new FetchNetworkService(fetchClientMock, loggingServiceMock);
  });

  describe('GET requests', () => {
    it(`get uses GET method`, async () => {
      const url = faker.internet.url({ appendSlash: false });

      await target.get(url);

      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(`${url}/`, {
        method: 'GET',
      });
    });

    it(`get calls fetch get with request`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const request: NetworkRequest = {
        params: { some_query_param: 'query_param' },
        headers: {
          test: 'value',
        },
      };

      await target.get(url, request);

      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(
        `${url}/?some_query_param=query_param`,
        {
          method: 'GET',
          headers: {
            test: 'value',
          },
        },
      );
    });

    it(`get forwards unknown error as NetworkOtherError`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      (fetchClientMock as any).mockRejectedValueOnce(new Error('Fetch error'));

      await expect(target.get(url)).rejects.toThrow(
        new NetworkOtherError('Fetch error'),
      );

      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(`${url}/`, {
        method: 'GET',
      });
    });

    it(`get forwards response error as NetworkResponseError`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const error = {
        response: { data: 'data', status: 100 },
        request: {},
      };
      (fetchClientMock as any).mockRejectedValueOnce(error);

      await expect(target.get(url)).rejects.toThrow(
        new NetworkResponseError(error.response.data, error.response.status),
      );

      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(`${url}/`, {
        method: 'GET',
      });
    });

    it(`get forwards response error as NetworkRequestError`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const error = {
        request: 'some error',
      };
      (fetchClientMock as any).mockRejectedValueOnce(error);

      await expect(target.get(url)).rejects.toThrow(
        new NetworkRequestError(error.request),
      );

      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(`${url}/`, {
        method: 'GET',
      });
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
          pathname: faker.system.filePath(),
        },
      };
      (fetchClientMock as any).mockRejectedValueOnce(error);

      await expect(target.get(url)).rejects.toThrow(
        new NetworkRequestError(error.request),
      );

      expect(loggingService.debug).toHaveBeenCalledTimes(1);
      expect(loggingService.debug).toHaveBeenCalledWith({
        type: 'external_request',
        protocol: error.request.protocol,
        target_host: error.request.host,
        path: error.request.pathname,
        request_status: error.response.status,
        detail: error.response.statusText,
        response_time_ms: expect.any(Number),
      });
    });
  });

  describe('POST requests', () => {
    it(`post uses POST method`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { [faker.word.sample()]: faker.string.alphanumeric() };

      await target.post(url, data);

      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(`${url}/`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it(`post calls fetch with request`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { [faker.word.sample()]: faker.string.alphanumeric() };
      const request: NetworkRequest = {
        params: { some_query_param: 'query_param' },
        headers: {
          test: 'value',
        },
      };

      await target.post(url, data, request);

      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(
        `${url}/?some_query_param=query_param`,
        {
          method: 'POST',
          headers: {
            test: 'value',
          },
          body: JSON.stringify(data),
        },
      );
    });

    it(`post forwards unknown error as NetworkOtherError`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { [faker.word.sample()]: faker.string.alphanumeric() };
      (fetchClientMock as any).mockRejectedValueOnce(new Error('Fetch error'));

      await expect(target.post(url, data)).rejects.toThrow(
        new NetworkOtherError('Fetch error'),
      );

      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(`${url}/`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it(`post forwards response error as NetworkResponseError`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { [faker.word.sample()]: faker.string.alphanumeric() };
      const error = {
        response: { data: 'data', status: 100 },
        request: {},
      };
      (fetchClientMock as any).mockRejectedValueOnce(error);

      await expect(target.post(url, data)).rejects.toThrow(
        new NetworkResponseError(error.response.data, error.response.status),
      );

      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(`${url}/`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it(`post forwards response error as NetworkRequestError`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { [faker.word.sample()]: faker.string.alphanumeric() };
      const error = {
        request: 'some error',
      };
      (fetchClientMock as any).mockRejectedValueOnce(error);

      await expect(target.post(url, data)).rejects.toThrow(
        new NetworkRequestError(error.request),
      );

      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(`${url}/`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
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
          pathname: faker.system.filePath(),
        },
      };
      (fetchClientMock as any).mockRejectedValueOnce(error);

      await expect(target.post(url, {})).rejects.toThrow(
        new NetworkRequestError(error.request),
      );

      expect(loggingService.debug).toHaveBeenCalledTimes(1);
      expect(loggingService.debug).toHaveBeenCalledWith({
        type: 'external_request',
        protocol: error.request.protocol,
        target_host: error.request.host,
        path: error.request.pathname,
        request_status: error.response.status,
        detail: error.response.statusText,
        response_time_ms: expect.any(Number),
      });
    });
  });

  describe('DELETE requests', () => {
    it(`get uses DELETE method`, async () => {
      const url = faker.internet.url({ appendSlash: false });

      await target.delete(url);

      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(url, {
        method: 'DELETE',
      });
    });

    it(`delete forwards unknown error as NetworkOtherError`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { some_data: 'some_data' };
      fetchClientMock.mockRejectedValueOnce(new Error('Fetch error'));

      await expect(target.delete(url, data)).rejects.toThrow(
        new NetworkOtherError('Fetch error'),
      );

      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(url, {
        method: 'DELETE',
        body: JSON.stringify(data),
      });
    });

    it(`delete forwards response error as NetworkResponseError`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { some_data: 'some_data' };
      const error = {
        response: { data: 'data', status: 100 },
        request: {},
      };
      fetchClientMock.mockRejectedValueOnce(error);

      await expect(target.delete(url, data)).rejects.toThrow(
        new NetworkResponseError(error.response.data, error.response.status),
      );

      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(url, {
        method: 'DELETE',
        body: JSON.stringify(data),
      });
    });

    it(`delete forwards response error as NetworkRequestError`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { some_data: 'some_data' };
      const error = {
        request: 'some error',
      };
      fetchClientMock.mockRejectedValueOnce(error);

      await expect(target.delete(url, data)).rejects.toThrow(
        new NetworkRequestError(error.request),
      );

      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(url, {
        method: 'DELETE',
        body: JSON.stringify(data),
      });
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
          pathname: faker.system.filePath(),
        },
      };
      (fetchClientMock as any).mockRejectedValueOnce(error);

      await expect(target.delete(url)).rejects.toThrow(
        new NetworkRequestError(error.request),
      );

      expect(loggingService.debug).toHaveBeenCalledTimes(1);
      expect(loggingService.debug).toHaveBeenCalledWith({
        type: 'external_request',
        protocol: error.request.protocol,
        target_host: error.request.host,
        path: error.request.pathname,
        request_status: error.response.status,
        detail: error.response.statusText,
        response_time_ms: expect.any(Number),
      });
    });
  });
});
