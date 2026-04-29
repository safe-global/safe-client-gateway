// SPDX-License-Identifier: FSL-1.1-MIT
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IEmailService } from '@/modules/email/ses/domain/interfaces/email-service.interface';
import { SesEmailErrorMapper } from '@/modules/email/ses/datasources/ses-email-error.mapper';
import { Inject, Injectable } from '@nestjs/common';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

@Injectable()
export class AwsSesEmailService implements IEmailService {
  private static readonly SES_CHARSET = 'UTF-8';
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

    this.client = new SESv2Client({
      maxAttempts: 1, //do not retry at the SDK level, let the JobQueue handle retries with backoff
    });
    this.fromAddress = this.formatRfc5322Address(fromName, fromEmail);
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
          Subject: {
            Data: args.subject,
            Charset: AwsSesEmailService.SES_CHARSET,
          },
          Body: {
            Html: {
              Data: args.htmlBody,
              Charset: AwsSesEmailService.SES_CHARSET,
            },
            ...(args.textBody && {
              Text: {
                Data: args.textBody,
                Charset: AwsSesEmailService.SES_CHARSET,
              },
            }),
          },
        },
      },
      FromEmailAddress: this.fromAddress,
    });

    try {
      await this.client.send(command);
    } catch (error) {
      throw SesEmailErrorMapper.fromSesError(error);
    }
  }

  /**
   * Formats a display name and email into an RFC 5322 mailbox address,
   * escaping backslashes and double-quotes in the display name.
   *
   * @example formatRfc5322Address('From Name', 'noreply@from.email') // '"From Name" <noreply@from.email>'
   */
  private formatRfc5322Address(name: string, email: string): string {
    return `"${name.replace(/[\\"]/g, '\\$&')}" <${email}>`;
  }
}
