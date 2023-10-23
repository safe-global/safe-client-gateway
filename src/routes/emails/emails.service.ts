import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailsService {
  async registerEmail(args: {
    chainId: string;
    safeAddress: string;
    emailAddress: string;
    signature: string;
    timestamp: number;
  }): Promise<string> {
    return args.emailAddress;
  }
}
