import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { UpdateMessageSignatureDto } from '../update-message-signature.entity';

export function updateMessageSignatureDtoBuilder(): IBuilder<UpdateMessageSignatureDto> {
  return Builder.new<UpdateMessageSignatureDto>().with(
    'signature',
    faker.string.hexadecimal({ length: 32 }),
  );
}
