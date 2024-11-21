import { IAddressBooksDatasource } from '@/domain/interfaces/address-books.datasource.interface';
import { Module } from '@nestjs/common';

const addressBooksDatasource = {
  createAddressBookItem: jest.fn(),
  getAddressBook: jest.fn(),
  updateAddressBookItem: jest.fn(),
  deleteAddressBook: jest.fn(),
  deleteAddressBookItem: jest.fn(),
} as jest.MockedObjectDeep<IAddressBooksDatasource>;

@Module({
  providers: [
    {
      provide: IAddressBooksDatasource,
      useFactory: (): jest.MockedObjectDeep<IAddressBooksDatasource> => {
        return jest.mocked(addressBooksDatasource);
      },
    },
  ],
  exports: [IAddressBooksDatasource],
})
export class TestAddressBooksDataSourceModule {}
