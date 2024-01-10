import { Inject, Injectable } from '@nestjs/common';
import { getAddress } from 'viem';
import { IEmailTemplate } from '@/domain/interfaces/email-template.interface';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';

@Injectable()
export class PushWooshTemplate implements IEmailTemplate {
  constructor(
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
  ) {}

  async addressToHtml(args: {
    chainId: string;
    address: string;
  }): Promise<string> {
    const CSS_ID = 'address-center';

    const checksummedAddress = getAddress(args.address);

    const addressedExplorerUrl = await this.getAddressedExplorerUrl({
      chainId: args.chainId,
      address: checksummedAddress,
    });

    const start = checksummedAddress.slice(0, 6);
    const center = checksummedAddress.slice(6, -4);
    const end = checksummedAddress.slice(-4);

    return `<a href="${addressedExplorerUrl}">${start}<span id="${CSS_ID}">${center}</span>${end}</a>`;
  }

  async addressListToHtml(args: {
    chainId: string;
    addresses: Array<string>;
  }): Promise<string> {
    const listItems = await Promise.all(
      args.addresses.map(async (owner) => {
        const addressHtml = await this.addressToHtml({
          chainId: args.chainId,
          address: owner,
        });

        return `<li>${addressHtml}</li>`;
      }),
    );

    return `<ul>${listItems.join('')}</ul>`;
  }

  async getSafeWebAppUrl(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<string> {
    const { shortName } = await this.chainsRepository.getChain(args.chainId);

    return `https://app.safe.global/home?safe=${shortName}:${args.safeAddress}`;
  }

  private async getAddressedExplorerUrl(args: {
    chainId: string;
    address: string;
  }): Promise<string> {
    const ADDRESS_TEMPLATE = '{{address}}';

    const { blockExplorerUriTemplate } = await this.chainsRepository.getChain(
      args.chainId,
    );

    return blockExplorerUriTemplate.address.replace(
      ADDRESS_TEMPLATE,
      args.address,
    );
  }
}
