import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  NetworkRequestError,
  NetworkResponseError,
} from '@/datasources/network/entities/network.error.entity';
import { faker } from '@faker-js/faker';

describe('HttpErrorFactory', () => {
  const httpErrorFactory: HttpErrorFactory = new HttpErrorFactory();

  it('should create a DataSourceError with a Django error', async () => {
    const httpError = new NetworkResponseError(
      new URL(faker.internet.url()),
      {
        status: faker.internet.httpStatusCode({
          types: ['serverError', 'clientError'],
        }),
        statusText: faker.word.words(),
      } as Response,
      { nonFieldErrors: [faker.word.words()], message: faker.word.words() },
    );

    const actual = httpErrorFactory.from(httpError);

    expect(actual.code).toBe(httpError.response.status);
    expect(actual.message).toBe(
      (httpError.data as { nonFieldErrors: Array<string> }).nonFieldErrors[0],
    );
  });

  it('should create a DataSourceError with a standard error message if there is no Django error', async () => {
    const httpError = new NetworkResponseError(
      new URL(faker.internet.url()),
      {
        status: faker.internet.httpStatusCode({
          types: ['serverError', 'clientError'],
        }),
        statusText: faker.word.words(),
      } as Response,
      { message: faker.word.words() },
    );

    const actual = httpErrorFactory.from(httpError);

    expect(actual.code).toBe(httpError.response.status);
    expect(actual.message).toBe(
      (httpError.data as { message: string }).message,
    );
  });

  it('should create a DataSourceError with the statusText if there is no Django/standard error', async () => {
    const httpError = new NetworkResponseError(new URL(faker.internet.url()), {
      status: faker.internet.httpStatusCode({
        types: ['serverError', 'clientError'],
      }),
      statusText: faker.word.words(),
    } as Response);

    const actual = httpErrorFactory.from(httpError);

    expect(actual.code).toBe(httpError.response.status);
    expect(actual.message).toBe(httpError.response.statusText);
  });

  it('should create a DataSourceError with a standard error message if there is no Django/standard error or statusText', async () => {
    const httpError = new NetworkResponseError(new URL(faker.internet.url()), {
      status: faker.internet.httpStatusCode({
        types: ['serverError', 'clientError'],
      }),
    } as Response);

    const actual = httpErrorFactory.from(httpError);

    expect(actual.code).toBe(httpError.response.status);
    expect(actual.message).toBe('An error occurred');
  });

  it('should create a DataSourceError with 503 status when there is an error with the request URL', async () => {
    const httpError = new NetworkRequestError(null, undefined);

    const actual = httpErrorFactory.from(httpError);

    expect(actual.code).toBe(503);
    expect(actual.message).toBe('Service unavailable');
  });

  it('should create an DataSourceError with 503 status when there is an error with the request', async () => {
    const httpError = new NetworkRequestError(
      new URL(faker.internet.url()),
      new Error('Failed to fetch'),
    );

    const actual = httpErrorFactory.from(httpError);

    expect(actual.code).toBe(503);
    expect(actual.message).toBe('Service unavailable');
  });

  it('should create a DataSourceError with 503 status when an arbitrary error happens', async () => {
    const errMessage = 'Service unavailable';
    const randomError = new Error();

    const actual = httpErrorFactory.from(randomError);

    expect(actual.code).toBe(503);
    expect(actual.message).toBe(errMessage);
  });
});
