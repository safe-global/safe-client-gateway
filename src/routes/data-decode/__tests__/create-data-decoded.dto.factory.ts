import { faker } from '@faker-js/faker';
import { CreateDataDecodedDto } from '../entities/create-data-decoded.dto';

export default function (data?: string, to?: string): CreateDataDecodedDto {
  return new CreateDataDecodedDto(
    data ?? faker.datatype.hexadecimal(),
    to ?? faker.finance.ethereumAddress(),
  );
}
