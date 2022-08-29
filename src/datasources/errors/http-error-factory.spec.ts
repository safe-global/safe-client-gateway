import { AxiosError, AxiosResponse } from 'axios';
import { faker } from '@faker-js/faker';
import { HttpErrorFactory } from './http-error-factory';
import { HttpExceptionPayload } from './interfaces/http-exception-payload.interface';

describe('HttpErrorFactory', () => {
  const httpErrorFactory: HttpErrorFactory = new HttpErrorFactory();

  it('should create an HttpException when a controlled http error is catch', async () => {
    const errMessage = faker.random.words();
    const errStatusCode = faker.internet.httpStatusCode();
    const errArguments = faker.datatype.array();

    const httpError: AxiosError = new AxiosError(
      faker.random.words(),
      faker.random.word(),
      undefined,
      null,
      <AxiosResponse<HttpExceptionPayload>>{
        data: { message: errMessage, arguments: errArguments },
        status: errStatusCode,
      },
    );

    const err = httpErrorFactory.from(httpError);

    expect(err.message).toBe(errMessage);
    expect(err.getStatus()).toBe(errStatusCode);
    expect(err.getResponse()['code']).toBe(errStatusCode);
    expect(err.getResponse()['message']).toBe(errMessage);
    expect(err.getResponse()['arguments']).toBe(errArguments);
  });

  it('should create an HttpException with 500 status when receiving an undefined status', async () => {
    const errMessage = faker.random.words();

    const httpError: AxiosError = new AxiosError(
      faker.random.words(),
      faker.random.word(),
      undefined,
      null,
      <AxiosResponse<HttpExceptionPayload>>{
        data: { message: errMessage },
      },
    );

    const err = httpErrorFactory.from(httpError);

    expect(err.message).toBe(errMessage);
    expect(err.getStatus()).toBe(500);
    expect(err.getResponse()['code']).toBe(500);
    expect(err.getResponse()['message']).toBe(errMessage);
  });

  it('should create an HttpException with 503 status when no response is received', async () => {
    const errMessage = 'Service unavailable';
    const httpError: AxiosError = new AxiosError(
      faker.random.words(),
      faker.random.word(),
    );

    const err = httpErrorFactory.from(httpError);

    expect(err.message).toBe(errMessage);
    expect(err.getStatus()).toBe(503);
    expect(err.getResponse()['code']).toBe(503);
    expect(err.getResponse()['message']).toBe(errMessage);
  });

  it('should create an HttpException with 503 status when an arbitrary error happens', async () => {
    const errMessage = 'Service unavailable';
    const randomError = new Error();

    const err = httpErrorFactory.from(randomError);
    expect(err.message).toBe(errMessage);
    expect(err.getStatus()).toBe(503);
    expect(err.getResponse()['code']).toBe(503);
    expect(err.getResponse()['message']).toBe(errMessage);
  });
});
