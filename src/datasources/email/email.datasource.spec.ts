import { EmailDatasource } from '@/datasources/email/email.datasource';
import * as postgres from 'postgres';
import { PostgresError } from 'postgres';
import { faker } from '@faker-js/faker';
import { Email } from '@/datasources/email/entities/email.entity';
import { VerificationStatus } from '@/datasources/email/entities/verification.status';
import { EmailAlreadyVerifiedError } from '@/datasources/email/errors/email-already-verified.error';
import { EmailAddressDoesNotExistError } from '@/datasources/email/errors/email-address-does-not-exist.error';
import { InvalidVerificationCodeError } from '@/datasources/email/errors/invalid-verification-code.error';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { ExpiredVerificationCodeError } from '@/datasources/email/errors/expired-verification-code.error';
import * as shift from 'postgres-shift';

describe('Email Datasource Tests', () => {
  let target: EmailDatasource;

  const sql = postgres({
    host: process.env.POSTGRES_TEST_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_TEST_PORT || `${5433}`),
    db: process.env.POSTGRES_TEST_DB || 'test-db',
    user: process.env.POSTGRES_TEST_USER || 'postgres',
    password: process.env.POSTGRES_TEST_PASSWORD || 'postgres',
  });

  // Run any pending migration before test execution
  beforeAll(async () => {
    await shift({ sql });
  });

  afterEach(async () => {
    await sql`TRUNCATE emails.signer_emails CASCADE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  describe('random expiration time', () => {
    beforeEach(() => {
      const configurationService = new FakeConfigurationService();
      configurationService.set(
        'email.verificationExpireTimeInSeconds',
        faker.number.int(),
      );
      target = new EmailDatasource(sql, configurationService);
    });

    it('stores email successfully', async () => {
      const chainId = faker.number.int({ max: 2147483647 });
      const safeAddress = faker.finance.ethereumAddress();
      const emailAddress = faker.internet.email();
      const signer = faker.finance.ethereumAddress();

      await target.saveEmail({
        chainId: chainId.toString(),
        safeAddress,
        emailAddress,
        signer,
      });

      const emails = await sql<Email[]>`SELECT *
                                        FROM emails.signer_emails
                                        WHERE chain_id = ${chainId}
                                          and safe_address = ${safeAddress}
                                          and signer = ${signer}`;
      expect(emails.length).toBe(1);
      expect(emails[0]).toMatchObject({
        chain_id: chainId,
        email_address: emailAddress,
        safe_address: safeAddress,
        signer: signer,
        verified: false,
      });
    });

    it('storing same email throws', async () => {
      const chainId = faker.number.int({ max: 2147483647 });
      const safeAddress = faker.finance.ethereumAddress();
      const emailAddress = faker.internet.email();
      const signer = faker.finance.ethereumAddress();

      await target.saveEmail({
        chainId: chainId.toString(),
        safeAddress,
        emailAddress,
        signer,
      });

      await expect(
        target.saveEmail({
          chainId: chainId.toString(),
          safeAddress,
          emailAddress,
          signer,
        }),
      ).rejects.toThrow(PostgresError);
    });

    it('updates email verification successfully', async () => {
      const chainId = faker.number.int({ max: 2147483647 });
      const safeAddress = faker.finance.ethereumAddress();
      const emailAddress = faker.internet.email();
      const signer = faker.finance.ethereumAddress();

      await target.saveEmail({
        chainId: chainId.toString(),
        safeAddress,
        emailAddress,
        signer,
      });
      const [email] = await sql<Email[]>`SELECT *
                                         FROM emails.signer_emails
                                         WHERE chain_id = ${chainId}
                                           and safe_address = ${safeAddress}
                                           and signer = ${signer}`;
      const [initialVerificationStatus] = await sql<
        VerificationStatus[]
      >`SELECT *
        FROM emails.verification
        WHERE id = ${email.id}`;
      await target.resetVerificationCode({
        chainId: chainId.toString(),
        safeAddress,
        signer,
      });
      const [newVerificationStatus] = await sql<VerificationStatus[]>`SELECT *
                                                                      FROM emails.verification
                                                                      WHERE id = ${email.id}`;
      expect(initialVerificationStatus.verification_code).not.toBe(
        newVerificationStatus.verification_code,
      );
      expect(initialVerificationStatus.sent_on.getTime()).toBeLessThan(
        newVerificationStatus.sent_on.getTime(),
      );
    });

    it('updating email verification fails on verified emails', async () => {
      const chainId = faker.number.int({ max: 2147483647 });
      const safeAddress = faker.finance.ethereumAddress();
      const emailAddress = faker.internet.email();
      const signer = faker.finance.ethereumAddress();

      await target.saveEmail({
        chainId: chainId.toString(),
        safeAddress,
        emailAddress,
        signer,
      });
      const [email] = await sql<Email[]>`SELECT *
                                         FROM emails.signer_emails
                                         WHERE chain_id = ${chainId}
                                           and safe_address = ${safeAddress}
                                           and signer = ${signer}`;
      const [verificationStatus] = await sql<VerificationStatus[]>`SELECT *
                                                                   FROM emails.verification
                                                                   WHERE id = ${email.id}`;
      await target.verifyEmail({
        chainId: chainId.toString(),
        safeAddress,
        signer,
        code: verificationStatus.verification_code,
      });

      await expect(
        target.resetVerificationCode({
          chainId: chainId.toString(),
          safeAddress,
          signer,
        }),
      ).rejects.toThrow(EmailAlreadyVerifiedError);
    });

    it('updating email verification fails on unknown emails', async () => {
      const chainId = faker.number.int({ max: 2147483647 });
      const safeAddress = faker.finance.ethereumAddress();
      const signer = faker.finance.ethereumAddress();

      await expect(
        target.verifyEmail({
          chainId: chainId.toString(),
          safeAddress,
          signer,
          code: faker.string.numeric(),
        }),
      ).rejects.toThrow(EmailAddressDoesNotExistError);
    });

    it('throws when verifying an email address with the wrong code', async () => {
      const chainId = faker.number.int({ max: 2147483647 });
      const safeAddress = faker.finance.ethereumAddress();
      const emailAddress = faker.internet.email();
      const signer = faker.finance.ethereumAddress();

      await target.saveEmail({
        chainId: chainId.toString(),
        safeAddress,
        emailAddress,
        signer,
      });

      const [email] = await sql<Email[]>`SELECT *
                                         FROM emails.signer_emails
                                         WHERE chain_id = ${chainId}
                                           and safe_address = ${safeAddress}
                                           and signer = ${signer}`;
      const [verificationStatus] = await sql<VerificationStatus[]>`SELECT *
                                                                   FROM emails.verification
                                                                   WHERE id = ${email.id}`;

      const providedCode = (
        parseInt(verificationStatus.verification_code) + 1
      ).toString();
      await expect(
        target.verifyEmail({
          chainId: chainId.toString(),
          safeAddress,
          signer,
          code: providedCode,
        }),
      ).rejects.toThrow(InvalidVerificationCodeError);
    });
  });

  describe('fixed expiration time', () => {
    const expirationTimeInSeconds = 5;

    beforeEach(() => {
      const configurationService = new FakeConfigurationService();
      configurationService.set(
        'email.verificationExpireTimeInSeconds',
        expirationTimeInSeconds,
      );
      target = new EmailDatasource(sql, configurationService);
    });

    it('throws when verifying an email address with an expired code', async () => {
      jest.useFakeTimers({ advanceTimers: true });
      const chainId = faker.number.int({ max: 2147483647 });
      const safeAddress = faker.finance.ethereumAddress();
      const emailAddress = faker.internet.email();
      const signer = faker.finance.ethereumAddress();

      await target.saveEmail({
        chainId: chainId.toString(),
        safeAddress,
        emailAddress,
        signer,
      });

      const [email] = await sql<Email[]>`SELECT *
                                         FROM emails.signer_emails
                                         WHERE chain_id = ${chainId}
                                           and safe_address = ${safeAddress}
                                           and signer = ${signer}`;
      const [verificationStatus] = await sql<VerificationStatus[]>`SELECT *
                                                                   FROM emails.verification
                                                                   WHERE id = ${email.id}`;

      jest.advanceTimersByTime(expirationTimeInSeconds * 1000);
      await expect(
        target.verifyEmail({
          chainId: chainId.toString(),
          safeAddress,
          signer,
          code: verificationStatus.verification_code,
        }),
      ).rejects.toThrow(ExpiredVerificationCodeError);
      jest.useRealTimers();
    });
  });
});
