import { AccountDataSource } from '@/datasources/account/account.datasource';
import * as postgres from 'postgres';
import { PostgresError } from 'postgres';
import { faker } from '@faker-js/faker';
import { AccountDoesNotExistError } from '@/domain/account/errors/account-does-not-exist.error';
import * as shift from 'postgres-shift';
import configuration from '@/config/entities/__tests__/configuration';
import {
  Account,
  EmailAddress,
  VerificationCode,
} from '@/domain/account/entities/account.entity';
import { accountBuilder } from '@/domain/account/entities/__tests__/account.builder';
import { verificationCodeBuilder } from '@/domain/account/entities/__tests__/verification-code.builder';

const DB_CHAIN_ID_MAX_VALUE = 2147483647;

describe('Account DataSource Tests', () => {
  let target: AccountDataSource;
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
    target = new AccountDataSource(sql);
  });

  afterEach(async () => {
    await sql`TRUNCATE TABLE accounts, notification_types, subscriptions CASCADE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('saves account successfully', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const signer = faker.finance.ethereumAddress();
    const code = faker.string.numeric({ length: 6 });
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();

    const [account, verificationCode] = await target.createAccount({
      chainId: chainId.toString(),
      safeAddress,
      emailAddress,
      signer,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });

    expect(account).toMatchObject({
      chainId: chainId.toString(),
      emailAddress: emailAddress,
      isVerified: false,
      safeAddress: safeAddress,
      signer: signer,
    });
    expect(verificationCode).toMatchObject({
      code: code,
      generatedOn: codeGenerationDate,
      sentOn: null,
    });
  });

  it('saving account with same email throws', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const signer = faker.finance.ethereumAddress();
    const code = faker.string.numeric({ length: 6 });
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();

    await target.createAccount({
      chainId: chainId.toString(),
      safeAddress,
      emailAddress,
      signer,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });

    await expect(
      target.createAccount({
        chainId: chainId.toString(),
        safeAddress,
        emailAddress,
        signer,
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
    const signer = faker.finance.ethereumAddress();
    const code = faker.string.numeric({ length: 6 });
    const codeGenerationDate = faker.date.recent();
    const newCode = code + 1;
    const newCodeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();

    const [, verificationCode] = await target.createAccount({
      chainId: chainId.toString(),
      safeAddress,
      emailAddress,
      signer,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });

    const updatedVerificationCode = await target.setEmailVerificationCode({
      chainId: chainId.toString(),
      safeAddress,
      signer,
      code: newCode.toString(),
      codeGenerationDate: newCodeGenerationDate,
    });

    expect(updatedVerificationCode.code).not.toBe(verificationCode.code);
    expect(updatedVerificationCode.sentOn).toBeNull();
    expect(updatedVerificationCode.generatedOn).toEqual(newCodeGenerationDate);
  });

  it('setting email verification code on verified emails throws', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const signer = faker.finance.ethereumAddress();
    const code = faker.string.numeric({ length: 6 });
    const codeGenerationDate = faker.date.recent();
    const newCode = code + 1;
    const newCodeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();
    await target.createAccount({
      chainId: chainId.toString(),
      safeAddress,
      emailAddress,
      signer,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });
    await target.verifyEmail({
      chainId: chainId.toString(),
      safeAddress,
      signer,
    });

    await expect(
      target.setEmailVerificationCode({
        chainId: chainId.toString(),
        safeAddress,
        signer,
        code: newCode.toString(),
        codeGenerationDate: newCodeGenerationDate,
      }),
    ).rejects.toThrow();
  });

  it('sets verification sent date successfully', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const signer = faker.finance.ethereumAddress();
    const sentOn = faker.date.recent();
    const code = faker.string.numeric({ length: 6 });
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();

    await target.createAccount({
      chainId: chainId.toString(),
      safeAddress,
      emailAddress,
      signer,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });
    const updatedVerificationCode = await target.setEmailVerificationSentDate({
      chainId: chainId.toString(),
      safeAddress,
      signer,
      sentOn,
    });

    expect(updatedVerificationCode.sentOn).toEqual(sentOn);
  });

  it('setting verification code throws on unknown accounts', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const signer = faker.finance.ethereumAddress();
    const code = faker.number.int({ max: 999998 });
    const newCode = code + 1;
    const newCodeGenerationDate = faker.date.recent();

    await expect(
      target.setEmailVerificationCode({
        chainId: chainId.toString(),
        safeAddress,
        signer,
        code: newCode.toString(),
        codeGenerationDate: newCodeGenerationDate,
      }),
    ).rejects.toThrow();
  });

  it('updating email verification fails on unknown accounts', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const signer = faker.finance.ethereumAddress();

    await expect(
      target.verifyEmail({
        chainId: chainId.toString(),
        safeAddress,
        signer,
      }),
    ).rejects.toThrow(AccountDoesNotExistError);
  });

  it('gets only verified email addresses associated with a given safe address', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const verifiedAccounts: [Account, VerificationCode][] = [
      [
        accountBuilder()
          .with('chainId', chainId)
          .with('safeAddress', safeAddress)
          .with('isVerified', true)
          .build(),
        verificationCodeBuilder().build(),
      ],
      [
        accountBuilder()
          .with('chainId', chainId)
          .with('safeAddress', safeAddress)
          .with('isVerified', true)
          .build(),
        verificationCodeBuilder().build(),
      ],
    ];
    const nonVerifiedAccounts: [Account, VerificationCode][] = [
      [
        accountBuilder()
          .with('chainId', chainId)
          .with('safeAddress', safeAddress)
          .with('isVerified', false)
          .build(),
        verificationCodeBuilder().build(),
      ],
      [
        accountBuilder()
          .with('chainId', chainId)
          .with('safeAddress', safeAddress)
          .with('isVerified', false)
          .build(),
        verificationCodeBuilder().build(),
      ],
    ];
    for (const [account, verificationCode] of verifiedAccounts) {
      await target.createAccount({
        chainId,
        safeAddress,
        emailAddress: account.emailAddress,
        signer: account.signer,
        code: verificationCode.code,
        codeGenerationDate: verificationCode.generatedOn,
        unsubscriptionToken: account.unsubscriptionToken,
      });
      await target.verifyEmail({
        chainId: chainId,
        safeAddress,
        signer: account.signer,
      });
    }
    for (const [account, verificationCode] of nonVerifiedAccounts) {
      await target.createAccount({
        chainId,
        safeAddress,
        emailAddress: account.emailAddress,
        signer: account.signer,
        code: verificationCode.code,
        codeGenerationDate: verificationCode.generatedOn,
        unsubscriptionToken: account.unsubscriptionToken,
      });
    }

    const actual = await target.getAccounts({
      chainId,
      safeAddress,
      onlyVerified: true,
    });

    const expected = verifiedAccounts.map(([account]) => account);
    expect(actual).toEqual(expect.arrayContaining(expected));
  });

  it('gets all email addresses associated with a given safe address', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const verifiedAccounts: [Account, VerificationCode][] = [
      [
        accountBuilder()
          .with('chainId', chainId)
          .with('safeAddress', safeAddress)
          .with('isVerified', true)
          .build(),
        verificationCodeBuilder().build(),
      ],
      [
        accountBuilder()
          .with('chainId', chainId)
          .with('safeAddress', safeAddress)
          .with('isVerified', true)
          .build(),
        verificationCodeBuilder().build(),
      ],
    ];
    const nonVerifiedAccounts: [Account, VerificationCode][] = [
      [
        accountBuilder()
          .with('chainId', chainId)
          .with('safeAddress', safeAddress)
          .with('isVerified', false)
          .build(),
        verificationCodeBuilder().build(),
      ],
      [
        accountBuilder()
          .with('chainId', chainId)
          .with('safeAddress', safeAddress)
          .with('isVerified', false)
          .build(),
        verificationCodeBuilder().build(),
      ],
    ];
    for (const [account, verificationCode] of verifiedAccounts) {
      await target.createAccount({
        chainId,
        safeAddress,
        emailAddress: account.emailAddress,
        signer: account.signer,
        code: verificationCode.code,
        codeGenerationDate: verificationCode.generatedOn,
        unsubscriptionToken: account.unsubscriptionToken,
      });
      await target.verifyEmail({
        chainId: chainId,
        safeAddress,
        signer: account.signer,
      });
    }
    for (const [account, verificationCode] of nonVerifiedAccounts) {
      await target.createAccount({
        chainId,
        safeAddress,
        emailAddress: account.emailAddress,
        signer: account.signer,
        code: verificationCode.code,
        codeGenerationDate: verificationCode.generatedOn,
        unsubscriptionToken: account.unsubscriptionToken,
      });
    }

    const actual = await target.getAccounts({
      chainId,
      safeAddress,
      onlyVerified: false,
    });

    const expected = verifiedAccounts
      .concat(nonVerifiedAccounts)
      .map(([account]) => account);
    expect(actual).toEqual(expect.arrayContaining(expected));
  });

  it('deletes accounts successfully', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const signer = faker.finance.ethereumAddress();
    const code = faker.number.int({ max: 999998 }).toString();
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();

    await target.createAccount({
      chainId,
      safeAddress,
      emailAddress,
      signer,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });
    await target.deleteAccount({
      chainId,
      safeAddress,
      signer,
    });

    await expect(
      target.getAccount({
        chainId,
        safeAddress,
        signer,
      }),
    ).rejects.toThrow(AccountDoesNotExistError);
  });

  it('deleting a non-existent account throws', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const signer = faker.finance.ethereumAddress();

    await expect(
      target.deleteAccount({
        chainId,
        safeAddress,
        signer,
      }),
    ).rejects.toThrow(AccountDoesNotExistError);
  });

  it('update from previously unverified emails successfully', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const prevEmailAddress = new EmailAddress(faker.internet.email());
    const emailAddress = new EmailAddress(faker.internet.email());
    const signer = faker.finance.ethereumAddress();
    const unsubscriptionToken = faker.string.uuid();

    await target.createAccount({
      chainId,
      safeAddress,
      emailAddress: prevEmailAddress,
      signer,
      code: faker.string.numeric(),
      codeGenerationDate: faker.date.recent(),
      unsubscriptionToken,
    });

    const updatedAccount = await target.updateAccountEmail({
      chainId,
      safeAddress,
      emailAddress,
      signer,
      unsubscriptionToken,
    });

    expect(updatedAccount).toMatchObject({
      chainId,
      emailAddress,
      isVerified: false,
      safeAddress,
      signer,
    });
  });

  it('update from previously verified emails successfully', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const prevEmailAddress = new EmailAddress(faker.internet.email());
    const emailAddress = new EmailAddress(faker.internet.email());
    const signer = faker.finance.ethereumAddress();
    const unsubscriptionToken = faker.string.uuid();
    await target.createAccount({
      chainId,
      safeAddress,
      emailAddress: prevEmailAddress,
      signer,
      code: faker.string.numeric(),
      codeGenerationDate: faker.date.recent(),
      unsubscriptionToken,
    });
    await target.verifyEmail({
      chainId,
      safeAddress,
      signer,
    });

    const updatedAccount = await target.updateAccountEmail({
      chainId,
      safeAddress,
      emailAddress,
      signer,
      unsubscriptionToken,
    });

    expect(updatedAccount).toMatchObject({
      chainId,
      emailAddress,
      isVerified: false,
      safeAddress,
      signer,
    });
  });

  it('updating a non-existent account throws', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE });
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const signer = faker.finance.ethereumAddress();
    const unsubscriptionToken = faker.string.uuid();

    await expect(
      target.updateAccountEmail({
        chainId: chainId.toString(),
        safeAddress,
        emailAddress,
        signer,
        unsubscriptionToken,
      }),
    ).rejects.toThrow(AccountDoesNotExistError);
  });

  it('Has zero subscriptions when creating new account', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const signer = faker.finance.ethereumAddress();
    const code = faker.string.numeric({ length: 6 });
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();

    await target.createAccount({
      chainId,
      safeAddress,
      emailAddress,
      signer,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });
    const actual = await target.getSubscriptions({
      chainId,
      safeAddress,
      signer,
    });

    expect(actual).toHaveLength(0);
  });

  it('subscribes to category', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const signer = faker.finance.ethereumAddress();
    const code = faker.string.numeric({ length: 6 });
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();
    const subscription = {
      key: faker.word.sample(),
      name: faker.word.words(2),
    };
    await sql`INSERT INTO notification_types (key, name)
              VALUES (${subscription.key}, ${subscription.name})`;
    await target.createAccount({
      chainId,
      safeAddress,
      emailAddress,
      signer,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });

    await target.subscribe({
      chainId,
      safeAddress,
      signer,
      notificationTypeKey: subscription.key,
    });

    const subscriptions = await target.getSubscriptions({
      chainId,
      safeAddress,
      signer,
    });
    expect(subscriptions).toContainEqual(subscription);
  });

  it('unsubscribes from a category successfully', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const signer = faker.finance.ethereumAddress();
    const code = faker.string.numeric({ length: 6 });
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
    await sql`INSERT INTO notification_types (key, name)
              VALUES (${subscriptions[0].key}, ${subscriptions[0].name}),
                     (${subscriptions[1].key}, ${subscriptions[1].name})`;
    await target.createAccount({
      chainId,
      safeAddress,
      emailAddress,
      signer,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });
    // Subscribe to two categories
    await target.subscribe({
      chainId,
      safeAddress,
      signer,
      notificationTypeKey: subscriptions[0].key,
    });
    await target.subscribe({
      chainId,
      safeAddress,
      signer,
      notificationTypeKey: subscriptions[1].key,
    });

    // Unsubscribe from one category
    const result = await target.unsubscribe({
      notificationTypeKey: subscriptions[0].key,
      token: unsubscriptionToken,
    });

    const currentSubscriptions = await target.getSubscriptions({
      chainId,
      safeAddress,
      signer,
    });
    expect(result).toContainEqual(subscriptions[0]);
    expect(currentSubscriptions).not.toContainEqual(subscriptions[0]);
    expect(currentSubscriptions).toContainEqual(subscriptions[1]);
  });

  it('unsubscribes from a non-existent category', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const signer = faker.finance.ethereumAddress();
    const code = faker.string.numeric({ length: 6 });
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();
    const nonExistentCategory = faker.word.sample();
    await target.createAccount({
      chainId,
      safeAddress,
      emailAddress,
      signer,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });

    // Unsubscribe from one category
    const result = await target.unsubscribe({
      notificationTypeKey: nonExistentCategory,
      token: unsubscriptionToken,
    });

    expect(result).toHaveLength(0);
  });

  it('unsubscribes with wrong token', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const signer = faker.finance.ethereumAddress();
    const code = faker.string.numeric({ length: 6 });
    const codeGenerationDate = faker.date.recent();
    const unsubscriptionToken = faker.string.uuid();
    const subscriptions = [
      {
        key: faker.word.sample(),
        name: faker.word.words(2),
      },
    ];
    await target.createAccount({
      chainId,
      safeAddress,
      emailAddress,
      signer,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });

    // Unsubscribe from one category
    const result = await target.unsubscribe({
      notificationTypeKey: subscriptions[0].key,
      token: faker.string.uuid(),
    });

    const currentSubscriptions = await target.getSubscriptions({
      chainId,
      safeAddress,
      signer,
    });
    expect(result).toHaveLength(0);
    expect(currentSubscriptions).toHaveLength(0);
  });

  it('unsubscribes from all categories successfully', async () => {
    const chainId = faker.number.int({ max: DB_CHAIN_ID_MAX_VALUE }).toString();
    const safeAddress = faker.finance.ethereumAddress();
    const emailAddress = new EmailAddress(faker.internet.email());
    const signer = faker.finance.ethereumAddress();
    const code = faker.string.numeric({ length: 6 });
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
    await sql`INSERT INTO notification_types (key, name)
              VALUES (${subscriptions[0].key}, ${subscriptions[0].name}),
                     (${subscriptions[1].key}, ${subscriptions[1].name})`;
    await target.createAccount({
      chainId,
      safeAddress,
      emailAddress,
      signer,
      code,
      codeGenerationDate,
      unsubscriptionToken,
    });
    // Subscribe to two categories
    await target.subscribe({
      chainId,
      safeAddress,
      signer,
      notificationTypeKey: subscriptions[0].key,
    });
    await target.subscribe({
      chainId,
      safeAddress,
      signer,
      notificationTypeKey: subscriptions[1].key,
    });

    const result = await target.unsubscribeAll({
      token: unsubscriptionToken,
    });

    const currentSubscriptions = await target.getSubscriptions({
      chainId,
      safeAddress,
      signer,
    });
    expect(currentSubscriptions).toHaveLength(0);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual(subscriptions[0]);
    expect(result).toContainEqual(subscriptions[1]);
  });
});
