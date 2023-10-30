import { Email } from '@/datasources/email/entities/email.entity';

export class InvalidVerificationCodeError extends Error {
  constructor(email: Email, verificationCode: string) {
    super(
      `Invalid verification code for ${email.email_address}. Code: ${verificationCode}`,
    );
  }
}
