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
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import {
  InviteType,
  type InviteUserInput,
} from '@/modules/spaces/routes/entities/invite-users.dto.entity';
import {
  renderSpaceInviteEmailHtml,
  renderSpaceInviteEmailText,
  SPACE_INVITE_EMAIL_SUBJECT,
  SPACE_INVITE_PATH,
} from '@/modules/spaces/routes/templates/space-invite-email.template';

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
    if (!this.sesEmailQueueService) {
      return;
    }
    const queue = this.sesEmailQueueService;
    const emailInvites = args.users.flatMap((user) =>
      user.type === InviteType.Email ? [user] : [],
    );

    if (emailInvites.length === 0) {
      return;
    }

    try {
      const space = await this.spacesRepository.findOneOrFail({
        where: { id: args.spaceId },
        select: { name: true },
      });
      const workspaceName = space.name;

      const jobs = emailInvites.map((invitation) => {
        const templateArgs = {
          name: invitation.name,
          email: invitation.email,
          workspaceName,
          actionUrl: this.inviteUrl,
        };

        return queue.enqueue({
          to: invitation.email,
          subject: SPACE_INVITE_EMAIL_SUBJECT,
          htmlBody: renderSpaceInviteEmailHtml(templateArgs),
          textBody: renderSpaceInviteEmailText(templateArgs),
          metadata: {
            spaceId: args.spaceId,
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
