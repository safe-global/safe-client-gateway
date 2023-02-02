import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import * as winston from 'winston';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    winston.debug('[==>] %s %s', req.method, req.url);

    const contentLength = res.get('content-length') || '';
    const contentType = res.get('content-type') || '';

    const responseMessage: [string, number, string, string] = [
      '[<==] %d %s %s',
      res.statusCode,
      contentLength,
      contentType,
    ];

    res.on('finish', () => {
      const { statusCode } = res;
      if (statusCode < 400) {
        winston.info(...responseMessage);
      } else if (statusCode >= 400 && statusCode < 500) {
        winston.warn(...responseMessage);
      } else winston.error(...responseMessage);
    });

    next();
  }
}
