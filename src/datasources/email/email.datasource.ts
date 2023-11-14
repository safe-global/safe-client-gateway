import { Inject, Injectable } from '@nestjs/common';
import * as postgres from 'postgres';
import { IEmailDataSource } from '@/domain/interfaces/email.datasource.interface';
import { EmailAddressDoesNotExistError } from '@/datasources/email/errors/email-address-does-not-exist.error';
import { Email } from '@/datasources/email/entities/email.entity';

@Injectable()
export class EmailDataSource implements IEmailDataSource {
  constructor(@Inject('DB_INSTANCE') private readonly sql: postgres.Sql) {}

  async saveEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    signer: string;
    code: number;
  }): Promise<{ email: string; verificationCode: string | null }> {
    return await this.sql.begin(async (sql) => {
      const [email] = await sql<Email[]>`
          INSERT INTO emails.signer_emails (chain_id, email_address, safe_address, signer, verification_code)
          VALUES (${args.chainId}, ${args.emailAddress}, ${args.safeAddress}, ${args.signer}, ${args.code})
          RETURNING *
      `;

      return {
        email: email.email_address,
        verificationCode: email.verification_code,
      };
    });
  }

  async setVerificationCode(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    code: number;
  }): Promise<{ email: string; verificationCode: string | null }> {
    const [email] = await this.sql<Email[]>`UPDATE emails.signer_emails
                                            SET verification_code = ${args.code}
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

    return {
      email: email.email_address,
      verificationCode: email.verification_code,
    };
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
