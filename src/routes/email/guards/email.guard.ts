import { CanActivate, ExecutionContext, Inject, mixin } from '@nestjs/common';
import { verifyMessage } from 'viem';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';

export enum EmailGuardActionPrefix {
  Register = 'email-register',
  Delete = 'email-delete',
}

/**
 * The EmailGuard guard should be used on routes that require authenticated
 * actions for email addresses modification.
 *
 * This guard therefore validates if the message came from the specified account.
 *
 * The following message should be signed:
 * ${EmailGuardActionPrefix}-${chainId}-${safe}-${emailAddress}-${account}-${timestamp}
 *
 * (where ${} represents placeholder values for the respective data)
 *
 * To use this guard, 'EmailGuardActionPrefix' should be specific and the route should have:
 * - the 'chainId' declared as a parameter
 * - the 'safeAddress' declared as a parameter
 * - the 'emailAddress' as part of the JSON body (top level)
 * - the 'account' as part of the JSON body (top level)
 * - the 'signature' as part of the JSON body (top level) - see message format to be signed
 * - the 'timestamp' as part of the JSON body (top level)
 */
export const EmailGuard = (prefix: EmailGuardActionPrefix) => {
  class EmailRegistrationGuardMixin implements CanActivate {
    constructor(
      @Inject(LoggingService) readonly loggingService: ILoggingService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest();

      const chainId = request.params['chainId'];
      const safe = request.params['safeAddress'];
      const emailAddress = request.body['emailAddress'];
      const account = request.body['account'];
      const signature = request.body['signature'];
      const timestamp = request.body['timestamp'];

      // Required fields
      if (
        !chainId ||
        !safe ||
        !signature ||
        !emailAddress ||
        !account ||
        !timestamp
      )
        return false;

      const message = `${prefix}-${chainId}-${safe}-${emailAddress}-${account}-${timestamp}`;

      try {
        return await verifyMessage({
          address: account,
          message,
          signature,
        });
      } catch (e) {
        this.loggingService.debug(e);
        return false;
      }
    }
  }

  return mixin(EmailRegistrationGuardMixin);
};
