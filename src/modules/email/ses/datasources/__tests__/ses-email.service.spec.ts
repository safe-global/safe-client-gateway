// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { SesEmailService } from '@/modules/email/ses/datasources/ses-email.service';
import {
  TransientEmailError,
  PermanentEmailError,
} from '@/modules/email/ses/domain/errors/email.errors';
import { faker } from '@faker-js/faker';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  SendEmailCommand: jest.fn().mockImplementation((input) => input),
}));

describe('SesEmailService', () => {
  let service: SesEmailService;
  let fakeConfigurationService: FakeConfigurationService;

  const sesFromEmail = faker.internet.email();
  const sesFromName = 'Safe';

  const sendArgs = (): { to: string; subject: string; htmlBody: string } => ({
    to: faker.internet.email(),
    subject: faker.lorem.sentence(),
    htmlBody: `<p>${faker.lorem.paragraph()}</p>`,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('email.ses.fromEmail', sesFromEmail);
    fakeConfigurationService.set('email.ses.fromName', sesFromName);

    service = new SesEmailService(fakeConfigurationService);
  });

  describe('send', () => {
    it('should send email with correct SendEmailCommand', async () => {
      mockSend.mockResolvedValueOnce({});
      const to = faker.internet.email();
      const subject = faker.lorem.sentence();
      const htmlBody = `<p>${faker.lorem.paragraph()}</p>`;
      const textBody = faker.lorem.paragraph();

      await service.send({ to, subject, htmlBody, textBody });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command).toEqual(
        expect.objectContaining({
          Destination: { ToAddresses: [to] },
          Content: {
            Simple: {
              Subject: { Data: subject },
              Body: {
                Html: { Data: htmlBody },
                Text: { Data: textBody },
              },
            },
          },
          FromEmailAddress: `${sesFromName} <${sesFromEmail}>`,
        }),
      );
    });

    it('should send email without textBody when not provided', async () => {
      mockSend.mockResolvedValueOnce({});
      const to = faker.internet.email();
      const subject = faker.lorem.sentence();
      const htmlBody = `<p>${faker.lorem.paragraph()}</p>`;

      await service.send({ to, subject, htmlBody });

      const command = mockSend.mock.calls[0][0];
      expect(command.Content.Simple.Body.Text).toBeUndefined();
    });
  });

  describe('error classification', () => {
    it.each([
      'TooManyRequestsException',
      'LimitExceededException',
      'InternalServiceErrorException',
    ])('should throw TransientEmailError on %s', async (errorName) => {
      const error = new Error('Throttled');
      error.name = errorName;
      mockSend.mockRejectedValueOnce(error);

      await expect(service.send(sendArgs())).rejects.toThrow(
        TransientEmailError,
      );
    });

    it.each(['TimeoutError', 'NetworkingError'])(
      'should throw TransientEmailError on %s',
      async (errorName) => {
        const error = new Error('Timeout');
        error.name = errorName;
        mockSend.mockRejectedValueOnce(error);

        await expect(service.send(sendArgs())).rejects.toThrow(
          TransientEmailError,
        );
      },
    );

    it.each([
      'MessageRejected',
      'MailFromDomainNotVerifiedException',
      'SendingPausedException',
      'BadRequestException',
      'NotFoundException',
    ])('should throw PermanentEmailError on %s', async (errorName) => {
      const error = new Error('Rejected');
      error.name = errorName;
      mockSend.mockRejectedValueOnce(error);

      await expect(service.send(sendArgs())).rejects.toThrow(
        PermanentEmailError,
      );
    });

    it('should throw PermanentEmailError on unknown errors', async () => {
      const error = new Error('Something unexpected');
      error.name = 'UnknownException';
      mockSend.mockRejectedValueOnce(error);

      await expect(service.send(sendArgs())).rejects.toThrow(
        PermanentEmailError,
      );
    });
  });
});
