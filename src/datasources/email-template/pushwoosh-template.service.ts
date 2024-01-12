import { Inject, Injectable } from '@nestjs/common';
import { getAddress } from 'viem';
import { IEmailTemplate } from '@/domain/interfaces/email-template.interface';
import { Chain } from '@/routes/chains/entities/chain.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable()
export class PushWooshTemplate implements IEmailTemplate {
  private readonly webAppBaseUri: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.webAppBaseUri =
      this.configurationService.getOrThrow<string>('safeWebApp.baseUri');
  }

  addressToSafeWebAppUrl(args: { chain: Chain; safeAddress: string }): string {
    return `${this.webAppBaseUri}/home?safe=${args.chain.shortName}:${args.safeAddress}`;
  }

  addressListToHtml(args: { chain: Chain; addresses: Array<string> }): string {
    const listItems = args.addresses.map((address, i, arr) => {
      const isLastItem = i === arr.length - 1;

      const checksummedAddress = getAddress(address);

      const addressHtml = this.addressToHtml({
        chain: args.chain,
        address: checksummedAddress,
      });
      const explorerLinkHtml = this.addressToExplorerLink({
        chain: args.chain,
        address: checksummedAddress,
      });

      return `<li style="padding: 12px 16px; background-color: #f4f4f4; border-radius: 6px; margin: ${
        isLastItem ? '0' : '0 0 8px 0;'
      }">${addressHtml}${explorerLinkHtml}</li>`;
    });

    return `<ul style="margin: 0; padding: 0; list-style-type: none;">${listItems.join(
      '',
    )}</ul>`;
  }

  private addressToHtml(args: { chain: Chain; address: string }): string {
    const checksummedAddress = getAddress(args.address);

    const start = checksummedAddress.slice(0, 6);
    const center = checksummedAddress.slice(6, -4);
    const end = checksummedAddress.slice(-4);

    return `<span>${start}<span style="color: #636669;">${center}</span>${end}</span>`;
  }

  private addressToExplorerLink(args: {
    chain: Chain;
    address: string;
  }): string {
    const addressedExplorerUrl =
      args.chain.blockExplorerUriTemplate.address.replace(
        '{{address}}',
        args.address,
      );
    const explorerName = new URL(addressedExplorerUrl).hostname;

    return `<a href="${addressedExplorerUrl}" alt="View on ${explorerName}" style="margin-left: 4px;">&#x2197;</a>`;
  }
}
