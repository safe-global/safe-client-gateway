import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { GetDataDecodedDto } from '../get-data-decoded.dto.entity';

export function getDataDecodedDtoBuilder(): IBuilder<GetDataDecodedDto> {
  return Builder.new<GetDataDecodedDto>()
    .with('data', faker.string.hexadecimal())
    .with('to', faker.finance.ethereumAddress());
}
