import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggerMiddleware.name);

  private formatRequestMessage = (req: Request) => `[==>] ${req.method} ${req.url}`;

  private formatResponseMessage = (res: Response) => {
    const contentLength = res.get('content-length') || '';
    const contentType = res.get('content-type') || '';
    return `[<==] ${res.statusCode} ${contentLength} ${contentType}`;
  };

  use(req: Request, res: Response, next: NextFunction) {
    this.logger.log(this.formatRequestMessage(req));

    res.on('finish', () => {
      const { statusCode } = res;

      if (statusCode <= 299) {
        this.logger.log(this.formatResponseMessage(res));
      } else if (statusCode >= 300 && statusCode <= 499) {
        this.logger.warn(this.formatResponseMessage(res));
      } else {
        this.logger.error(this.formatResponseMessage(res));
      }
    });

    next();
  }
}
