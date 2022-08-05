import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AxiosError } from 'axios';

@Injectable()
export class HttpErrorMapper {
  mapError(err: AxiosError) {
    const defaultMessage = 'Service unavailable';

    if (err.response) {
      throw new HttpException(err.message, err.response.status);
    } else if (err.request) {
      throw new HttpException(defaultMessage, HttpStatus.SERVICE_UNAVAILABLE);
    } else {
      throw new HttpException(defaultMessage, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
