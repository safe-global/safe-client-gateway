import { HttpException, HttpStatus } from '@nestjs/common';

export const promiseWithTimeout = <T>(
  promise: Promise<T>,
  timeout: number,
): Promise<T | undefined> => {
  let timeoutId: NodeJS.Timeout;

  return Promise.race<T | undefined>([
    promise,
    new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new PromiseTimeoutError('Promise timed out!', 500)),
        timeout,
      );
    }),
  ]).finally(() => {
    clearTimeout(timeoutId);
  });
};

export class PromiseTimeoutError extends HttpException {
  //
  public constructor(
    message: string,
    statusCode: number = HttpStatus.SERVICE_UNAVAILABLE,
  ) {
    super(message, statusCode);
  }
}
