// SPDX-License-Identifier: FSL-1.1-MIT
import { convertToDate } from '@/modules/targeted-messaging/datasources/entities/utils';
import { Submission as DbSubmission } from '@/modules/targeted-messaging/datasources/entities/submission.entity';
import { Submission } from '@/modules/targeted-messaging/domain/entities/submission.entity';
import { TargetedSafe } from '@/modules/targeted-messaging/domain/entities/targeted-safe.entity';
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
