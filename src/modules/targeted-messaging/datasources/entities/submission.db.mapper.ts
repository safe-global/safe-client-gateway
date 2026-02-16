import { convertToDate } from '@/datasources/common/utils';
import { Submission as DbSubmission } from '@/modules/targeted-messaging/datasources/entities/submission.entity';
import { type Submission } from '@/modules/targeted-messaging/domain/entities/submission.entity';
import { type TargetedSafe } from '@/modules/targeted-messaging/domain/entities/targeted-safe.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SubmissionDbMapper {
  map(dbSubmission: DbSubmission, targetedSafe: TargetedSafe): Submission {
    return {
      id: dbSubmission.id,
      outreachId: targetedSafe.outreachId,
      targetedSafeId: dbSubmission.targeted_safe_id,
      signerAddress: dbSubmission.signer_address,
      completionDate: convertToDate(dbSubmission.completion_date),
      created_at: convertToDate(dbSubmission.created_at),
      updated_at: convertToDate(dbSubmission.updated_at),
    };
  }
}
