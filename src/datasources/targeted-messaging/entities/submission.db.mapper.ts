import { Submission as DbSubmission } from '@/datasources/targeted-messaging/entities/submission.entity';
import { Submission } from '@/domain/targeted-messaging/entities/submission.entity';
import { TargetedSafe } from '@/domain/targeted-messaging/entities/targeted-safe.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SubmissionDbMapper {
  map(dbSubmission: DbSubmission, targetedSafe: TargetedSafe): Submission {
    return {
      id: dbSubmission.id,
      outreachId: targetedSafe.outreachId,
      targetedSafeId: dbSubmission.targeted_safe_id,
      signerAddress: dbSubmission.signer_address,
      completionDate: this.parseDate(dbSubmission.completion_date),
      created_at: this.parseDate(dbSubmission.created_at),
      updated_at: this.parseDate(dbSubmission.updated_at),
    };
  }

  private parseDate(date: Date | string): Date {
    return date instanceof Date ? date : new Date(date);
  }
}
