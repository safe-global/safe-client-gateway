import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { DeleteSafeDelegateDto } from '../delete-safe-delegate.dto.entity';

export function deleteSafeDelegateDtoBuilder(): IBuilder<DeleteSafeDelegateDto> {
  return Builder.new<DeleteSafeDelegateDto>()
    .with('delegate', faker.finance.ethereumAddress())
    .with('safe', faker.finance.ethereumAddress())
    .with('signature', faker.string.hexadecimal({ length: 32 }));
}
