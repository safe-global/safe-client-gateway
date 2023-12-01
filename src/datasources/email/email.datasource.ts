import { Inject, Injectable } from '@nestjs/common';
import * as postgres from 'postgres';
import { IEmailDataSource } from '@/domain/interfaces/email.datasource.interface';
import { EmailAddressDoesNotExistError } from '@/datasources/email/errors/email-address-does-not-exist.error';
import {
  Email as DomainEmail,
  EmailAddress,
} from '@/domain/email/entities/email.entity';

interface Email {
  id: number;
  chain_id: number;
  email_address: string;
  safe_address: string;
  signer: string;
  verified: boolean;
  verification_code: string | null;
  verification_code_generated_on: Date | null;
  verification_sent_on: Date | null;
}

@Injectable()
export class EmailDataSource implements IEmailDataSource {
  constructor(@Inject('DB_INSTANCE') private readonly sql: postgres.Sql) {}

  async getVerifiedSignerEmailsBySafeAddress(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<{ email: string }[]> {
    const emails = await this.sql<{ email_address: string }[]>`
        SELECT email_address
        FROM emails.signer_emails
        WHERE chain_id = ${args.chainId}
          AND safe_address = ${args.safeAddress}
          AND verified is true
        ORDER by id`;

    return emails.map((email) => ({ email: email.email_address }));
  }

  async getEmail(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<DomainEmail> {
    const [email] = await this.sql<Email[]>`SELECT *
                                            FROM emails.signer_emails
                                            WHERE chain_id = ${args.chainId}
                                              AND safe_address = ${args.safeAddress}
                                              AND signer = ${args.signer}`;
    if (!email) {
      throw new EmailAddressDoesNotExistError(
        args.chainId,
        args.safeAddress,
        args.signer,
      );
    }

    return <DomainEmail>{
      chainId: email.chain_id.toString(),
      emailAddress: new EmailAddress(email.email_address),
      isVerified: email.verified,
      safeAddress: email.safe_address,
      signer: email.signer,
      verificationCode: email.verification_code,
      verificationGeneratedOn: email.verification_code_generated_on,
      verificationSentOn: email.verification_sent_on,
    };
  }

  async saveEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: EmailAddress;
    signer: string;
    code: string;
    codeGenerationDate: Date;
  }): Promise<void> {
    return await this.sql.begin(async (sql) => {
      await sql<Email[]>`
          INSERT INTO emails.signer_emails (chain_id, email_address, safe_address, signer, verification_code,
                                            verification_code_generated_on)
          VALUES (${args.chainId}, ${args.emailAddress.value}, ${args.safeAddress}, ${args.signer}, ${args.code},
                  ${args.codeGenerationDate})
          RETURNING *
      `;
    });
  }

  async setVerificationCode(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    code: string;
    codeGenerationDate: Date;
  }): Promise<void> {
    const [email] = await this.sql<Email[]>`UPDATE emails.signer_emails
                                            SET verification_code              = ${args.code},
                                                verification_code_generated_on = ${args.codeGenerationDate}
                                            WHERE chain_id = ${args.chainId}
                                              AND safe_address = ${args.safeAddress}
                                              AND signer = ${args.signer}
                                            RETURNING *`;

    if (!email) {
      throw new EmailAddressDoesNotExistError(
        args.chainId,
        args.safeAddress,
        args.signer,
      );
    }
  }

  async setVerificationSentDate(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    sentOn: Date;
  }): Promise<void> {
    const [email] = await this.sql<Email[]>`UPDATE emails.signer_emails
                                            SET verification_sent_on = ${args.sentOn}
                                            WHERE chain_id = ${args.chainId}
                                              AND safe_address = ${args.safeAddress}
                                              AND signer = ${args.signer}
                                            RETURNING *`;

    if (!email) {
      throw new EmailAddressDoesNotExistError(
        args.chainId,
        args.safeAddress,
        args.signer,
      );
    }
  }

  async verifyEmail(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<void> {
    const [email] = await this.sql<Email[]>`UPDATE emails.signer_emails
                                            SET verified          = true,
                                                verification_code = null
                                            WHERE chain_id = ${args.chainId}
                                              AND safe_address = ${args.safeAddress}
                                              AND signer = ${args.signer}
                                            RETURNING *`;

    if (!email) {
      throw new EmailAddressDoesNotExistError(
        args.chainId,
        args.safeAddress,
        args.signer,
      );
    }
  }
}
