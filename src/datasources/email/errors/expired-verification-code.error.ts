import { Email } from '@/datasources/email/entities/email.entity';
import { VerificationStatus } from '@/datasources/email/entities/verification.status';

export class ExpiredVerificationCodeError extends Error {
  constructor(email: Email, verificationStatus: VerificationStatus) {
    super(
      `Verification code for ${email.email_address} expired. Code: ${verificationStatus.verification_code}`,
    );
  }
}
