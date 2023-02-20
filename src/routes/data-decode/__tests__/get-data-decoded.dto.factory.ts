import { faker } from '@faker-js/faker';
import { GetDataDecodedDto } from '../entities/get-data-decoded.dto.entity';

export default function (data?: string, to?: string): GetDataDecodedDto {
  return new GetDataDecodedDto(
    data ?? faker.datatype.hexadecimal(),
    to ?? faker.finance.ethereumAddress(),
  );
}
