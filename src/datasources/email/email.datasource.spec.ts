import { EmailDataSource } from '@/datasources/email/email.datasource';
import * as postgres from 'postgres';
import { PostgresError } from 'postgres';
import { faker } from '@faker-js/faker';
import { Email } from '@/datasources/email/entities/email.entity';
import { EmailAddressDoesNotExistError } from '@/datasources/email/errors/email-address-does-not-exist.error';
import * as shift from 'postgres-shift';
import configuration from '@/config/entities/__tests__/configuration';

const DB_CHAIN_ID_MAX_VALUE = 2147483647;

describe('Email Datasource Tests', () => {
  let target: EmailDataSource;
  const config = configuration();

  const sql = postgres({
    host: config.db.postgres.host,
    port: parseInt(config.db.postgres.port),
    db: config.db.postgres.database,
    user: config.db.postgres.username,
    password: config.db.postgres.password,
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
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = faker.internet.email();
    const signer = faker.finance.ethereumAddress();
    const code = faker.string.numeric();

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
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = faker.internet.email();
    const signer = faker.finance.ethereumAddress();
    const code = faker.string.numeric();

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
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = faker.internet.email();
    const signer = faker.finance.ethereumAddress();
    const code = faker.number.int({ max: 999998 });
    const newCode = code + 1;

    const verificationCode = await target.saveEmail({
      chainId: chainId.toString(),
      safeAddress,
      emailAddress,
      signer,
      code: code.toString(),
    });
    const [email] = await sql<Email[]>`SELECT *
                                       FROM emails.signer_emails
                                       WHERE chain_id = ${chainId}
                                         and safe_address = ${safeAddress}
                                         and signer = ${signer}`;
    const updatedVerificationCode = await target.setVerificationCode({
      chainId: chainId.toString(),
      safeAddress,
      signer,
      code: newCode.toString(),
    });

    expect(updatedVerificationCode.verificationCode).not.toBe(
      verificationCode.verificationCode,
    );
    expect(email.verification_sent_on).toBeNull();
  });

  it('sets verification sent date successfully', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = faker.internet.email();
    const signer = faker.finance.ethereumAddress();
    const sentOn = faker.date.recent();
    const code = faker.string.numeric();

    await target.saveEmail({
      chainId: chainId.toString(),
      safeAddress,
      emailAddress,
      signer,
      code,
    });
    await target.setVerificationSentDate({
      chainId: chainId.toString(),
      safeAddress,
      signer,
      sentOn,
    });

    const [email] = await sql<Email[]>`SELECT *
                                       FROM emails.signer_emails
                                       WHERE chain_id = ${chainId}
                                         and safe_address = ${safeAddress}
                                         and signer = ${signer}`;
    expect(email.verification_sent_on).toEqual(sentOn);
  });

  it('setting verification code throws on unknown emails', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const signer = faker.finance.ethereumAddress();
    const code = faker.number.int({ max: 999998 });
    const newCode = code + 1;

    await expect(
      target.setVerificationCode({
        chainId: chainId.toString(),
        safeAddress,
        signer,
        code: newCode.toString(),
      }),
    ).rejects.toThrow(EmailAddressDoesNotExistError);
  });

  it('updating email verification fails on unknown emails', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
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
