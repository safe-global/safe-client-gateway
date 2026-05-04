// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { AwsSesEmailService } from '@/modules/email/ses/datasources/aws-ses-email.service';
import {
  TransientEmailError,
  PermanentEmailError,
} from '@/modules/email/ses/domain/errors/email.errors';
import { MessageRejected } from '@aws-sdk/client-sesv2';
import { faker } from '@faker-js/faker';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-sesv2', () => ({
  ...jest.requireActual('@aws-sdk/client-sesv2'),
  SESv2Client: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  SendEmailCommand: jest.fn().mockImplementation((input) => input),
}));

describe('SesEmailService', () => {
  let service: AwsSesEmailService;
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

    service = new AwsSesEmailService(fakeConfigurationService);
  });

  describe('send', () => {
    it('should send email with correct SendEmailCommand', async () => {
      mockSend.mockResolvedValueOnce({});
      const to = faker.internet.email();
      const subject = faker.lorem.sentence();
      const htmlBody = `<p>${faker.lorem.paragraph()}</p>`;
      const textBody = faker.lorem.paragraph();

      await service.send({ to, subject, htmlBody, textBody });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          Destination: { ToAddresses: [to] },
          Content: {
            Simple: {
              Subject: { Data: subject, Charset: 'UTF-8' },
              Body: {
                Html: { Data: htmlBody, Charset: 'UTF-8' },
                Text: { Data: textBody, Charset: 'UTF-8' },
              },
            },
          },
          FromEmailAddress: `"${sesFromName}" <${sesFromEmail}>`,
        }),
      );
    });

    it('should send email without textBody when not provided', async () => {
      mockSend.mockResolvedValueOnce({});
      const to = faker.internet.email();
      const subject = faker.lorem.sentence();
      const htmlBody = `<p>${faker.lorem.paragraph()}</p>`;

      await service.send({ to, subject, htmlBody });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          Content: expect.objectContaining({
            Simple: expect.objectContaining({
              Body: expect.not.objectContaining({ Text: expect.anything() }),
            }),
          }),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should throw TransientEmailError for non-SES errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network failure'));

      await expect(service.send(sendArgs())).rejects.toThrow(
        TransientEmailError,
      );
    });

    it('should throw PermanentEmailError for rejected SES errors', async () => {
      const error = new MessageRejected({
        message: 'Email address is not verified',
        $metadata: {},
      });
      mockSend.mockRejectedValueOnce(error);

      await expect(service.send(sendArgs())).rejects.toThrow(
        PermanentEmailError,
      );
    });
  });
});
