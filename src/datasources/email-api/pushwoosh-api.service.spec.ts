import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { PushwooshApi } from '@/datasources/email-api/pushwoosh-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { INetworkService } from '@/datasources/network/network.service.interface';
import { CreateEmailMessageDto } from '@/domain/email/entities/create-email-message.dto.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';

const networkService = {
  post: jest.fn(),
  delete: jest.fn(),
} as unknown as INetworkService;
const mockNetworkService = jest.mocked(networkService);

describe('PushwooshApi', () => {
  let service: PushwooshApi;
  let fakeConfigurationService: FakeConfigurationService;

  let pushwooshApplicationCode: string;
  let pushwooshApiKey: string;
  let pushwooshBaseUri: string;
  let pushwooshFromEmail: string;
  let pushwooshFromName: string;

  beforeEach(async () => {
    jest.clearAllMocks();

    pushwooshApplicationCode = faker.string.alphanumeric();
    pushwooshApiKey = faker.string.hexadecimal({ length: 32 });
    pushwooshBaseUri = faker.internet.url({ appendSlash: false });
    pushwooshFromEmail = faker.internet.email();
    pushwooshFromName = faker.person.fullName();

    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'email.applicationCode',
      pushwooshApplicationCode,
    );
    fakeConfigurationService.set('email.apiKey', pushwooshApiKey);
    fakeConfigurationService.set('email.baseUri', pushwooshBaseUri);
    fakeConfigurationService.set('email.fromEmail', pushwooshFromEmail);
    fakeConfigurationService.set('email.fromName', pushwooshFromName);

    service = new PushwooshApi(
      fakeConfigurationService,
      mockNetworkService,
      new HttpErrorFactory(),
    );
  });

  it('should error if configuration is not defined', async () => {
    const fakeConfigurationService = new FakeConfigurationService();

    expect(
      () =>
        new PushwooshApi(
          fakeConfigurationService,
          mockNetworkService,
          new HttpErrorFactory(),
        ),
    ).toThrow();
  });

  describe('sending email messages', () => {
    it('should forward error', async () => {
      const createEmailMessageDto: CreateEmailMessageDto = {
        to: [faker.internet.email(), faker.internet.email()],
        template: faker.string.uuid(),
        subject: faker.string.sample(),
        substitutions: {
          [faker.string.sample()]: faker.string.sample(),
          [faker.string.sample()]: faker.string.sample(),
        },
      };
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = {
        status,
        data: {
          message: 'Unexpected error',
        },
      };
      mockNetworkService.post.mockRejectedValueOnce(error);

      await expect(
        service.createMessage(createEmailMessageDto),
      ).rejects.toThrowError(new DataSourceError('Unexpected error', status));

      expect(networkService.post).toHaveBeenCalledTimes(1);
    });

    it('should create a new message', async () => {
      const createEmailMessageDto: CreateEmailMessageDto = {
        to: [faker.internet.email(), faker.internet.email()],
        template: faker.string.uuid(),
        subject: faker.string.sample(),
        substitutions: {
          [faker.string.sample()]: faker.string.sample(),
          [faker.string.sample()]: faker.string.sample(),
        },
      };

      await service.createMessage(createEmailMessageDto);

      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith(
        `${pushwooshBaseUri}/json/1.3/createEmailMessage`,
        {
          request: {
            application: pushwooshApplicationCode,
            auth: pushwooshApiKey,
            notifications: [
              {
                send_date: 'now',
                email_template: createEmailMessageDto.template,
                devices: createEmailMessageDto.to,
                use_auto_registration: true,
                subject: [{ default: createEmailMessageDto.subject }],
                dynamic_content_placeholders:
                  createEmailMessageDto.substitutions,
                from: { name: pushwooshFromName, email: pushwooshFromEmail },
              },
            ],
          },
        },
      );
    });

    it('should create a new unique (using emailMessageId field) message', async () => {
      const createEmailMessageDto: CreateEmailMessageDto = {
        to: [faker.internet.email(), faker.internet.email()],
        template: faker.string.uuid(),
        subject: faker.string.sample(),
        substitutions: {
          [faker.string.sample()]: faker.string.sample(),
          [faker.string.sample()]: faker.string.sample(),
        },
        emailMessageId: uuidv4(),
      };

      await service.createMessage(createEmailMessageDto);

      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith(
        `${pushwooshBaseUri}/json/1.3/createEmailMessage`,
        {
          request: {
            application: pushwooshApplicationCode,
            auth: pushwooshApiKey,
            notifications: [
              {
                send_date: 'now',
                email_template: createEmailMessageDto.template,
                devices: createEmailMessageDto.to,
                use_auto_registration: true,
                subject: [{ default: createEmailMessageDto.subject }],
                dynamic_content_placeholders:
                  createEmailMessageDto.substitutions,
                from: { name: pushwooshFromName, email: pushwooshFromEmail },
                transactionId: createEmailMessageDto.emailMessageId,
              },
            ],
          },
        },
      );
    });
  });

  describe('deleting email addresses', () => {
    it('should forward error', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = {
        status,
        data: {
          message: 'Unexpected error',
        },
      };
      mockNetworkService.post.mockRejectedValueOnce(error);

      await expect(
        service.deleteEmailAddress({ emailAddress: faker.internet.email() }),
      ).rejects.toThrowError(new DataSourceError('Unexpected error', status));

      expect(networkService.post).toHaveBeenCalledTimes(1);
    });

    it('should delete an email address from Pushwoosh', async () => {
      const emailAddress = faker.internet.email();
      await service.deleteEmailAddress({ emailAddress });

      expect(networkService.post).toHaveBeenCalledTimes(1);
      expect(networkService.post).toHaveBeenCalledWith(
        `${pushwooshBaseUri}/json/1.3/deleteEmail`,
        {
          request: {
            application: pushwooshApplicationCode,
            email: emailAddress,
          },
        },
      );
    });
  });
});
