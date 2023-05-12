import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { CreateConfirmationDto } from '../../entities/create-confirmation.dto';

export function createConfirmationDtoBuilder(): IBuilder<CreateConfirmationDto> {
  return Builder.new<CreateConfirmationDto>().with(
    'signedSafeTxHash',
    faker.datatype.hexadecimal(32),
  );
}
