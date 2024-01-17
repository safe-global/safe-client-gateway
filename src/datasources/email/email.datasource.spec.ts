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
    await sql`TRUNCATE TABLE emails.account_emails, emails.account_subscriptions CASCADE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('stores email successfully', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const account = faker.finance.ethereumAddress();
    const code = faker.string.numeric();
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();

    await target.saveEmail({
      chainId: chainId.toString(),
      safeAddress,
      emailAddress,
      account,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });
    const email = await target.getEmail({
      chainId: chainId.toString(),
      safeAddress,
      account,
    });

    expect(email).toMatchObject({
      chainId: chainId.toString(),
      emailAddress: emailAddress,
      isVerified: false,
      safeAddress: safeAddress,
      account,
      verificationCode: code,
      verificationSentOn: null,
    });
  });

  it('storing same email throws', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const account = faker.finance.ethereumAddress();
    const code = faker.string.numeric();
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();

    await target.saveEmail({
      chainId: chainId.toString(),
      safeAddress,
      emailAddress,
      account,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });

    await expect(
      target.saveEmail({
        chainId: chainId.toString(),
        safeAddress,
        emailAddress,
        account,
        code,
        codeGenerationDate,
        unsubscriptionToken,
      }),
    ).rejects.toThrow(PostgresError);
  });

  it('updates email verification successfully', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const account = faker.finance.ethereumAddress();
    const code = faker.number.int({ max: 999998 });
    const codeGenerationDate = faker.date.recent();
    const newCode = code + 1;
    const newCodeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();

    await target.saveEmail({
      chainId: chainId.toString(),
      safeAddress,
      emailAddress,
      account,
      code: code.toString(),
      codeGenerationDate,
      unsubscriptionToken,
    });
    const savedEmail = await target.getEmail({
      chainId: chainId.toString(),
      safeAddress,
      account: account,
    });
    await target.setVerificationCode({
      chainId: chainId.toString(),
      safeAddress,
      account: account,
      code: newCode.toString(),
      codeGenerationDate: newCodeGenerationDate,
    });

    const updatedEmail = await target.getEmail({
      chainId: chainId.toString(),
      safeAddress,
      account: account,
    });
    expect(updatedEmail.verificationCode).not.toBe(savedEmail.verificationCode);
    expect(updatedEmail.verificationSentOn).toBeNull();
    expect(updatedEmail.verificationGeneratedOn).toEqual(newCodeGenerationDate);
  });

  it('sets verification sent date successfully', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const account = faker.finance.ethereumAddress();
    const sentOn = faker.date.recent();
    const code = faker.string.numeric();
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();

    await target.saveEmail({
      chainId: chainId.toString(),
      safeAddress,
      emailAddress,
      account,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });
    await target.setVerificationSentDate({
      chainId: chainId.toString(),
      safeAddress,
      account: account,
      sentOn,
    });

    const email = await target.getEmail({
      chainId: chainId.toString(),
      safeAddress,
      account: account,
    });
    expect(email.verificationSentOn).toEqual(sentOn);
  });

  it('setting verification code throws on unknown emails', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const account = faker.finance.ethereumAddress();
    const code = faker.number.int({ max: 999998 });
    const newCode = code + 1;
    const newCodeGenerationDate = faker.date.recent();

    await expect(
      target.setVerificationCode({
        chainId: chainId.toString(),
        safeAddress,
        account: account,
        code: newCode.toString(),
        codeGenerationDate: newCodeGenerationDate,
      }),
    ).rejects.toThrow(EmailAddressDoesNotExistError);
  });

  it('updating email verification fails on unknown emails', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const account = faker.finance.ethereumAddress();

    await expect(
      target.verifyEmail({
        chainId: chainId.toString(),
        safeAddress,
        account: account,
      }),
    ).rejects.toThrow(EmailAddressDoesNotExistError);
  });

  it('gets only verified email addresses associated with a given safe address', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const verifiedAccounts = [
      {
        emailAddress: new EmailAddress(faker.internet.email()),
        account: faker.finance.ethereumAddress(),
        code: faker.number.int({ max: 999998 }).toString(),
        codeGenerationDate: faker.date.recent(),
        unsubscriptionToken: faker.string.uuid(),
      },
      {
        emailAddress: new EmailAddress(faker.internet.email()),
        account: faker.finance.ethereumAddress(),
        code: faker.number.int({ max: 999998 }).toString(),
        codeGenerationDate: faker.date.recent(),
        unsubscriptionToken: faker.string.uuid(),
      },
    ];
    const nonVerifiedAccounts = [
      {
        emailAddress: new EmailAddress(faker.internet.email()),
        account: faker.finance.ethereumAddress(),
        code: faker.number.int({ max: 999998 }).toString(),
        codeGenerationDate: faker.date.recent(),
        unsubscriptionToken: faker.string.uuid(),
      },
      {
        emailAddress: new EmailAddress(faker.internet.email()),
        account: faker.finance.ethereumAddress(),
        code: faker.number.int({ max: 999998 }).toString(),
        codeGenerationDate: faker.date.recent(),
        unsubscriptionToken: faker.string.uuid(),
      },
    ];
    for (const {
      emailAddress,
      account,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    } of verifiedAccounts) {
      await target.saveEmail({
        chainId,
        safeAddress,
        emailAddress,
        account,
        code,
        codeGenerationDate,
        unsubscriptionToken,
      });
      await target.verifyEmail({
        chainId: chainId,
        safeAddress,
        account,
      });
    }
    for (const {
      emailAddress,
      account,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    } of nonVerifiedAccounts) {
      await target.saveEmail({
        chainId,
        safeAddress,
        emailAddress,
        account,
        code,
        codeGenerationDate,
        unsubscriptionToken,
      });
    }

    const result = await target.getVerifiedAccountEmailsBySafeAddress({
      chainId,
      safeAddress,
    });

    expect(result).toEqual(
      verifiedAccounts.map((verifiedAccount) => ({
        email: verifiedAccount.emailAddress.value,
      })),
    );
  });

  it('deletes emails successfully', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const account = faker.finance.ethereumAddress();
    const code = faker.number.int({ max: 999998 }).toString();
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();

    await target.saveEmail({
      chainId,
      safeAddress,
      emailAddress,
      account,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });
    await target.deleteEmail({
      chainId,
      safeAddress,
      account,
    });

    await expect(
      target.getEmail({
        chainId,
        safeAddress,
        account,
      }),
    ).rejects.toThrow(EmailAddressDoesNotExistError);
  });

  it('deleting a non-existent email throws', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const account = faker.finance.ethereumAddress();

    await expect(
      target.deleteEmail({
        chainId,
        safeAddress,
        account,
      }),
    ).rejects.toThrow(EmailAddressDoesNotExistError);
  });

  it('update from previously unverified emails successfully', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const prevEmailAddress = new EmailAddress(faker.internet.email());
    const emailAddress = new EmailAddress(faker.internet.email());
    const account = faker.finance.ethereumAddress();
    const code = faker.string.numeric();
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();

    await target.saveEmail({
      chainId,
      safeAddress,
      emailAddress: prevEmailAddress,
      account,
      code: faker.string.numeric(),
      codeGenerationDate: faker.date.recent(),
      unsubscriptionToken,
    });

    await target.updateEmail({
      chainId,
      safeAddress,
      emailAddress,
      account,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });

    const email = await target.getEmail({
      chainId,
      safeAddress,
      account,
    });

    expect(email).toMatchObject({
      chainId,
      emailAddress,
      isVerified: false,
      safeAddress,
      account,
      verificationCode: code,
      verificationSentOn: null,
    });
  });

  it('update from previously verified emails successfully', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const prevEmailAddress = new EmailAddress(faker.internet.email());
    const emailAddress = new EmailAddress(faker.internet.email());
    const account = faker.finance.ethereumAddress();
    const code = faker.string.numeric();
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();

    await target.saveEmail({
      chainId,
      safeAddress,
      emailAddress: prevEmailAddress,
      account,
      code: faker.string.numeric(),
      codeGenerationDate: faker.date.recent(),
      unsubscriptionToken,
    });

    await target.verifyEmail({
      chainId,
      safeAddress,
      account,
    });

    await target.updateEmail({
      chainId,
      safeAddress,
      emailAddress,
      account,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });

    const email = await target.getEmail({
      chainId,
      safeAddress,
      account,
    });

    expect(email).toMatchObject({
      chainId,
      emailAddress,
      isVerified: false,
      safeAddress,
      account,
      verificationCode: code,
      verificationSentOn: null,
    });
  });

  it('updating a non-existent email throws', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const account = faker.finance.ethereumAddress();
    const code = faker.string.numeric();
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();

    await expect(
      target.updateEmail({
        chainId: chainId.toString(),
        safeAddress,
        emailAddress,
        account,
        code,
        codeGenerationDate,
        unsubscriptionToken,
      }),
    ).rejects.toThrow(EmailAddressDoesNotExistError);
  });

  it('subscribes to account_recovery upon registration', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const account = faker.finance.ethereumAddress();
    const code = faker.string.numeric();
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();

    await target.saveEmail({
      chainId,
      safeAddress,
      emailAddress,
      account,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });

    const actual = await target.getSubscriptions({
      chainId,
      safeAddress,
      account,
    });

    expect(actual).toContainEqual({
      key: 'account_recovery',
      name: 'Account Recovery',
    });
  });

  it('subscribes to category', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const account = faker.finance.ethereumAddress();
    const code = faker.string.numeric();
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();
    const subscription = {
      key: faker.word.sample(),
      name: faker.word.words(2),
    };
    await sql`INSERT INTO emails.subscriptions (key, name)
              VALUES (${subscription.key}, ${subscription.name})`;
    await target.saveEmail({
      chainId,
      safeAddress,
      emailAddress,
      account,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });

    await target.subscribe({
      chainId,
      safeAddress,
      account,
      categoryKey: subscription.key,
    });

    const subscriptions = await target.getSubscriptions({
      chainId,
      safeAddress,
      account,
    });
    expect(subscriptions).toContainEqual(subscription);
  });

  it('unsubscribes from a category successfully', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const account = faker.finance.ethereumAddress();
    const code = faker.string.numeric();
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();
    const subscriptions = [
      {
        key: faker.word.sample(),
        name: faker.word.words(2),
      },
      {
        key: faker.word.sample(),
        name: faker.word.words(2),
      },
    ];
    await sql`INSERT INTO emails.subscriptions (key, name)
              VALUES (${subscriptions[0].key}, ${subscriptions[0].name}),
                     (${subscriptions[1].key}, ${subscriptions[1].name})`;
    await target.saveEmail({
      chainId,
      safeAddress,
      emailAddress,
      account,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });
    // Subscribe to two categories
    await target.subscribe({
      chainId,
      safeAddress,
      account,
      categoryKey: subscriptions[0].key,
    });
    await target.subscribe({
      chainId,
      safeAddress,
      account,
      categoryKey: subscriptions[1].key,
    });

    // Unsubscribe from one category
    const result = await target.unsubscribe({
      categoryKey: subscriptions[0].key,
      token: unsubscriptionToken,
    });

    const currentSubscriptions = await target.getSubscriptions({
      chainId,
      safeAddress,
      account,
    });
    expect(result).toContainEqual(subscriptions[0]);
    expect(currentSubscriptions).not.toContainEqual(subscriptions[0]);
  });

  it('unsubscribes from a non-existent category', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const account = faker.finance.ethereumAddress();
    const code = faker.string.numeric();
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();
    const nonExistentCategory = faker.word.sample();
    await target.saveEmail({
      chainId,
      safeAddress,
      emailAddress,
      account,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });

    // Unsubscribe from one category
    const result = await target.unsubscribe({
      categoryKey: nonExistentCategory,
      token: unsubscriptionToken,
    });

    expect(result).toHaveLength(0);
  });

  it('unsubscribes with wrong token', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const account = faker.finance.ethereumAddress();
    const code = faker.string.numeric();
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();
    const subscriptions = [
      {
        key: faker.word.sample(),
        name: faker.word.words(2),
      },
    ];
    await target.saveEmail({
      chainId,
      safeAddress,
      emailAddress,
      account,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });

    // Unsubscribe from one category
    const result = await target.unsubscribe({
      categoryKey: subscriptions[0].key,
      token: faker.string.uuid(),
    });

    expect(result).toHaveLength(0);
  });

  it('unsubscribes to all categories successfully', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const account = faker.finance.ethereumAddress();
    const code = faker.string.numeric();
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();
    const subscriptions = [
      {
        key: faker.word.sample(),
        name: faker.word.words(2),
      },
      {
        key: faker.word.sample(),
        name: faker.word.words(2),
      },
    ];
    await sql`INSERT INTO emails.subscriptions (key, name)
              VALUES (${subscriptions[0].key}, ${subscriptions[0].name}),
                     (${subscriptions[1].key}, ${subscriptions[1].name})`;
    await target.saveEmail({
      chainId,
      safeAddress,
      emailAddress,
      account,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });
    // Subscribe to two categories
    await target.subscribe({
      chainId,
      safeAddress,
      account,
      categoryKey: subscriptions[0].key,
    });
    await target.subscribe({
      chainId,
      safeAddress,
      account,
      categoryKey: subscriptions[1].key,
    });

    // Unsubscribe from one category
    await target.unsubscribeAll({
      token: unsubscriptionToken,
    });

    const currentSubscriptions = await target.getSubscriptions({
      chainId,
      safeAddress,
      account,
    });
    expect(currentSubscriptions).toHaveLength(0);
  });
});
