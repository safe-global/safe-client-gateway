import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { formatRouteLogMessage } from '@/logging/utils';

/**
 * The PreExecutionLogGuard guard outputs a log line containing the request data.
 */
@Injectable()
export class PreExecutionLogGuard implements CanActivate {
  private readonly PRE_EXECUTION_LOGGING_DETAIL = 'pre-execution-log';
  private readonly PRE_EXECUTION_LOGGING_STATUS = 202;

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const startTimeMs: number = performance.now();
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();

    this.loggingService.info(
      formatRouteLogMessage(
        this.PRE_EXECUTION_LOGGING_STATUS,
        request,
        startTimeMs,
        this.PRE_EXECUTION_LOGGING_DETAIL,
      ),
    );

    return true;
  }
}
