import { Builder, type IBuilder } from '@/__tests__/builder';
import type { CreateSubmissionDto } from '@/modules/targeted-messaging/routes/entities/create-submission.dto.entity';

export function createSubmissionDtoBuilder(): IBuilder<CreateSubmissionDto> {
  return new Builder<CreateSubmissionDto>().with('completed', true);
}
