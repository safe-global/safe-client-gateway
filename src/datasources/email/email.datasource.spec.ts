import { EmailDataSource } from '@/datasources/email/email.datasource';
import * as postgres from 'postgres';
import { PostgresError } from 'postgres';
import { faker } from '@faker-js/faker';
import { EmailAddressDoesNotExistError } from '@/datasources/email/errors/email-address-does-not-exist.error';
import * as shift from 'postgres-shift';
import configuration from '@/config/entities/__tests__/configuration';
import { EmailAddress } from '@/domain/email/entities/email.entity';

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
    const emailAddress = new EmailAddress(faker.internet.email());
    const signer = faker.finance.ethereumAddress();
    const code = faker.string.numeric();
    const codeGenerationDate = faker.date.recent();

    await target.saveEmail({
      chainId: chainId.toString(),
      safeAddress,
      emailAddress,
      signer,
      code,
      codeGenerationDate,
    });
    const email = await target.getEmail({
      chainId: chainId.toString(),
      safeAddress,
      signer,
    });

    expect(email).toMatchObject({
      chainId: chainId.toString(),
      emailAddress: emailAddress,
      isVerified: false,
      safeAddress: safeAddress,
      signer: signer,
      verificationCode: code,
      verificationSentOn: null,
    });
  });

  it('storing same email throws', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const signer = faker.finance.ethereumAddress();
    const code = faker.string.numeric();
    const codeGenerationDate = faker.date.recent();

    await target.saveEmail({
      chainId: chainId.toString(),
      safeAddress,
      emailAddress,
      signer,
      code,
      codeGenerationDate,
    });

    await expect(
      target.saveEmail({
        chainId: chainId.toString(),
        safeAddress,
        emailAddress,
        signer,
        code,
        codeGenerationDate,
      }),
    ).rejects.toThrow(PostgresError);
  });

  it('updates email verification successfully', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const signer = faker.finance.ethereumAddress();
    const code = faker.number.int({ max: 999998 });
    const codeGenerationDate = faker.date.recent();
    const newCode = code + 1;
    const newCodeGenerationDate = faker.date.recent();

    await target.saveEmail({
      chainId: chainId.toString(),
      safeAddress,
      emailAddress,
      signer,
      code: code.toString(),
      codeGenerationDate,
    });
    const savedEmail = await target.getEmail({
      chainId: chainId.toString(),
      safeAddress,
      signer,
    });
    await target.setVerificationCode({
      chainId: chainId.toString(),
      safeAddress,
      signer,
      code: newCode.toString(),
      codeGenerationDate: newCodeGenerationDate,
    });

    const updatedEmail = await target.getEmail({
      chainId: chainId.toString(),
      safeAddress,
      signer,
    });
    expect(updatedEmail.verificationCode).not.toBe(savedEmail.verificationCode);
    expect(updatedEmail.verificationSentOn).toBeNull();
    expect(updatedEmail.verificationGeneratedOn).toEqual(newCodeGenerationDate);
  });

  it('sets verification sent date successfully', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const signer = faker.finance.ethereumAddress();
    const sentOn = faker.date.recent();
    const code = faker.string.numeric();
    const codeGenerationDate = faker.date.recent();

    await target.saveEmail({
      chainId: chainId.toString(),
      safeAddress,
      emailAddress,
      signer,
      code,
      codeGenerationDate,
    });
    await target.setVerificationSentDate({
      chainId: chainId.toString(),
      safeAddress,
      signer,
      sentOn,
    });

    const email = await target.getEmail({
      chainId: chainId.toString(),
      safeAddress,
      signer,
    });
    expect(email.verificationSentOn).toEqual(sentOn);
  });

  it('setting verification code throws on unknown emails', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const signer = faker.finance.ethereumAddress();
    const code = faker.number.int({ max: 999998 });
    const newCode = code + 1;
    const newCodeGenerationDate = faker.date.recent();

    await expect(
      target.setVerificationCode({
        chainId: chainId.toString(),
        safeAddress,
        signer,
        code: newCode.toString(),
        codeGenerationDate: newCodeGenerationDate,
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

  it('gets only verified email addresses associated with a given safe address', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const verifiedSigners = [
      {
        emailAddress: new EmailAddress(faker.internet.email()),
        signer: faker.finance.ethereumAddress(),
        code: faker.number.int({ max: 999998 }).toString(),
        codeGenerationDate: faker.date.recent(),
      },
      {
        emailAddress: new EmailAddress(faker.internet.email()),
        signer: faker.finance.ethereumAddress(),
        code: faker.number.int({ max: 999998 }).toString(),
        codeGenerationDate: faker.date.recent(),
      },
    ];
    const nonVerifiedSigners = [
      {
        emailAddress: new EmailAddress(faker.internet.email()),
        signer: faker.finance.ethereumAddress(),
        code: faker.number.int({ max: 999998 }).toString(),
        codeGenerationDate: faker.date.recent(),
      },
      {
        emailAddress: new EmailAddress(faker.internet.email()),
        signer: faker.finance.ethereumAddress(),
        code: faker.number.int({ max: 999998 }).toString(),
        codeGenerationDate: faker.date.recent(),
      },
    ];
    for (const {
      emailAddress,
      signer,
      code,
      codeGenerationDate,
    } of verifiedSigners) {
      await target.saveEmail({
        chainId,
        safeAddress,
        emailAddress,
        signer,
        code,
        codeGenerationDate,
      });
      await target.verifyEmail({
        chainId: chainId,
        safeAddress,
        signer,
      });
    }
    for (const {
      emailAddress,
      signer,
      code,
      codeGenerationDate,
    } of nonVerifiedSigners) {
      await target.saveEmail({
        chainId,
        safeAddress,
        emailAddress,
        signer,
        code,
        codeGenerationDate,
      });
    }

    const result = await target.getVerifiedSignerEmailsBySafeAddress({
      chainId,
      safeAddress,
    });

    expect(result).toEqual(
      verifiedSigners.map((verifiedSigner) => ({
        email: verifiedSigner.emailAddress.value,
      })),
    );
  });
});
