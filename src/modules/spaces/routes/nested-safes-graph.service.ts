// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { type Address, getAddress } from 'viem';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { findSimilarAddressPairs } from '@/modules/owners/routes/utils/address-poisoning';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import { buildNestedSafesGraph } from '@/modules/spaces/domain/nested-safes-graph.builder';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/space-safes.repository.interface';
import {
  type NestedSafesGraphNodeDto,
  NestedSafesGraphResponse,
  type NodeTrust,
} from '@/modules/spaces/routes/entities/nested-safes-graph.entity';
import { assertMember } from '@/modules/spaces/routes/utils/space-assert.utils';
import { IMembersRepository } from '@/modules/users/domain/members.repository.interface';

const MAX_DEPTH = 6;
const MAX_NODES = 200;

@Injectable()
export class NestedSafesGraphService {
  public constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
  ) {}

  public async get(args: {
    spaceId: Space['id'];
    chainId: string;
    authPayload: AuthPayload;
  }): Promise<NestedSafesGraphResponse> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);

    const spaceSafes = await this.spaceSafesRepository.findBySpaceId(
      args.spaceId,
    );
    const seeds = spaceSafes
      .filter((safe) => safe.chainId === args.chainId)
      .map((safe) => getAddress(safe.address));
    const memberSet = new Set(seeds.map((address) => address.toLowerCase()));

    const graph = await buildNestedSafesGraph({
      seeds,
      memberSet,
      fetchOwnedSafes: async (ownerAddress) => {
        const list = await this.safeRepository.getSafesByOwner({
          chainId: args.chainId,
          ownerAddress,
        });
        return list.safes.map((address) => getAddress(address));
      },
      maxDepth: MAX_DEPTH,
      maxNodes: MAX_NODES,
    });

    const suspicious = this.detectSuspicious(
      graph.nodes.map((node) => node.address),
    );

    const nodes: Array<NestedSafesGraphNodeDto> = graph.nodes.map((node) => ({
      address: node.address,
      // Names are resolved client-side (the address book is per-user/space).
      name: null,
      isSpaceMember: node.isSpaceMember,
      trust: this.deriveTrust(
        node.isSpaceMember,
        suspicious.has(node.address.toLowerCase()),
      ),
    }));

    return {
      chainId: args.chainId,
      nodes,
      edges: graph.edges,
      truncated: graph.truncated,
      depthReached: graph.depthReached,
    };
  }

  private detectSuspicious(addresses: Array<Address>): Set<string> {
    const suspicious = new Set<string>();
    const pairs = findSimilarAddressPairs(addresses);
    for (const [i, j] of pairs) {
      suspicious.add(addresses[i].toLowerCase());
      suspicious.add(addresses[j].toLowerCase());
    }
    return suspicious;
  }

  private deriveTrust(
    isSpaceMember: boolean,
    isSuspicious: boolean,
  ): NodeTrust {
    if (isSuspicious) return 'suspicious';
    return isSpaceMember ? 'trusted' : 'unknown';
  }
}
