// SPDX-License-Identifier: FSL-1.1-MIT
import { createHash } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { SesEmailQueueService } from '@/modules/email/ses/ses-email-queue.service';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import {
  type EmailInviteUserInput,
  InviteType,
  type InviteUserInput,
} from '@/modules/spaces/routes/entities/invite-users.dto.entity';
import {
  renderSpaceInviteEmailHtml,
  renderSpaceInviteEmailText,
  SPACE_INVITE_EMAIL_SUBJECT,
  SPACE_INVITE_PATH,
} from '@/modules/spaces/routes/templates/space-invite-email.template';
import type { EmailAddress } from '@/validation/entities/schemas/email-address.schema';

interface InviteEmailRecipient {
  name: string;
  email: EmailAddress;
}

/**
 * Builds and enqueues space invite emails.
 */
@Injectable()
export class SpaceInviteEmailService {
  private readonly inviteUrl: string;
  private readonly recipientRateLimit: { max: number; windowSeconds: number };
  private readonly emailsAlert: { threshold: number; windowSeconds: number };

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
    @Optional()
    private readonly sesEmailQueueService?: SesEmailQueueService,
  ) {
    const baseUri =
      this.configurationService.getOrThrow<string>('safeWebApp.baseUri');
    this.inviteUrl = new URL(SPACE_INVITE_PATH, baseUri).toString();
    this.recipientRateLimit = {
      max: this.configurationService.getOrThrow<number>(
        'spaces.rateLimit.invitation.recipient.max',
      ),
      windowSeconds: this.configurationService.getOrThrow<number>(
        'spaces.rateLimit.invitation.recipient.windowSeconds',
      ),
    };
    this.emailsAlert = {
      threshold: this.configurationService.getOrThrow<number>(
        'spaces.rateLimit.invitation.emailsAlert.threshold',
      ),
      windowSeconds: this.configurationService.getOrThrow<number>(
        'spaces.rateLimit.invitation.emailsAlert.windowSeconds',
      ),
    };
  }

  /**
   * Enqueues emails for email-based invitations.
   *
   * @param args.users - Requested users to invite.
   * @param args.spaceId - Space the invitations belong to.
   */
  public async enqueueInviteEmails(args: {
    users: Array<InviteUserInput>;
    spaceId: Space['id'];
  }): Promise<void> {
    const recipients = args.users
      .filter(
        (user): user is EmailInviteUserInput => user.type === InviteType.Email,
      )
      .map((user) => ({ name: user.name, email: user.email }));

    await this.enqueueEmails({ recipients, spaceId: args.spaceId });
  }

  /**
   * Re-enqueues the invite email for a single renewed invitation.
   *
   * @param args.name - Display name of the invited member.
   * @param args.email - Recipient email address.
   * @param args.spaceId - Space the invitation belongs to.
   */
  public async enqueueRenewalEmail(args: {
    name: string;
    email: EmailAddress;
    spaceId: Space['id'];
  }): Promise<void> {
    await this.enqueueEmails({
      recipients: [{ name: args.name, email: args.email }],
      spaceId: args.spaceId,
    });
  }

  private async enqueueEmails(args: {
    recipients: Array<InviteEmailRecipient>;
    spaceId: Space['id'];
  }): Promise<void> {
    if (!this.sesEmailQueueService) {
      return;
    }
    const queue = this.sesEmailQueueService;
    const { recipients, spaceId } = args;

    if (!recipients.length) {
      return;
    }

    try {
      const allowedRecipients = await this.filterRateLimitedRecipients({
        recipients,
        spaceId,
      });
      if (!allowedRecipients.length) {
        return;
      }
      await this.trackGlobalEmailVolume(allowedRecipients.length);

      const { name: workspaceName } = await this.spacesRepository.findOneOrFail(
        {
          where: { id: spaceId },
          select: { name: true },
        },
      );

      const jobs = allowedRecipients.map((recipient) => {
        const templateArgs = {
          name: recipient.name,
          email: recipient.email,
          workspaceName,
          actionUrl: this.inviteUrl,
        };

        return queue.enqueue({
          to: recipient.email,
          subject: SPACE_INVITE_EMAIL_SUBJECT,
          htmlBody: renderSpaceInviteEmailHtml(templateArgs),
          textBody: renderSpaceInviteEmailText(templateArgs),
          metadata: {
            spaceId,
          },
        });
      });

      await Promise.all(jobs);
    } catch (error) {
      this.loggingService.warn(
        `Error while enqueueing space invite email: ${asError(error).message}`,
      );
    }
  }

  /**
   * Drops recipients whose address has already received the maximum number
   * of invite emails within the window, across all Spaces and inviters.
   * Suppressed emails are logged but no error is surfaced: the invitation
   * itself remains valid and visible in the app, and callers must not be
   * able to probe how often an arbitrary address has been invited.
   *
   * @param args.recipients - Candidate email recipients.
   * @param args.spaceId - Space the invitations belong to.
   * @returns The recipients still within their email budget.
   */
  private async filterRateLimitedRecipients(args: {
    recipients: Array<InviteEmailRecipient>;
    spaceId: Space['id'];
  }): Promise<Array<InviteEmailRecipient>> {
    const allowedRecipients: Array<InviteEmailRecipient> = [];
    for (const recipient of args.recipients) {
      const recipientHash = this.hashRecipientEmail(recipient.email);
      const count = await this.cacheService.increment(
        CacheRouter.getRateLimitCacheKey(
          `spaces_invitation_recipient_${recipientHash}`,
        ),
        this.recipientRateLimit.windowSeconds,
      );
      if (count > this.recipientRateLimit.max) {
        this.loggingService.warn({
          type: LogType.RateLimit,
          spaceId: args.spaceId,
          recipientHash,
          maxEmails: this.recipientRateLimit.max,
          windowSeconds: this.recipientRateLimit.windowSeconds,
          currentCount: count,
        });
      } else {
        allowedRecipients.push(recipient);
      }
    }
    return allowedRecipients;
  }

  /**
   * Counts invite emails across the whole service and logs a warning once
   * the volume exceeds the alert threshold. Deliberately never blocks:
   * enforcement is alerting plus the kill switch, so a legitimate spike
   * cannot disable invite emails system-wide.
   *
   * @param emailCount - Number of emails about to be enqueued.
   */
  private async trackGlobalEmailVolume(emailCount: number): Promise<void> {
    const total = await this.cacheService.incrementBy(
      CacheRouter.getRateLimitCacheKey('spaces_invitation_emails_global'),
      emailCount,
      this.emailsAlert.windowSeconds,
    );
    if (total > this.emailsAlert.threshold) {
      this.loggingService.warn({
        type: LogType.RateLimit,
        alertThreshold: this.emailsAlert.threshold,
        windowSeconds: this.emailsAlert.windowSeconds,
        currentCount: total,
      });
    }
  }

  /**
   * Cache keys end up in logs and monitoring, so recipient addresses are
   * hashed before being used as a key to avoid spreading PII.
   */
  private hashRecipientEmail(email: EmailAddress): string {
    return createHash('sha256').update(email.toLowerCase()).digest('hex');
  }
}
