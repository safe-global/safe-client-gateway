import { faker } from '@faker-js/faker';
import { CreateDataDecodedDto } from '../entities/create-data-decoded.dto';

export default function (data?: string, to?: string): CreateDataDecodedDto {
  return <CreateDataDecodedDto>{
    data: data ?? faker.datatype.hexadecimal(),
    to: to ?? faker.finance.ethereumAddress(),
  };
}
