import { faker } from '@faker-js/faker';
import type { ILoggingService } from '@/logging/logging.interface';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { NetworkRequest } from '@/datasources/network/entities/network.request.entity';
import type { FetchClient } from '@/datasources/network/network.module';
import { FetchNetworkService } from '@/datasources/network/fetch.network.service';
import { rawify } from '@/validation/entities/raw.entity';

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
      expect(fetchClientMock).toHaveBeenCalledWith(
        expectedUrl,
        {
          method: 'GET',
          headers: {},
        },
        undefined,
        undefined,
      );
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
      expect(fetchClientMock).toHaveBeenCalledWith(
        expectedUrl,
        {
          method: 'GET',
          headers: {
            test: 'value',
          },
        },
        undefined,
        undefined,
      );
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
      expect(fetchClientMock).toHaveBeenCalledWith(
        expectedUrl,
        {
          method: 'GET',
          headers: {},
        },
        undefined,
        undefined,
      );
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

    it(`get uses custom timeout when provided`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const timeout = faker.number.int({ min: 1000, max: 10000 });
      const networkRequest: NetworkRequest = {
        timeout,
      };
      fetchClientMock.mockResolvedValueOnce({
        status: 200,
        data: rawify({ data: 'some_data' }),
      });

      await target.get({ url, networkRequest });

      const expectedUrl = `${url}/`;
      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(
        expectedUrl,
        {
          method: 'GET',
          headers: {},
        },
        timeout,
        undefined,
      );
    });

    it(`get does not include timeout when timeout is not provided`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      fetchClientMock.mockResolvedValueOnce({
        status: 200,
        data: rawify({ data: 'some_data' }),
      });

      await target.get({ url });

      const expectedUrl = `${url}/`;
      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(
        expectedUrl,
        {
          method: 'GET',
          headers: {},
        },
        undefined,
        undefined,
      );
      // Verify timeout is not passed as third argument
      const callArgs = fetchClientMock.mock.calls[0];
      expect(callArgs[2]).toBeUndefined();
    });
  });

  describe('POST requests', () => {
    it(`post uses POST method`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { [faker.word.sample()]: faker.string.alphanumeric() };

      await target.post({ url, data });

      const expectedUrl = `${url}/`;
      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(
        expectedUrl,
        {
          method: 'POST',
          body: JSON.stringify(data),
          headers: {
            'Content-Type': 'application/json',
          },
        },
        undefined,
        undefined,
      );
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
      expect(fetchClientMock).toHaveBeenCalledWith(
        expectedUrl,
        {
          method: 'POST',
          headers: {
            test: 'value',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        },
        undefined,
        undefined,
      );
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

    it(`post uses custom timeout when provided`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { [faker.word.sample()]: faker.string.alphanumeric() };
      const timeout = faker.number.int({ min: 1000, max: 10000 });
      const networkRequest: NetworkRequest = {
        timeout,
      };
      fetchClientMock.mockResolvedValueOnce({
        status: 200,
        data: rawify({ data: 'some_data' }),
      });

      await target.post({ url, data, networkRequest });

      const expectedUrl = `${url}/`;
      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(
        expectedUrl,
        {
          method: 'POST',
          body: JSON.stringify(data),
          headers: {
            'Content-Type': 'application/json',
          },
        },
        timeout,
        undefined,
      );
    });

    it(`post does not include timeout when timeout is not provided`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { [faker.word.sample()]: faker.string.alphanumeric() };
      fetchClientMock.mockResolvedValueOnce({
        status: 200,
        data: rawify({ data: 'some_data' }),
      });

      await target.post({ url, data });

      const expectedUrl = `${url}/`;
      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(
        expectedUrl,
        {
          method: 'POST',
          body: JSON.stringify(data),
          headers: {
            'Content-Type': 'application/json',
          },
        },
        undefined,
        undefined,
      );
      // Verify timeout is not passed as third argument
      const callArgs = fetchClientMock.mock.calls[0];
      expect(callArgs[2]).toBeUndefined();
    });
  });

  describe('DELETE requests', () => {
    it(`delete uses DELETE method`, async () => {
      const url = faker.internet.url({ appendSlash: false });

      await target.delete({ url });

      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(
        `${url}/`,
        {
          method: 'DELETE',
          headers: {},
        },
        undefined,
        undefined,
      );
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
      expect(fetchClientMock).toHaveBeenCalledWith(
        expectedUrl,
        {
          method: 'DELETE',
          headers: {
            test: 'value',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        },
        undefined,
        undefined,
      );
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

    it(`delete uses custom timeout when provided`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      const data = { [faker.word.sample()]: faker.string.alphanumeric() };
      const timeout = faker.number.int({ min: 1000, max: 10000 });
      const networkRequest: NetworkRequest = {
        timeout,
      };
      fetchClientMock.mockResolvedValueOnce({
        status: 200,
        data: rawify({ data: 'some_data' }),
      });

      await target.delete({ url, data, networkRequest });

      const expectedUrl = `${url}/`;
      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(
        expectedUrl,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        },
        timeout,
        undefined,
      );
    });

    it(`delete does not include timeout when timeout is not provided`, async () => {
      const url = faker.internet.url({ appendSlash: false });
      fetchClientMock.mockResolvedValueOnce({
        status: 200,
        data: rawify({ data: 'some_data' }),
      });

      await target.delete({ url });

      const expectedUrl = `${url}/`;
      expect(fetchClientMock).toHaveBeenCalledTimes(1);
      expect(fetchClientMock).toHaveBeenCalledWith(
        expectedUrl,
        {
          method: 'DELETE',
          headers: {},
        },
        undefined,
        undefined,
      );
      // Verify timeout is not passed as third argument
      const callArgs = fetchClientMock.mock.calls[0];
      expect(callArgs[2]).toBeUndefined();
    });
  });

  describe('Header merging with defaultHeaders', () => {
    it('should merge default headers with request headers (request headers take precedence)', async () => {
      const defaultHeaders = {
        Authorization: 'Bearer default-token',
        'X-Custom': 'default',
      };
      const targetWithHeaders = new FetchNetworkService(
        fetchClientMock,
        loggingServiceMock,
        defaultHeaders,
      );
      const url = faker.internet.url({ appendSlash: false });
      const requestHeaders = { 'X-Custom': 'request-value' };

      fetchClientMock.mockResolvedValueOnce({
        status: 200,
        data: rawify({}),
      });

      await targetWithHeaders.get({
        url,
        networkRequest: { headers: requestHeaders },
      });

      expect(fetchClientMock).toHaveBeenCalledWith(
        expect.any(String),
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer default-token',
            'X-Custom': 'request-value', // request header overrides default
          },
        },
        undefined,
        undefined,
      );
    });

    it('should use default headers when no request headers provided', async () => {
      const defaultHeaders = { Authorization: 'Bearer default-token' };
      const targetWithHeaders = new FetchNetworkService(
        fetchClientMock,
        loggingServiceMock,
        defaultHeaders,
      );
      const url = faker.internet.url({ appendSlash: false });

      fetchClientMock.mockResolvedValueOnce({
        status: 200,
        data: rawify({}),
      });

      await targetWithHeaders.get({ url });

      expect(fetchClientMock).toHaveBeenCalledWith(
        expect.any(String),
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer default-token',
          },
        },
        undefined,
        undefined,
      );
    });

    it('should merge default headers with method headers (POST Content-Type)', async () => {
      const defaultHeaders = { Authorization: 'Bearer default-token' };
      const targetWithHeaders = new FetchNetworkService(
        fetchClientMock,
        loggingServiceMock,
        defaultHeaders,
      );
      const url = faker.internet.url({ appendSlash: false });
      const data = { foo: 'bar' };

      fetchClientMock.mockResolvedValueOnce({
        status: 200,
        data: rawify({}),
      });

      await targetWithHeaders.post({ url, data });

      expect(fetchClientMock).toHaveBeenCalledWith(
        expect.any(String),
        {
          method: 'POST',
          body: JSON.stringify(data),
          headers: {
            Authorization: 'Bearer default-token',
            'Content-Type': 'application/json',
          },
        },
        undefined,
        undefined,
      );
    });

    it('should handle empty default headers object', async () => {
      const targetWithEmptyHeaders = new FetchNetworkService(
        fetchClientMock,
        loggingServiceMock,
        {},
      );
      const url = faker.internet.url({ appendSlash: false });
      const requestHeaders = { 'X-Custom': 'value' };

      fetchClientMock.mockResolvedValueOnce({
        status: 200,
        data: rawify({}),
      });

      await targetWithEmptyHeaders.get({
        url,
        networkRequest: { headers: requestHeaders },
      });

      expect(fetchClientMock).toHaveBeenCalledWith(
        expect.any(String),
        {
          method: 'GET',
          headers: {
            'X-Custom': 'value',
          },
        },
        undefined,
        undefined,
      );
    });

    it('should handle undefined default headers', async () => {
      const targetNoHeaders = new FetchNetworkService(
        fetchClientMock,
        loggingServiceMock,
      );
      const url = faker.internet.url({ appendSlash: false });
      const requestHeaders = { 'X-Custom': 'value' };

      fetchClientMock.mockResolvedValueOnce({
        status: 200,
        data: rawify({}),
      });

      await targetNoHeaders.get({
        url,
        networkRequest: { headers: requestHeaders },
      });

      expect(fetchClientMock).toHaveBeenCalledWith(
        expect.any(String),
        {
          method: 'GET',
          headers: {
            'X-Custom': 'value',
          },
        },
        undefined,
        undefined,
      );
    });

    it('should apply correct precedence: request > method > default', async () => {
      const defaultHeaders = {
        Authorization: 'Bearer default-token',
        'Content-Type': 'default-type',
        'X-Default': 'default',
      };
      const targetWithHeaders = new FetchNetworkService(
        fetchClientMock,
        loggingServiceMock,
        defaultHeaders,
      );
      const url = faker.internet.url({ appendSlash: false });
      const data = { foo: 'bar' };
      const requestHeaders = { 'Content-Type': 'text/plain' };

      fetchClientMock.mockResolvedValueOnce({
        status: 200,
        data: rawify({}),
      });

      await targetWithHeaders.post({
        url,
        data,
        networkRequest: { headers: requestHeaders },
      });

      expect(fetchClientMock).toHaveBeenCalledWith(
        expect.any(String),
        {
          method: 'POST',
          body: JSON.stringify(data),
          headers: {
            Authorization: 'Bearer default-token', // from default
            'X-Default': 'default', // from default
            'Content-Type': 'text/plain', // request overrides method and default
          },
        },
        undefined,
        undefined,
      );
    });
  });
});
