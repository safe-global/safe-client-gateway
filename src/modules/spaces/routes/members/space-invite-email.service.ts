// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable, Optional } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { SesEmailQueueService } from '@/modules/email/ses/ses-email-queue.service';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { SpaceEncryptionService } from '@/modules/spaces/domain/space-encryption.service';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import {
  type EmailInviteUserInput,
  InviteType,
  type InviteUserInput,
} from '@/modules/spaces/routes/members/entities/invite-users.dto.entity';
import {
  renderSpaceInviteEmailHtml,
  renderSpaceInviteEmailText,
  SPACE_INVITE_EMAIL_SUBJECT,
  SPACE_INVITE_PATH,
} from '@/modules/spaces/routes/members/templates/space-invite-email.template';
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

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(SpaceEncryptionService)
    private readonly spaceEncryptionService: SpaceEncryptionService,
    @Optional()
    private readonly sesEmailQueueService?: SesEmailQueueService,
  ) {
    const baseUri =
      this.configurationService.getOrThrow<string>('safeWebApp.baseUri');
    this.inviteUrl = new URL(SPACE_INVITE_PATH, baseUri).toString();
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
      const space = await this.spacesRepository.findOneOrFail({
        where: { id: spaceId },
        select: { name: true },
      });
      // Egress path: the stored name may be KMS ciphertext — decrypt before
      // it is rendered into an inbox-bound email body.
      const workspaceName = await this.spaceEncryptionService.decryptSpaceName(
        spaceId,
        space.name,
      );

      const jobs = recipients.map((recipient) => {
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
}
