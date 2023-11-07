import { EmailDataSource } from '@/datasources/email/email.datasource';
import * as postgres from 'postgres';
import { PostgresError } from 'postgres';
import { faker } from '@faker-js/faker';
import { Email } from '@/datasources/email/entities/email.entity';
import { VerificationStatus } from '@/datasources/email/entities/verification.status';
import { EmailAddressDoesNotExistError } from '@/datasources/email/errors/email-address-does-not-exist.error';
import * as shift from 'postgres-shift';

describe('Email Datasource Tests', () => {
  let target: EmailDataSource;

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

  beforeEach(() => {
    target = new EmailDataSource(sql);
  });

  afterEach(async () => {
    await sql`TRUNCATE emails.signer_emails CASCADE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('stores email successfully', async () => {
    const chainId = faker.number.int({ max: 2147483647 });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = faker.internet.email();
    const signer = faker.finance.ethereumAddress();
    const code = faker.number.int({ max: 999999 });

    await target.saveEmail({
      chainId: chainId.toString(),
      safeAddress,
      emailAddress,
      signer,
      code,
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
    const code = faker.number.int({ max: 999999 });

    await target.saveEmail({
      chainId: chainId.toString(),
      safeAddress,
      emailAddress,
      signer,
      code,
    });

    await expect(
      target.saveEmail({
        chainId: chainId.toString(),
        safeAddress,
        emailAddress,
        signer,
        code,
      }),
    ).rejects.toThrow(PostgresError);
  });

  it('updates email verification successfully', async () => {
    const chainId = faker.number.int({ max: 2147483647 });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = faker.internet.email();
    const signer = faker.finance.ethereumAddress();
    const code = faker.number.int({ max: 999998 });
    const newCode = code + 1;

    await target.saveEmail({
      chainId: chainId.toString(),
      safeAddress,
      emailAddress,
      signer,
      code,
    });
    const [email] = await sql<Email[]>`SELECT *
                                       FROM emails.signer_emails
                                       WHERE chain_id = ${chainId}
                                         and safe_address = ${safeAddress}
                                         and signer = ${signer}`;
    const [initialVerificationStatus] = await sql<VerificationStatus[]>`SELECT *
                                                                        FROM emails.verification
                                                                        WHERE id = ${email.id}`;
    await target.setVerificationCode({
      chainId: chainId.toString(),
      safeAddress,
      signer,
      code: newCode,
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

  it('setting verification code throws on unknown emails', async () => {
    const chainId = faker.number.int({ max: 2147483647 });
    const safeAddress = faker.finance.ethereumAddress();
    const signer = faker.finance.ethereumAddress();
    const code = faker.number.int({ max: 999998 });
    const newCode = code + 1;

    await expect(
      target.setVerificationCode({
        chainId: chainId.toString(),
        safeAddress,
        signer,
        code: newCode,
      }),
    ).rejects.toThrow(EmailAddressDoesNotExistError);
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
      }),
    ).rejects.toThrow(EmailAddressDoesNotExistError);
  });
});
