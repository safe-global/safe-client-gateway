import { faker } from '@faker-js/faker';
import type { ILoggingService } from '@/logging/logging.interface';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { NetworkRequest } from '@/datasources/network/entities/network.request.entity';
import type { FetchClient } from '@/datasources/network/network.module';
import { FetchNetworkService } from '@/datasources/network/fetch.network.service';

const fetchClient = jest.fn();

const fetchClientMock: jest.MockedFunction<FetchClient> =
  jest.mocked(fetchClient);

const loggingService = {
  debug: jest.fn(),
  info: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const loggingServiceMock = jest.mocked(loggingService);

describe('FetchNetworkService', () => {
  let target: FetchNetworkService;

  beforeEach(() => {
    jest.resetAllMocks();
    target = new FetchNetworkService(fetchClientMock, loggingServiceMock);
  });

  describe('GET requests', () => {
    it(`get uses GET method`, async () => {
      const url = faker.internet.url({ appendSlash: false });

      await target.get({ url });

      const expectedUrl = `${url}/`;
      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(expectedUrl, {
        method: 'GET',
      });
      expect(loggingService.info).toHaveBeenCalledTimes(1);
      expect(loggingService.info).toHaveBeenCalledWith({
        type: 'EXTERNAL_REQUEST',
        method: 'GET',
        url: expectedUrl,
      });
    });

    it(`get calls fetch get with request`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const networkRequest: NetworkRequest = {
        params: { some_query_param: 'query_param' },
        headers: {
          test: 'value',
        },
      };

      await target.get({ url, networkRequest });

      const expectedUrl = `${url}/?some_query_param=query_param`;
      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(expectedUrl, {
        method: 'GET',
        headers: {
          test: 'value',
        },
      });
      expect(loggingService.info).toHaveBeenCalledTimes(1);
      expect(loggingService.info).toHaveBeenCalledWith({
        type: 'EXTERNAL_REQUEST',
        method: 'GET',
        url: expectedUrl,
      });
    });

    it(`get should remove empty strings, null and undefined query params from the request`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const networkRequest: NetworkRequest = {
        params: {
          boolean: true,
          falsy_boolean: false,
          integer: 1,
          falsy_integer: 0,
          string: 'string',
          // These should be removed
          falsy_string: '',
          null: null,
          undefined: undefined,
        },
      };

      await target.get({ url, networkRequest });

      const expectedUrl = `${url}/?boolean=true&falsy_boolean=false&integer=1&falsy_integer=0&string=string`;
      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(expectedUrl, {
        method: 'GET',
      });
      expect(loggingService.info).toHaveBeenCalledTimes(1);
      expect(loggingService.info).toHaveBeenCalledWith({
        type: 'EXTERNAL_REQUEST',
        method: 'GET',
        url: expectedUrl,
      });
    });

    it(`get logs response error`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const error = new NetworkResponseError(
        new URL(faker.internet.url()),
        {
          status: 100,
          statusText: 'Some error happened',
        } as Response,
        'data',
      );
      fetchClientMock.mockRejectedValueOnce(error);

      await expect(target.get({ url })).rejects.toThrow(error);

      expect(loggingService.info).toHaveBeenCalledTimes(1);
      expect(loggingService.info).toHaveBeenCalledWith({
        type: 'EXTERNAL_REQUEST',
        method: 'GET',
        url: `${url}/`,
      });
      expect(loggingService.debug).toHaveBeenCalledTimes(1);
      expect(loggingService.debug).toHaveBeenCalledWith({
        type: 'EXTERNAL_REQUEST',
        protocol: error.url.protocol,
        target_host: error.url.host,
        path: error.url.pathname,
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

      await target.post({ url, data });

      const expectedUrl = `${url}/`;
      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(expectedUrl, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      expect(loggingService.info).toHaveBeenCalledTimes(1);
      expect(loggingService.info).toHaveBeenCalledWith({
        type: 'EXTERNAL_REQUEST',
        method: 'POST',
        url: expectedUrl,
      });
    });

    it(`post calls fetch with request`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { [faker.word.sample()]: faker.string.alphanumeric() };
      const networkRequest: NetworkRequest = {
        params: { some_query_param: 'query_param' },
        headers: {
          test: 'value',
        },
      };

      await target.post({ url, data, networkRequest });

      const expectedUrl = `${url}/?some_query_param=query_param`;
      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(expectedUrl, {
        method: 'POST',
        headers: {
          test: 'value',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      expect(loggingService.info).toHaveBeenCalledTimes(1);
      expect(loggingService.info).toHaveBeenCalledWith({
        type: 'EXTERNAL_REQUEST',
        method: 'POST',
        url: expectedUrl,
      });
    });

    it(`post logs response error`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const error = new NetworkResponseError(
        new URL(faker.internet.url()),
        {
          status: 100,
          statusText: 'Some error happened',
        } as Response,
        'data',
      );
      fetchClientMock.mockRejectedValueOnce(error);

      await expect(target.post({ url, data: {} })).rejects.toThrow(error);

      expect(loggingService.info).toHaveBeenCalledTimes(1);
      expect(loggingService.info).toHaveBeenCalledWith({
        type: 'EXTERNAL_REQUEST',
        method: 'POST',
        url: `${url}/`,
      });
      expect(loggingService.debug).toHaveBeenCalledTimes(1);
      expect(loggingService.debug).toHaveBeenCalledWith({
        type: 'EXTERNAL_REQUEST',
        protocol: error.url.protocol,
        target_host: error.url.host,
        path: error.url.pathname,
        request_status: error.response.status,
        detail: error.response.statusText,
        response_time_ms: expect.any(Number),
      });
    });
  });

  describe('DELETE requests', () => {
    it(`delete uses DELETE method`, async () => {
      const url = faker.internet.url({ appendSlash: false });

      await target.delete({ url });

      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(`${url}/`, {
        method: 'DELETE',
      });
      expect(loggingService.info).toHaveBeenCalledTimes(1);
      expect(loggingService.info).toHaveBeenCalledWith({
        type: 'EXTERNAL_REQUEST',
        method: 'DELETE',
        url: `${url}/`,
      });
    });

    it(`delete calls fetch with request`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { [faker.word.sample()]: faker.string.alphanumeric() };
      const networkRequest: NetworkRequest = {
        params: { some_query_param: 'query_param' },
        headers: {
          test: 'value',
        },
      };

      await target.delete({ url, data, networkRequest });

      const expectedUrl = `${url}/?some_query_param=query_param`;
      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(expectedUrl, {
        method: 'DELETE',
        headers: {
          test: 'value',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      expect(loggingService.info).toHaveBeenCalledTimes(1);
      expect(loggingService.info).toHaveBeenCalledWith({
        type: 'EXTERNAL_REQUEST',
        method: 'DELETE',
        url: expectedUrl,
      });
    });

    it(`delete logs response error`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const error = new NetworkResponseError(
        new URL(faker.internet.url()),
        {
          status: 100,
          statusText: 'Some error happened',
        } as Response,
        'data',
      );
      fetchClientMock.mockRejectedValueOnce(error);

      await expect(target.delete({ url })).rejects.toThrow(error);

      expect(loggingService.debug).toHaveBeenCalledTimes(1);
      expect(loggingService.debug).toHaveBeenCalledWith({
        type: 'EXTERNAL_REQUEST',
        protocol: error.url.protocol,
        target_host: error.url.host,
        path: error.url.pathname,
        request_status: error.response.status,
        detail: error.response.statusText,
        response_time_ms: expect.any(Number),
      });
      expect(loggingService.info).toHaveBeenCalledTimes(1);
      expect(loggingService.info).toHaveBeenCalledWith({
        type: 'EXTERNAL_REQUEST',
        method: 'DELETE',
        url: `${url}/`,
      });
    });
  });
});
