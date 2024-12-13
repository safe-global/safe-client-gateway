import { ITargetedMessagingDatasource } from '@/domain/interfaces/targeted-messaging.datasource.interface';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { CreateTargetedSafesDto } from '@/domain/targeted-messaging/entities/create-targeted-safes.dto.entity';
import { Outreach } from '@/domain/targeted-messaging/entities/outreach.entity';
import { Submission } from '@/domain/targeted-messaging/entities/submission.entity';
import { TargetedSafe } from '@/domain/targeted-messaging/entities/targeted-safe.entity';
import { ITargetedMessagingRepository } from '@/domain/targeted-messaging/targeted-messaging.repository.interface';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';

@Injectable()
export class TargetedMessagingRepository
  implements ITargetedMessagingRepository
{
  constructor(
    @Inject(ITargetedMessagingDatasource)
    private readonly datasource: ITargetedMessagingDatasource,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
  ) {}

  async getTargetedSafe(args: {
    outreachId: number;
    safeAddress: `0x${string}`;
  }): Promise<TargetedSafe> {
    return this.datasource.getTargetedSafe(args);
  }

  async createTargetedSafes(
    args: CreateTargetedSafesDto,
  ): Promise<TargetedSafe[]> {
    return this.datasource.createTargetedSafes(args);
  }

  async getSubmission(args: {
    chainId: string;
    targetedSafe: TargetedSafe;
    signerAddress: `0x${string}`;
  }): Promise<Submission> {
    const isOwner = await this.safeRepository.isOwner({
      chainId: args.chainId,
      safeAddress: args.targetedSafe.address,
      address: args.signerAddress,
    });
    if (!isOwner) {
      throw new BadRequestException('The signer is not a Safe owner');
    }
    return this.datasource.getSubmission(args);
  }

  async createSubmission(args: {
    targetedSafe: TargetedSafe;
    signerAddress: `0x${string}`;
  }): Promise<Submission> {
    return this.datasource.createSubmission(args);
  }

  async getOutreach(args: { outreachId: number }): Promise<Outreach> {
    return this.datasource.getOutreach(args.outreachId);
  }
}
