import { AxiosError, AxiosResponse } from 'axios';
import { HttpErrorFactory } from './http-error-factory';
import { HttpExceptionPayload } from './interfaces/http-exception-payload.interface';

describe('HttpErrorFactory', () => {
  const httpErrorFactory: HttpErrorFactory = new HttpErrorFactory();

  it('should throw an HttpException when a controlled http error is catch', async () => {
    const errMessage = 'testMessage';
    const errStatusCode = 400;
    const errArguments = ['arg1', 'arg2'];

    const httpError: AxiosError = new AxiosError(
      'Request failed with status code 400',
      'ERR_BAD_REQUEST',
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

  it('should throw an HttpException with 503 status when no response is received', async () => {
    const errMessage = 'Service unavailable';
    const httpError: AxiosError = new AxiosError(
      'someMessage',
      'ERR_BAD_REQUEST',
    );

    const err = httpErrorFactory.from(httpError);

    expect(err.message).toBe(errMessage);
    expect(err.getStatus()).toBe(503);
    expect(err.getResponse()['code']).toBe(503);
    expect(err.getResponse()['message']).toBe(errMessage);
  });

  it('should throw an HttpException with 503 status when an arbitrary error happens', async () => {
    const errMessage = 'Service unavailable';
    const randomError = new Error();

    const err = httpErrorFactory.from(randomError);
    expect(err.message).toBe(errMessage);
    expect(err.getStatus()).toBe(503);
    expect(err.getResponse()['code']).toBe(503);
    expect(err.getResponse()['message']).toBe(errMessage);
  });
});
