import { Email } from '@/datasources/email/entities/email.entity';

export class EmailAlreadyVerifiedError extends Error {
  constructor(email: Email) {
    super(`Email address ${email.email_address} is already verified.`);
  }
}
