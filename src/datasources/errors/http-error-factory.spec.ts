import { faker } from '@faker-js/faker';
import { HttpErrorFactory } from './http-error-factory';
import {
  NetworkOtherError,
  NetworkRequestError,
  NetworkResponseError,
} from '../network/entities/network.error.entity';

describe('HttpErrorFactory', () => {
  const httpErrorFactory: HttpErrorFactory = new HttpErrorFactory();

  it('should create an HttpException when there is an error with the response', async () => {
    const httpError = new NetworkResponseError(
      { message: faker.random.words() },
      faker.internet.httpStatusCode({ types: ['serverError', 'clientError'] }),
    );

    const actual = httpErrorFactory.from(httpError);

    expect(actual.code).toBe(httpError.status);
    expect(actual.message).toBe(httpError.data.message);
  });

  it('should create an HttpException with 503 status when there is an error with the request', async () => {
    const httpError = new NetworkRequestError(undefined);

    const actual = httpErrorFactory.from(httpError);

    expect(actual.code).toBe(503);
    expect(actual.message).toBe('Service unavailable');
  });

  it('should create an HttpException with 503 status when there is an any other network error', async () => {
    const httpError = new NetworkOtherError('some other error');

    const actual = httpErrorFactory.from(httpError);

    expect(actual.code).toBe(503);
    expect(actual.message).toBe('Service unavailable');
  });

  it('should create an HttpException with 503 status when an arbitrary error happens', async () => {
    const errMessage = 'Service unavailable';
    const randomError = new Error();

    const actual = httpErrorFactory.from(randomError);

    expect(actual.code).toBe(503);
    expect(actual.message).toBe(errMessage);
  });
});
