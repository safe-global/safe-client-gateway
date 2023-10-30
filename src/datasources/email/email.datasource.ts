import { Inject, Injectable } from '@nestjs/common';
import * as postgres from 'postgres';
import { IEmailDataSource } from '@/domain/interfaces/email.datasource.interface';
import { EmailVerificationCode } from '@/domain/email/entities/email-verification-code.entity';
import { Email } from '@/datasources/email/entities/email.entity';
import { VerificationStatus } from '@/datasources/email/entities/verification.status';
import { EmailAddressDoesNotExistError } from '@/datasources/email/errors/email-address-does-not-exist.error';
import { EmailAlreadyVerifiedError } from '@/datasources/email/errors/email-already-verified.error';
import { InvalidVerificationCodeError } from '@/datasources/email/errors/invalid-verification-code.error';
import { ExpiredVerificationCodeError } from '@/datasources/email/errors/expired-verification-code.error';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable()
export class EmailDatasource implements IEmailDataSource {
  private readonly verificationExpireTimeInSeconds: number;

  constructor(
    @Inject('DB_INSTANCE') private readonly sql: postgres.Sql,
    @Inject(IConfigurationService) configurationService: IConfigurationService,
  ) {
    this.verificationExpireTimeInSeconds = configurationService.getOrThrow(
      'email.verificationExpireTimeInSeconds',
    );
  }

  private _resetVerificationCode(
    sql: postgres.Sql,
    emailId: number,
  ): postgres.PendingQuery<VerificationStatus[]> {
    // TODO proper code generation
    const code = Math.floor(Math.random() * 100_000);
    return sql<VerificationStatus[]>`
        INSERT INTO emails.verification (id, verification_code)
        VALUES (${emailId}, ${code})
        ON CONFLICT (id) DO UPDATE SET verification_code = ${code},
                                       sent_on           = now()
        RETURNING *
    `;
  }

  private getEmail(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): postgres.PendingQuery<Email[]> {
    return this.sql<Email[]>`SELECT *
                             FROM emails.signer_emails
                             WHERE chain_id = ${args.chainId}
                               and safe_address = ${args.safeAddress}
                               and signer = ${args.signer}`;
  }

  async saveEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    signer: string;
  }): Promise<EmailVerificationCode> {
    return await this.sql.begin(async (sql) => {
      const [email] = await sql<Email[]>`
          INSERT INTO emails.signer_emails (chain_id, email_address, safe_address, signer)
          VALUES (${args.chainId}, ${args.emailAddress}, ${args.safeAddress}, ${args.signer})
          RETURNING *
      `;

      const [verificationStatus] = await this._resetVerificationCode(
        sql,
        email.id,
      );

      return <EmailVerificationCode>{
        emailAddress: email.email_address,
        verificationCode: verificationStatus.verification_code,
      };
    });
  }

  async resetVerificationCode(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
  }): Promise<{ emailAddress: string; verificationCode: string }> {
    const [email] = await this.getEmail(args);

    if (!email) {
      throw new EmailAddressDoesNotExistError(
        args.chainId,
        args.safeAddress,
        args.signer,
      );
    }

    if (email.verified) {
      throw new EmailAlreadyVerifiedError(email);
    }

    const [verificationStatus] = await this._resetVerificationCode(
      this.sql,
      email.id,
    );

    return <EmailVerificationCode>{
      emailAddress: email.email_address,
      verificationCode: verificationStatus.verification_code,
    };
  }

  async verifyEmail(args: {
    chainId: string;
    safeAddress: string;
    signer: string;
    code: string;
  }): Promise<void> {
    return await this.sql.begin(async (sql) => {
      const [email] = await this.getEmail(args);

      if (!email) {
        throw new EmailAddressDoesNotExistError(
          args.chainId,
          args.safeAddress,
          args.signer,
        );
      }

      // Get verification status for that email. Provided code needs to match
      const [verificationStatus] = await sql<VerificationStatus[]>`SELECT *
                                                                        from emails.verification
                                                                        WHERE id = ${email.id}
                                                                          and verification_code = ${args.code}`;

      if (!verificationStatus) {
        throw new InvalidVerificationCodeError(email, verificationStatus);
      }

      const date = Date.now();
      const timeDiffSeconds =
        (date - verificationStatus.sent_on.getTime()) / 1_000;

      if (timeDiffSeconds > this.verificationExpireTimeInSeconds) {
        throw new ExpiredVerificationCodeError(email, verificationStatus);
      }

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
