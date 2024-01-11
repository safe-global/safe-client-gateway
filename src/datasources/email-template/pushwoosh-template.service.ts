import { Injectable } from '@nestjs/common';
import { getAddress } from 'viem';
import { IEmailTemplate } from '@/domain/interfaces/email-template.interface';
import { Chain } from '@/routes/chains/entities/chain.entity';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class PushWooshTemplate implements IEmailTemplate {
  addressToSafeWebAppUrl(args: { chain: Chain; safeAddress: string }): string {
    return `https://app.safe.global/home?safe=${args.chain.shortName}:${args.safeAddress}`;
  }

  addressListToHtml(args: { chain: Chain; addresses: Array<string> }): string {
    const listItems = args.addresses.map((owner) => {
      const checksummedAddress = getAddress(owner);

      const addressHtml = this.addressToHtml({
        chain: args.chain,
        address: checksummedAddress,
      });
      const explorerLinkHtml = this.addressToExplorerLink({
        chain: args.chain,
        address: checksummedAddress,
      });

      return `<li>${addressHtml}${explorerLinkHtml}</li>`;
    });

    return `<ul>${listItems.join('')}</ul>`;
  }

  private addressToHtml(args: { chain: Chain; address: string }): string {
    const CSS_ID = 'address-center';

    const checksummedAddress = getAddress(args.address);

    const start = checksummedAddress.slice(0, 6);
    const center = checksummedAddress.slice(6, -4);
    const end = checksummedAddress.slice(-4);

    return `<span>${start}<span id="${CSS_ID}">${center}</span>${end}</span>`;
  }

  private addressToExplorerLink(args: {
    chain: Chain;
    address: string;
  }): string {
    const ADDRESS_TEMPLATE = '{{address}}';

    const addressedExplorerUrl =
      args.chain.blockExplorerUriTemplate.address.replace(
        ADDRESS_TEMPLATE,
        args.address,
      );
    const explorerName = new URL(addressedExplorerUrl).hostname;

    const base64LinkIcon = this.imageToBase64(
      join(__dirname, 'assets', 'link.png'),
    );
    const linkIconAlt = 'Square with arrow pointing out of the top right';
    const linkIconEl = `<img src="data:image/png;base64,${base64LinkIcon}" alt="${linkIconAlt}" />`;

    return `<a href="${addressedExplorerUrl}" alt="View on ${explorerName}">${linkIconEl}</a>`;
  }

  private imageToBase64(path: string) {
    const file = readFileSync(path);
    return file.toString('base64');
  }
}
