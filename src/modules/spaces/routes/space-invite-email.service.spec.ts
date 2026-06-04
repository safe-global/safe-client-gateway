// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
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

const configurationServiceMock = {
  getOrThrow: vi.fn(),
} as MockedObject<IConfigurationService>;

const loggingServiceMock = {
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

const spacesRepositoryMock = {
  findOneOrFail: vi.fn(),
} as MockedObject<ISpacesRepository>;

const sesEmailQueueServiceMock = {
  enqueue: vi.fn(),
} as MockedObject<SesEmailQueueService>;

describe('SpaceInviteEmailService', () => {
  let service: SpaceInviteEmailService;
  let workspaceName: string;

  const buildService = (
    queue?: SesEmailQueueService,
  ): SpaceInviteEmailService =>
    new SpaceInviteEmailService(
      configurationServiceMock,
      spacesRepositoryMock,
      loggingServiceMock,
      queue,
    );

  beforeEach(() => {
    vi.resetAllMocks();
    configurationServiceMock.getOrThrow.mockImplementation((key: string) => {
      if (key === 'safeWebApp.baseUri') {
        return BASE_URI;
      }
      throw new Error(`Unexpected config key: ${key}`);
    });
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
});
