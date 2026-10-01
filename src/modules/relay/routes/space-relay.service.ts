// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { RelayRepository } from '@/modules/relay/domain/relay.repository';
import { WorkspaceRelayer } from '@/modules/relay/domain/relayers/workspace.relayer';
import { Relay } from '@/modules/relay/routes/entities/relay.entity';
import type { SpaceRelayDto } from '@/modules/relay/routes/entities/space-relay.dto.entity';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { assertMember } from '@/modules/spaces/domain/space-assert.utils';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

@Injectable()
export class SpaceRelayService {
  public constructor(
    private readonly workspaceRelayer: WorkspaceRelayer,
    private readonly relayRepository: RelayRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
  ) {}

  /**
   * Relays on the chain's free options first, then on the workspace's
   * allowance, which any member may spend.
   */
  public async relay(args: {
    spaceId: Space['id'];
    chainId: string;
    relayDto: SpaceRelayDto;
    authPayload: AuthPayload;
  }): Promise<Relay> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);

    const relaySubmitter = await this.workspaceRelayer.forSpace({
      spaceId: args.spaceId,
      version: args.relayDto.version,
      chainId: args.chainId,
      to: args.relayDto.to,
      data: args.relayDto.data,
    });
    const relay = await this.relayRepository.relay({
      version: args.relayDto.version,
      chainId: args.chainId,
      to: args.relayDto.to,
      data: args.relayDto.data,
      gasLimit: null,
      safeTxHash: args.relayDto.safeTxHash,
      acceptUnverifiedSimulation: args.relayDto.acceptUnverifiedSimulation,
      relaySubmitter,
    });

    return new Relay(relay);
  }
}
