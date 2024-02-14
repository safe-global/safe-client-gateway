import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';

/**
 * The PreExecutionLogGuard guard outputs a log line containing parts of the request data.
 * Currently only the request path is being logged.
 */
@Injectable()
export class PreExecutionLogGuard implements CanActivate {
  private static readonly PRE_EXECUTION_LOGGING_DETAIL = 'pre-execution-log';

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    this.loggingService.info({
      type: PreExecutionLogGuard.PRE_EXECUTION_LOGGING_DETAIL,
      route: request.route.path,
    });
    return true;
  }
}
