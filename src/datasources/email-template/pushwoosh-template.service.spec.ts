import { PushWooshTemplate } from '@/datasources/email-template/pushwoosh-template.service';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('PushWoodshTemplate', () => {
  const service = new PushWooshTemplate();

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

      const expected = `<ul>${addresses
        .map((address) => {
          const checksummedAddress = getAddress(address);

          const start = checksummedAddress.slice(0, 6);
          const center = checksummedAddress.slice(6, -4);
          const end = checksummedAddress.slice(-4);

          return `<li>${start}<span id="address-center">${center}</span>${end}</li>`;
        })
        .join('')}</ul>`;

      expect(service.addressListToHtml(addresses)).toEqual(expected);
    });
  });
});
