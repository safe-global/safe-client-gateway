// SPDX-License-Identifier: FSL-1.1-MIT
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IEmailService } from '@/modules/email/ses/domain/interfaces/email-service.interface';
import {
  PermanentEmailError,
  TransientEmailError,
} from '@/modules/email/ses/domain/errors/email.errors';
import { Inject, Injectable } from '@nestjs/common';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

@Injectable()
export class SesEmailService implements IEmailService {
  private readonly client: SESv2Client;
  private readonly fromAddress: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    const fromEmail = this.configurationService.getOrThrow<string>(
      'email.ses.fromEmail',
    );
    const fromName =
      this.configurationService.getOrThrow<string>('email.ses.fromName');

    this.client = new SESv2Client({});
    const escapedFromName = fromName
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
    this.fromAddress = `"${escapedFromName}" <${fromEmail}>`;
  }

  async send(args: {
    to: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
  }): Promise<void> {
    const command = new SendEmailCommand({
      Destination: { ToAddresses: [args.to] },
      Content: {
        Simple: {
          Subject: { Data: args.subject },
          Body: {
            Html: { Data: args.htmlBody },
            ...(args.textBody && { Text: { Data: args.textBody } }),
          },
        },
      },
      FromEmailAddress: this.fromAddress,
    });

    try {
      await this.client.send(command);
    } catch (error) {
      this.classifyAndThrow(error);
    }
  }

  private classifyAndThrow(error: unknown): never {
    const name = (error as { name?: string })?.name;
    const message = (error as Error)?.message ?? 'Unknown SES error';

    switch (name) {
      // Transient: retryable SES + network errors
      case 'TooManyRequestsException':
      case 'LimitExceededException':
      case 'InternalServiceErrorException':
      case 'TimeoutError':
      case 'NetworkingError':
      case 'SendingPausedException':
        throw new TransientEmailError(
          `SES transient failure: ${message}`,
          error as Error,
        );

      // Permanent: all other errors (MessageRejected,
      // MailFromDomainNotVerifiedException, BadRequestException,
      // NotFoundException, etc.)
      default:
        throw new PermanentEmailError(
          `SES rejected: ${message}`,
          error as Error,
        );
    }
  }
}
