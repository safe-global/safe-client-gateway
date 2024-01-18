import { Inject, Injectable } from '@nestjs/common';
import * as postgres from 'postgres';
import { IEmailDataSource } from '@/domain/interfaces/email.datasource.interface';
import { EmailAddressDoesNotExistError } from '@/datasources/email/errors/email-address-does-not-exist.error';
import {
  Email as DomainEmail,
  EmailAddress,
} from '@/domain/email/entities/email.entity';
import { Subscription as DomainSubscription } from '@/domain/email/entities/subscription.entity';

interface Email {
  id: number;
  chain_id: number;
  email_address: string;
  safe_address: string;
  account: string;
  verified: boolean;
  verification_code: string | null;
  verification_code_generated_on: Date | null;
  verification_sent_on: Date | null;
  unsubscription_token: string;
}

interface Subscription {
  id: number;
  key: string;
  name: string;
}

@Injectable()
export class EmailDataSource implements IEmailDataSource {
  constructor(@Inject('DB_INSTANCE') private readonly sql: postgres.Sql) {}

  async getVerifiedAccountEmailsBySafeAddress(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<{ email: string }[]> {
    const emails = await this.sql<{ email_address: string }[]>`
        SELECT email_address
        FROM emails.account_emails
        WHERE chain_id = ${args.chainId}
          AND safe_address = ${args.safeAddress}
          AND verified is true
        ORDER by id`;

    return emails.map((email) => ({ email: email.email_address }));
  }

  async getEmail(args: {
    chainId: string;
    safeAddress: string;
    account: string;
  }): Promise<DomainEmail> {
    const [email] = await this.sql<Email[]>`SELECT *
                                            FROM emails.account_emails
                                            WHERE chain_id = ${args.chainId}
                                              AND safe_address = ${args.safeAddress}
                                              AND account = ${args.account}`;
    if (!email) {
      throw new EmailAddressDoesNotExistError(
        args.chainId,
        args.safeAddress,
        args.account,
      );
    }

    return <DomainEmail>{
      chainId: email.chain_id.toString(),
      emailAddress: new EmailAddress(email.email_address),
      isVerified: email.verified,
      safeAddress: email.safe_address,
      account: email.account,
      verificationCode: email.verification_code,
      verificationGeneratedOn: email.verification_code_generated_on,
      verificationSentOn: email.verification_sent_on,
    };
  }

  async saveEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: EmailAddress;
    account: string;
    code: string;
    codeGenerationDate: Date;
    unsubscriptionToken: string;
  }): Promise<void> {
    await this.sql<Email[]>`
        INSERT INTO emails.account_emails (chain_id, email_address, safe_address, account, verification_code,
                                           verification_code_generated_on, unsubscription_token)
        VALUES (${args.chainId}, ${args.emailAddress.value}, ${args.safeAddress}, ${args.account}, ${args.code},
                ${args.codeGenerationDate}, ${args.unsubscriptionToken})
        RETURNING *
    `;
  }

  async setVerificationCode(args: {
    chainId: string;
    safeAddress: string;
    account: string;
    code: string;
    codeGenerationDate: Date;
  }): Promise<void> {
    const [email] = await this.sql<Email[]>`UPDATE emails.account_emails
                                            SET verification_code              = ${args.code},
                                                verification_code_generated_on = ${args.codeGenerationDate}
                                            WHERE chain_id = ${args.chainId}
                                              AND safe_address = ${args.safeAddress}
                                              AND account = ${args.account}
                                            RETURNING *`;

    if (!email) {
      throw new EmailAddressDoesNotExistError(
        args.chainId,
        args.safeAddress,
        args.account,
      );
    }
  }

  async setVerificationSentDate(args: {
    chainId: string;
    safeAddress: string;
    account: string;
    sentOn: Date;
  }): Promise<void> {
    const [email] = await this.sql<Email[]>`UPDATE emails.account_emails
                                            SET verification_sent_on = ${args.sentOn}
                                            WHERE chain_id = ${args.chainId}
                                              AND safe_address = ${args.safeAddress}
                                              AND account = ${args.account}
                                            RETURNING *`;

    if (!email) {
      throw new EmailAddressDoesNotExistError(
        args.chainId,
        args.safeAddress,
        args.account,
      );
    }
  }

  async verifyEmail(args: {
    chainId: string;
    safeAddress: string;
    account: string;
  }): Promise<void> {
    const [email] = await this.sql<Email[]>`UPDATE emails.account_emails
                                            SET verified          = true,
                                                verification_code = null
                                            WHERE chain_id = ${args.chainId}
                                              AND safe_address = ${args.safeAddress}
                                              AND account = ${args.account}
                                            RETURNING *`;

    if (!email) {
      throw new EmailAddressDoesNotExistError(
        args.chainId,
        args.safeAddress,
        args.account,
      );
    }
  }

  async deleteEmail(args: {
    chainId: string;
    safeAddress: string;
    account: string;
  }): Promise<void> {
    const [email] = await this.sql<Email[]>`DELETE
                                            FROM emails.account_emails
                                            WHERE chain_id = ${args.chainId}
                                              AND safe_address = ${args.safeAddress}
                                              AND account = ${args.account}
                                            RETURNING *`;

    if (!email) {
      throw new EmailAddressDoesNotExistError(
        args.chainId,
        args.safeAddress,
        args.account,
      );
    }
  }

  async updateEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: EmailAddress;
    account: string;
    code: string;
    codeGenerationDate: Date;
    unsubscriptionToken: string;
  }): Promise<void> {
    const [email] = await this.sql<Email[]>`UPDATE emails.account_emails
                                            SET email_address                  = ${args.emailAddress.value},
                                                verified                       = false,
                                                verification_code              = ${args.code},
                                                verification_code_generated_on = ${args.codeGenerationDate},
                                                unsubscription_token           = ${args.unsubscriptionToken}
                                            WHERE chain_id = ${args.chainId}
                                              AND safe_address = ${args.safeAddress}
                                              AND account = ${args.account}
                                            RETURNING *`;

    if (!email) {
      throw new EmailAddressDoesNotExistError(
        args.chainId,
        args.safeAddress,
        args.account,
      );
    }
  }

  async getSubscriptions(args: {
    chainId: string;
    safeAddress: string;
    account: string;
  }): Promise<DomainSubscription[]> {
    const subscriptions = await this.sql`SELECT key, name
                                         FROM emails.subscriptions
                                                  INNER JOIN emails.account_subscriptions subs
                                                             on subscriptions.id = subs.subscription_id
                                                  INNER JOIN emails.account_emails emails on emails.id = subs.account_id
                                         WHERE chain_id = ${args.chainId}
                                           AND safe_address = ${args.safeAddress}
                                           AND account = ${args.account}`;
    return subscriptions.map(
      (subscription) =>
        <DomainSubscription>{
          key: subscription.key,
          name: subscription.name,
        },
    );
  }

  async subscribe(args: {
    chainId: string;
    safeAddress: string;
    account: string;
    categoryKey: string;
  }): Promise<DomainSubscription[]> {
    const subscriptions = await this
      .sql`INSERT INTO emails.account_subscriptions (account_id, subscription_id)
               (SELECT account_emails.id AS account_id,
                       subscriptions.id  AS subscription_id
                FROM emails.account_emails
                         CROSS JOIN emails.subscriptions
                WHERE account_emails.chain_id = ${args.chainId}
                  AND account_emails.safe_address = ${args.safeAddress}
                  AND account_emails.account = ${args.account}
                  AND subscriptions.key = ${args.categoryKey})
           RETURNING *`;

    return subscriptions.map(
      (s) =>
        <DomainSubscription>{
          key: s.key,
          name: s.name,
        },
    );
  }

  async unsubscribe(args: {
    categoryKey: string;
    token: string;
  }): Promise<DomainSubscription[]> {
    const subscriptions = await this.sql<Subscription[]>`DELETE
                                                         FROM emails.account_subscriptions
                                                             USING emails.account_emails, emails.subscriptions
                                                         WHERE account_emails.unsubscription_token = ${args.token}
                                                           AND subscriptions.key = ${args.categoryKey}
                                                           AND account_subscriptions.account_id = account_emails.id
                                                           AND account_subscriptions.subscription_id = subscriptions.id
                                                         RETURNING subscriptions.key, subscriptions.name`;
    return subscriptions.map(
      (s) =>
        <DomainSubscription>{
          key: s.key,
          name: s.name,
        },
    );
  }

  async unsubscribeAll(args: { token: string }): Promise<DomainSubscription[]> {
    const subscriptions = await this.sql`
        WITH deleted_subscriptions AS (
            DELETE FROM emails.account_subscriptions
                WHERE account_id = (SELECT id
                                    FROM emails.account_emails
                                    WHERE unsubscription_token = ${args.token})
                RETURNING subscription_id)
        SELECT subs.key, subs.name
        FROM emails.subscriptions subs
                 JOIN deleted_subscriptions deleted_subs ON subs.id = deleted_subs.subscription_id;;
    `;

    return subscriptions.map(
      (s) =>
        <DomainSubscription>{
          key: s.key,
          name: s.name,
        },
    );
  }
}
