import { IConfigurationService } from '@/config/configuration.service.interface';
import { PushWooshTemplate } from '@/datasources/email-template/pushwoosh-template.service';
import { blockExplorerUriTemplateBuilder } from '@/domain/chains/entities/__tests__/block-explorer-uri-template.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

const configurationService = {
  getOrThrow: jest.fn(),
} as unknown as IConfigurationService;

const configurationServiceMock = jest.mocked(configurationService);

describe('PushWooshTemplate', () => {
  const webAppBaseUri = faker.internet.url({ appendSlash: false });

  configurationServiceMock.getOrThrow.mockImplementation((key) => {
    if (key === 'safeWebApp.baseUri') {
      return webAppBaseUri;
    }
    throw new Error(`Unexpected key: ${key}`);
  });

  const target = new PushWooshTemplate(configurationServiceMock);

  describe('addressListToHtml', () => {
    it('should return a list element with checksummed addresses', () => {
      const explorerUrl = faker.internet.url({ appendSlash: false });
      const { hostname } = new URL(explorerUrl);
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

      const expected = `<ul style="margin: 0; padding: 0; list-style-type: none;">${addresses
        .map((address, i, arr) => {
          const isLastItem = i === arr.length - 1;

          const checksummedAddress = getAddress(address);

          const start = checksummedAddress.slice(0, 6);
          const center = checksummedAddress.slice(6, -4);
          const end = checksummedAddress.slice(-4);

          const addressEl = `<span>${start}<span style="color: #636669;">${center}</span>${end}</span>`;
          const linkEl = `<a href="${explorerUrl}/${checksummedAddress}" alt="View on ${hostname}" style="margin-left: 4px;">&#x2197;</a>`;

          return `<li style="padding: 12px 16px; background-color: #f4f4f4; border-radius: 6px; margin: ${
            isLastItem ? '0' : '0 0 8px 0;'
          }">${addressEl}${linkEl}</li>`;
        })
        .join('')}</ul>`;

      expect(target.addressListToHtml({ chain, addresses })).toEqual(expected);
    });
  });

  describe('getSafeWebAppUrl', () => {
    it('should return a safe web app url', () => {
      const chain = chainBuilder().build();

      const safeAddress = faker.finance.ethereumAddress();
      const expected = `${webAppBaseUri}/home?safe=${chain.shortName}:${safeAddress}`;

      expect(target.addressToSafeWebAppUrl({ chain, safeAddress })).toEqual(
        expected,
      );
    });
  });
});
