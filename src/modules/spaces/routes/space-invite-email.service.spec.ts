// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import type { ILoggingService } from '@/logging/logging.interface';
import type { SesEmailQueueService } from '@/modules/email/ses/ses-email-queue.service';
import { spaceBuilder } from '@/modules/spaces/domain/entities/__tests__/space.entity.db.builder';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import {
  emailInviteUserDtoBuilder,
  walletInviteUserDtoBuilder,
} from '@/modules/spaces/routes/entities/__tests__/invite-user.dto.builder';
import { SpaceInviteEmailService } from '@/modules/spaces/routes/space-invite-email.service';
import { fakeEmailAddress } from '@/validation/entities/schemas/__tests__/email-address.builder';

const BASE_URI = 'https://app.safe.global';
const INVITE_URL = 'https://app.safe.global/welcome/spaces';
const RECIPIENT_RATE_LIMIT_MAX = 2;
const RECIPIENT_RATE_LIMIT_WINDOW_SECONDS = 24 * 60 * 60;
const EMAILS_ALERT_THRESHOLD = 10;
const EMAILS_ALERT_WINDOW_SECONDS = 60 * 60;

const configurationServiceMock = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;

const loggingServiceMock = {
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const spacesRepositoryMock = {
  findOneOrFail: jest.fn(),
} as jest.MockedObjectDeep<ISpacesRepository>;

const sesEmailQueueServiceMock = {
  enqueue: jest.fn(),
} as jest.MockedObjectDeep<SesEmailQueueService>;

describe('SpaceInviteEmailService', () => {
  let service: SpaceInviteEmailService;
  let workspaceName: string;
  let fakeCacheService: FakeCacheService;

  const buildService = (
    queue?: SesEmailQueueService,
  ): SpaceInviteEmailService =>
    new SpaceInviteEmailService(
      configurationServiceMock,
      spacesRepositoryMock,
      loggingServiceMock,
      fakeCacheService,
      queue,
    );

  beforeEach(() => {
    jest.resetAllMocks();
    configurationServiceMock.getOrThrow.mockImplementation((key: string) => {
      switch (key) {
        case 'safeWebApp.baseUri':
          return BASE_URI;
        case 'spaces.rateLimit.invitation.recipient.max':
          return RECIPIENT_RATE_LIMIT_MAX;
        case 'spaces.rateLimit.invitation.recipient.windowSeconds':
          return RECIPIENT_RATE_LIMIT_WINDOW_SECONDS;
        case 'spaces.rateLimit.invitation.emailsAlert.threshold':
          return EMAILS_ALERT_THRESHOLD;
        case 'spaces.rateLimit.invitation.emailsAlert.windowSeconds':
          return EMAILS_ALERT_WINDOW_SECONDS;
        default:
          throw new Error(`Unexpected config key: ${key}`);
      }
    });
    fakeCacheService = new FakeCacheService();
    workspaceName = nameBuilder();
    spacesRepositoryMock.findOneOrFail.mockResolvedValue(
      spaceBuilder().with('name', workspaceName).build(),
    );
    service = buildService(sesEmailQueueServiceMock);
  });

  it('should enqueue an email job for an email invite using the configured invite URL', async () => {
    const spaceId = faker.number.int({ min: 1 });
    const invite = emailInviteUserDtoBuilder().build();
    sesEmailQueueServiceMock.enqueue.mockResolvedValue(undefined);

    await service.enqueueInviteEmails({ users: [invite], spaceId });

    expect(sesEmailQueueServiceMock.enqueue).toHaveBeenCalledTimes(1);
    expect(sesEmailQueueServiceMock.enqueue).toHaveBeenCalledWith({
      to: invite.email,
      subject: 'You have been invited to a Safe workspace',
      htmlBody: expect.stringContaining(INVITE_URL),
      textBody: expect.stringContaining(INVITE_URL),
      metadata: {
        spaceId,
      },
    });
    expect(sesEmailQueueServiceMock.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlBody: expect.stringContaining(workspaceName),
      }),
    );
  });

  it('should swallow and log errors raised while resolving the space', async () => {
    const spaceId = faker.number.int({ min: 1 });
    const invite = emailInviteUserDtoBuilder().build();
    spacesRepositoryMock.findOneOrFail.mockRejectedValueOnce(
      new Error('Space not found'),
    );
    sesEmailQueueServiceMock.enqueue.mockResolvedValue(undefined);

    await expect(
      service.enqueueInviteEmails({ users: [invite], spaceId }),
    ).resolves.toBeUndefined();

    expect(sesEmailQueueServiceMock.enqueue).not.toHaveBeenCalled();
    expect(loggingServiceMock.warn).toHaveBeenCalledWith(
      'Error while enqueueing space invite email: Space not found',
    );
  });

  it('should skip invitations without an invitee email', async () => {
    const spaceId = faker.number.int({ min: 1 });
    const walletInvite = walletInviteUserDtoBuilder().build();

    await service.enqueueInviteEmails({
      users: [walletInvite],
      spaceId,
    });

    expect(spacesRepositoryMock.findOneOrFail).not.toHaveBeenCalled();
    expect(sesEmailQueueServiceMock.enqueue).not.toHaveBeenCalled();
  });

  it('should be a no-op when the SES email queue is not available', async () => {
    const noQueueService = buildService(undefined);
    const spaceId = faker.number.int({ min: 1 });
    const invite = emailInviteUserDtoBuilder().build();

    await expect(
      noQueueService.enqueueInviteEmails({
        users: [invite],
        spaceId,
      }),
    ).resolves.toBeUndefined();

    expect(spacesRepositoryMock.findOneOrFail).not.toHaveBeenCalled();
    expect(sesEmailQueueServiceMock.enqueue).not.toHaveBeenCalled();
  });

  it('should swallow and log errors raised while enqueueing', async () => {
    const spaceId = faker.number.int({ min: 1 });
    const invite = emailInviteUserDtoBuilder().build();
    sesEmailQueueServiceMock.enqueue.mockRejectedValueOnce(
      new Error('Redis connection refused'),
    );

    await expect(
      service.enqueueInviteEmails({ users: [invite], spaceId }),
    ).resolves.toBeUndefined();

    expect(loggingServiceMock.warn).toHaveBeenCalledWith(
      'Error while enqueueing space invite email: Redis connection refused',
    );
  });

  describe('enqueueRenewalEmail', () => {
    it('should enqueue an email job for the renewed invitation', async () => {
      const spaceId = faker.number.int({ min: 1 });
      const name = nameBuilder();
      const email = fakeEmailAddress();
      sesEmailQueueServiceMock.enqueue.mockResolvedValue(undefined);

      await service.enqueueRenewalEmail({ name, email, spaceId });

      expect(sesEmailQueueServiceMock.enqueue).toHaveBeenCalledTimes(1);
      expect(sesEmailQueueServiceMock.enqueue).toHaveBeenCalledWith({
        to: email,
        subject: 'You have been invited to a Safe workspace',
        htmlBody: expect.stringContaining(INVITE_URL),
        textBody: expect.stringContaining(INVITE_URL),
        metadata: {
          spaceId,
        },
      });
      expect(sesEmailQueueServiceMock.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          htmlBody: expect.stringContaining(workspaceName),
        }),
      );
    });

    it('should be a no-op when the SES email queue is not available', async () => {
      const noQueueService = buildService(undefined);
      const spaceId = faker.number.int({ min: 1 });

      await expect(
        noQueueService.enqueueRenewalEmail({
          name: nameBuilder(),
          email: fakeEmailAddress(),
          spaceId,
        }),
      ).resolves.toBeUndefined();

      expect(spacesRepositoryMock.findOneOrFail).not.toHaveBeenCalled();
      expect(sesEmailQueueServiceMock.enqueue).not.toHaveBeenCalled();
    });

    it('should swallow and log errors raised while enqueueing', async () => {
      const spaceId = faker.number.int({ min: 1 });
      sesEmailQueueServiceMock.enqueue.mockRejectedValueOnce(
        new Error('Redis connection refused'),
      );

      await expect(
        service.enqueueRenewalEmail({
          name: nameBuilder(),
          email: fakeEmailAddress(),
          spaceId,
        }),
      ).resolves.toBeUndefined();

      expect(loggingServiceMock.warn).toHaveBeenCalledWith(
        'Error while enqueueing space invite email: Redis connection refused',
      );
    });
  });

  describe('rate limiting', () => {
    it('should suppress emails to a recipient above the per-recipient limit while sending to others', async () => {
      const spaceId = faker.number.int({ min: 1 });
      const limitedInvite = emailInviteUserDtoBuilder().build();
      const otherInvite = emailInviteUserDtoBuilder().build();
      sesEmailQueueServiceMock.enqueue.mockResolvedValue(undefined);

      // RECIPIENT_RATE_LIMIT_MAX = 2: the first two emails to the same
      // address exhaust its budget, the third one is suppressed.
      await service.enqueueInviteEmails({ users: [limitedInvite], spaceId });
      await service.enqueueInviteEmails({ users: [limitedInvite], spaceId });
      await service.enqueueInviteEmails({
        users: [limitedInvite, otherInvite],
        spaceId,
      });

      expect(sesEmailQueueServiceMock.enqueue).toHaveBeenCalledTimes(3);
      expect(sesEmailQueueServiceMock.enqueue).toHaveBeenLastCalledWith(
        expect.objectContaining({ to: otherInvite.email }),
      );
      expect(loggingServiceMock.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LogType.RateLimit,
          spaceId,
          maxEmails: RECIPIENT_RATE_LIMIT_MAX,
        }),
      );
    });

    it('should count renewal emails against the recipient budget', async () => {
      const spaceId = faker.number.int({ min: 1 });
      const name = nameBuilder();
      const email = fakeEmailAddress();
      sesEmailQueueServiceMock.enqueue.mockResolvedValue(undefined);

      await service.enqueueRenewalEmail({ name, email, spaceId });
      await service.enqueueRenewalEmail({ name, email, spaceId });
      await service.enqueueRenewalEmail({ name, email, spaceId });

      expect(sesEmailQueueServiceMock.enqueue).toHaveBeenCalledTimes(
        RECIPIENT_RATE_LIMIT_MAX,
      );
    });

    it('should not leak the recipient address in the rate limit log', async () => {
      const spaceId = faker.number.int({ min: 1 });
      const name = nameBuilder();
      const email = fakeEmailAddress();
      sesEmailQueueServiceMock.enqueue.mockResolvedValue(undefined);

      await service.enqueueRenewalEmail({ name, email, spaceId });
      await service.enqueueRenewalEmail({ name, email, spaceId });
      await service.enqueueRenewalEmail({ name, email, spaceId });

      const rateLimitLogs = loggingServiceMock.warn.mock.calls.filter(
        ([log]) =>
          typeof log === 'object' &&
          (log as { type: string }).type === LogType.RateLimit,
      );
      expect(rateLimitLogs).toHaveLength(1);
      expect(JSON.stringify(rateLimitLogs[0])).not.toContain(email);
    });

    it('should log a warning above the global alert threshold without blocking', async () => {
      const spaceId = faker.number.int({ min: 1 });
      const invite = emailInviteUserDtoBuilder().build();
      sesEmailQueueServiceMock.enqueue.mockResolvedValue(undefined);
      await fakeCacheService.setCounter(
        CacheRouter.getRateLimitCacheKey('spaces_invitation_emails_global'),
        EMAILS_ALERT_THRESHOLD,
        EMAILS_ALERT_WINDOW_SECONDS,
      );

      await service.enqueueInviteEmails({ users: [invite], spaceId });

      expect(sesEmailQueueServiceMock.enqueue).toHaveBeenCalledTimes(1);
      expect(loggingServiceMock.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LogType.RateLimit,
          alertThreshold: EMAILS_ALERT_THRESHOLD,
          currentCount: EMAILS_ALERT_THRESHOLD + 1,
        }),
      );
    });
  });
});
