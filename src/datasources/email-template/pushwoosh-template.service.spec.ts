import { PushWooshTemplate } from '@/datasources/email-template/pushwoosh-template.service';
import { blockExplorerUriTemplateBuilder } from '@/domain/chains/entities/__tests__/block-explorer-uri-template.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('PushWooshTemplate', () => {
  const target = new PushWooshTemplate();

  describe('addressToHtml', () => {
    it('should return an element with a checksummed address', () => {
      const explorerUrl = faker.internet.url({ appendSlash: false });
      const chain = chainBuilder()
        .with(
          'blockExplorerUriTemplate',
          blockExplorerUriTemplateBuilder()
            .with('address', `${explorerUrl}/{{address}}`)
            .build(),
        )
        .build();

      const address = faker.finance.ethereumAddress();
      const checksummedAddress = getAddress(address);

      const start = checksummedAddress.slice(0, 6);
      const center = checksummedAddress.slice(6, -4);
      const end = checksummedAddress.slice(-4);

      const expected = `<a href="${explorerUrl}/${checksummedAddress}">${start}<span id="address-center">${center}</span>${end}</a>`;

      expect(target.addressToHtml({ chain, address })).toEqual(expected);
    });
  });

  describe('addressListToHtml', () => {
    it('should return a list element with checksummed addresses', () => {
      const explorerUrl = faker.internet.url({ appendSlash: false });
      const chain = chainBuilder()
        .with(
          'blockExplorerUriTemplate',
          blockExplorerUriTemplateBuilder()
            .with('address', `${explorerUrl}/{{address}}`)
            .build(),
        )
        .build();

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

          return `<li><a href="${explorerUrl}/${checksummedAddress}">${start}<span id="address-center">${center}</span>${end}</a></li>`;
        })
        .join('')}</ul>`;

      expect(target.addressListToHtml({ chain, addresses })).toEqual(expected);
    });
  });

  describe('getSafeWebAppUrl', () => {
    it('should return a safe web app url', () => {
      const chain = chainBuilder().build();

      const safeAddress = faker.finance.ethereumAddress();
      const expected = `https://app.safe.global/home?safe=${chain.shortName}:${safeAddress}`;

      expect(target.getSafeWebAppUrl({ chain, safeAddress })).toEqual(expected);
    });
  });
});
