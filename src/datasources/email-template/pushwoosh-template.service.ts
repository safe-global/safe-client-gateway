import { Injectable } from '@nestjs/common';
import { getAddress } from 'viem';
import { IEmailTemplate } from '@/domain/interfaces/email-template.interface';
import { Chain } from '@/routes/chains/entities/chain.entity';

@Injectable()
export class PushWooshTemplate implements IEmailTemplate {
  addressToHtml(args: { chain: Chain; address: string }): string {
    const CSS_ID = 'address-center';

    const checksummedAddress = getAddress(args.address);

    const addressedExplorerUrl = this.getAddressedExplorerUrl({
      chain: args.chain,
      address: checksummedAddress,
    });

    const start = checksummedAddress.slice(0, 6);
    const center = checksummedAddress.slice(6, -4);
    const end = checksummedAddress.slice(-4);

    return `<a href="${addressedExplorerUrl}">${start}<span id="${CSS_ID}">${center}</span>${end}</a>`;
  }

  addressListToHtml(args: { chain: Chain; addresses: Array<string> }): string {
    const listItems = args.addresses.map((owner) => {
      const addressHtml = this.addressToHtml({
        chain: args.chain,
        address: owner,
      });

      return `<li>${addressHtml}</li>`;
    });

    return `<ul>${listItems.join('')}</ul>`;
  }

  getSafeWebAppUrl(args: { chain: Chain; safeAddress: string }): string {
    return `https://app.safe.global/home?safe=${args.chain.shortName}:${args.safeAddress}`;
  }

  private getAddressedExplorerUrl(args: {
    chain: Chain;
    address: string;
  }): string {
    const ADDRESS_TEMPLATE = '{{address}}';

    return args.chain.blockExplorerUriTemplate.address.replace(
      ADDRESS_TEMPLATE,
      args.address,
    );
  }
}
