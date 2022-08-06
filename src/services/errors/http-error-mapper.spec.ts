import { HttpStatus } from '@nestjs/common';
import { AxiosError, AxiosResponse } from 'axios';
import { HttpErrorMapper } from './http-error-mapper';
import { HttpServiceErrorResponseData } from './interfaces/http-service-error-response.interface';

describe('HttpErrorMapper', () => {
  const errorMapper: HttpErrorMapper = new HttpErrorMapper();

  it('should throw an HttpException when a controlled http error is catch', async () => {
    const errMessage = 'testMessage';
    const errStatusCode = 400;
    const errArguments = ['arg1', 'arg2'];

    const httpError: AxiosError = new AxiosError(
      'Request failed with status code 400',
      'ERR_BAD_REQUEST',
      null,
      null,
      <AxiosResponse<HttpServiceErrorResponseData>>{
        data: { message: errMessage, arguments: errArguments },
        status: errStatusCode,
      },
    );

    try {
      errorMapper.mapError(httpError);
    } catch (err) {
      expect(err.message).toBe(errMessage);
      expect(err.status).toBe(errStatusCode);
      expect(err.response.statusCode).toBe(errStatusCode);
      expect(err.response.message).toBe(errMessage);
      expect(err.response.arguments).toBe(errArguments);
    }
  });

  it('should throw an HttpException with 503 status when no response is received', async () => {
    const httpError: AxiosError = new AxiosError(
      'Request failed with status code 400',
      'ERR_BAD_REQUEST',
    );

    try {
      errorMapper.mapError(httpError);
    } catch (err) {
      expect(err.message).toBe('Service unavailable');
      expect(err.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(err.response.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(err.response.message).toBe('Service unavailable');
    }
  });

  it('should throw an HttpException with 503 status when an arbitrary error happens', async () => {
    const randomError = new Error();

    try {
      errorMapper.mapError(randomError);
    } catch (err) {
      expect(err.message).toBe('Service unavailable');
      expect(err.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(err.response.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(err.response.message).toBe('Service unavailable');
    }
  });
});
