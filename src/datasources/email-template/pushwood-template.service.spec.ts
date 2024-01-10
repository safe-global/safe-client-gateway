import { PushwooshTemplate } from '@/datasources/email-template/pushwoosh-template.service';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('PushwoodTemplate', () => {
  const service = new PushwooshTemplate();

  describe('addressToHtml', () => {
    it('should return an element with a checksummed address', () => {
      const address = faker.finance.ethereumAddress();
      const checksummedAddress = getAddress(address);

      const start = checksummedAddress.slice(0, 6);
      const center = checksummedAddress.slice(6, -4);
      const end = checksummedAddress.slice(-4);

      const expected = `${start}<span id="address-center">${center}</span>${end}`;

      expect(service.addressToHtml(address)).toEqual(expected);
    });
  });

  describe('addressListToHtml', () => {
    it('should return a list element with checksummed addresses', () => {
      const addresses = [
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
      ];
      const checksummedAddresses = addresses.map((address) => {
        return getAddress(address);
      });

      const expected = `<ul>${checksummedAddresses
        .map((checmsummedAddress) => {
          const start = checmsummedAddress.slice(0, 6);
          const center = checmsummedAddress.slice(6, -4);
          const end = checmsummedAddress.slice(-4);

          return `<li>${start}<span id="address-center">${center}</span>${end}</li>`;
        })
        .join('')}</ul>`;

      expect(service.addressListToHtml(addresses)).toEqual(expected);
    });
  });
});
