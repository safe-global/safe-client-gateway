import { Injectable } from '@nestjs/common';
import { getAddress } from 'viem';
import { IEmailTemplate } from '@/domain/interfaces/email-template.interface';

@Injectable()
export class PushWooshTemplate implements IEmailTemplate {
  addressToHtml(address: string): string {
    const CSS_ID = 'address-center';

    const checksummedAddress = getAddress(address);

    const start = checksummedAddress.slice(0, 6);
    const center = checksummedAddress.slice(6, -4);
    const end = checksummedAddress.slice(-4);

    return `${start}<span id="${CSS_ID}">${center}</span>${end}`;
  }

  addressListToHtml(addresses: Array<string>): string {
    return `<ul>${addresses
      .map((owner) => `<li>${this.addressToHtml(owner)}</li>`)
      .join('')}</ul>`;
  }
}
