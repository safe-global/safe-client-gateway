import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { faker } from '@faker-js/faker';

describe('AddressInfo entity', () => {
  it('should build an AddressInfo', () => {
    const value = faker.finance.ethereumAddress();
    const name = faker.word.words();
    const logoUri = faker.internet.url({ appendSlash: false });

    const actual = new AddressInfo(value, name, logoUri);

    expect(actual.value).toStrictEqual(value);
    expect(actual.name).toStrictEqual(name);
    expect(actual.logoUri).toStrictEqual(logoUri);
  });

  it('should build an AddressInfo with null name and null logoUri if not provided', () => {
    const value = faker.finance.ethereumAddress();

    const actual = new AddressInfo(value);

    expect(actual.value).toStrictEqual(value);
    expect(actual.name).toStrictEqual(null);
    expect(actual.logoUri).toStrictEqual(null);
  });

  it('should build an AddressInfo with null name and null logoUri if they are null', () => {
    const value = faker.finance.ethereumAddress();

    const actual = new AddressInfo(value, null, null);

    expect(actual.value).toStrictEqual(value);
    expect(actual.name).toStrictEqual(null);
    expect(actual.logoUri).toStrictEqual(null);
  });

  it('should build an AddressInfo with null name and null logoUri if empty strings are passed in', () => {
    const value = faker.finance.ethereumAddress();
    const name = '';
    const logoUri = '';

    const actual = new AddressInfo(value, name, logoUri);

    expect(actual.value).toStrictEqual(value);
    expect(actual.name).toStrictEqual(null);
    expect(actual.logoUri).toStrictEqual(null);
  });
});
