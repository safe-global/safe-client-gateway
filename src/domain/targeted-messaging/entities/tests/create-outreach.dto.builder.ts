import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { CreateOutreachDto } from '@/domain/targeted-messaging/entities/create-outreach.dto.entity';
import { faker } from '@faker-js/faker/.';

export function createOutreachDtoBuilder(): IBuilder<CreateOutreachDto> {
  const startDate = faker.date.recent();

  return new Builder<CreateOutreachDto>()
    .with('name', faker.string.alphanumeric(5))
    .with('startDate', startDate)
    .with('endDate', faker.date.future({ refDate: startDate }));
}
