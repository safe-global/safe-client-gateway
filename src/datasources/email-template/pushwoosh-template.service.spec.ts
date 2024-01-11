import { PushWooshTemplate } from '@/datasources/email-template/pushwoosh-template.service';
import { blockExplorerUriTemplateBuilder } from '@/domain/chains/entities/__tests__/block-explorer-uri-template.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('PushWooshTemplate', () => {
  const target = new PushWooshTemplate();

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

      const expected = `<ul>${addresses
        .map((address) => {
          const checksummedAddress = getAddress(address);

          const start = checksummedAddress.slice(0, 6);
          const center = checksummedAddress.slice(6, -4);
          const end = checksummedAddress.slice(-4);

          const addressEl = `<span>${start}<span id="address-center">${center}</span>${end}</span>`;

          const linkIconEl =
            '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAADNSURBVHgBrVPRDYIwFLxHGMARcBRH8E8SoWEEN9AN3MAQjR1DR3ADGYEF6NNCNaUpWNH7aNL27vVeewV+BOmhPJ0FONoDPDOrlVin825P3sFIPMqWE5nZ9i3WUBZRwQ9TNLYnIkvJ5Ym8c3KQMokaXFw3EQLQEzOqrwq4YtVgEVzAJy6KtLI58SSx1UY85eTXxQ628Ml2j+tbJKYbEV2HxDpcbcCGWsiz1RJjsLIQlIMxGAdU6yiXR8nBSvMSrQPFvHETNg6qn19kh3/gAQvHdGfctn4LAAAAAElFTkSuQmCC" alt="Square with arrow pointing out of the top right" />';
          const linkEl = `<a href="${explorerUrl}/${checksummedAddress}" alt="View on ${hostname}">${linkIconEl}</a>`;

          return `<li>${addressEl}${linkEl}</li>`;
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

      expect(target.addressToSafeWebAppUrl({ chain, safeAddress })).toEqual(
        expected,
      );
    });
  });
});
