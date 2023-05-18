import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { AddConfirmationDto } from '../../entities/add-confirmation.dto';

export function addConfirmationDtoBuilder(): IBuilder<AddConfirmationDto> {
  return Builder.new<AddConfirmationDto>().with(
    'signedSafeTxHash',
    faker.datatype.hexadecimal(32),
  );
}
