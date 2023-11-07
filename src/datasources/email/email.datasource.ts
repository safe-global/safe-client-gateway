import { Inject, Injectable } from '@nestjs/common';
import * as postgres from 'postgres';
import { IEmailDataSource } from '@/domain/interfaces/email.datasource.interface';
import { EmailVerificationCode } from '@/domain/email/entities/email-verification-code.entity';
import { VerificationStatus } from '@/datasources/email/entities/verification.status';
import { EmailAddressDoesNotExistError } from '@/datasources/email/errors/email-address-does-not-exist.error';
import { Email } from '@/datasources/email/entities/email.entity';

@Injectable()
export class EmailDataSource implements IEmailDataSource {
  constructor(@Inject('DB_INSTANCE') private readonly sql: postgres.Sql) {}

  private _setVerificationCode(args: {
    sql: postgres.Sql;
    emailId: number;
    code: number;
  }): postgres.PendingQuery<VerificationStatus[]> {
    return args.sql<VerificationStatus[]>`
        INSERT INTO emails.verification (id, verification_code)
        VALUES (${args.emailId}, ${args.code})
        ON CONFLICT (id) DO UPDATE SET verification_code = ${args.code},
                                       sent_on           = now()
        RETURNING *
    `;
  }

  private async _getEmail(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<Email> {
    const [email] = await this.sql<Email[]>`SELECT *
                                            FROM emails.signer_emails
                                            WHERE chain_id = ${args.chainId}
                                              and safe_address = ${args.safeAddress}
                                              and signer = ${args.signer}`;

    if (!email) {
      throw new EmailAddressDoesNotExistError(
        args.chainId,
        args.safeAddress,
        args.signer,
      );
    }

    return email;
  }

  async saveEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    signer: string;
    code: number;
  }): Promise<EmailVerificationCode> {
    return await this.sql.begin(async (sql) => {
      const [email] = await sql<Email[]>`
          INSERT INTO emails.signer_emails (chain_id, email_address, safe_address, signer)
          VALUES (${args.chainId}, ${args.emailAddress}, ${args.safeAddress}, ${args.signer})
          RETURNING *
      `;

      const [verificationStatus] = await this._setVerificationCode({
        sql,
        emailId: email.id,
        code: args.code,
      });

      return <EmailVerificationCode>{
        emailAddress: email.email_address,
        verificationCode: verificationStatus.verification_code,
      };
    });
  }

  async setVerificationCode(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    code: number;
  }): Promise<{ emailAddress: string; verificationCode: string }> {
    const email = await this._getEmail(args);

    const [verificationStatus] = await this._setVerificationCode({
      sql: this.sql,
      emailId: email.id,
      code: args.code,
    });

    return <EmailVerificationCode>{
      emailAddress: email.email_address,
      verificationCode: verificationStatus.verification_code,
    };
  }

  async verifyEmail(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<void> {
    return await this.sql.begin(async (sql) => {
      const email = await this._getEmail(args);

      // Deletes email verification entry
      await sql`DELETE
                FROM emails.verification
                WHERE id = ${email.id}
      `;

      // Sets email as verified
      await sql`
          UPDATE emails.signer_emails
          SET verified = true
          WHERE id = ${email.id}
      `;
    });
  }
}
