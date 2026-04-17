// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { RpcUri as DomainRpcUri } from '@/modules/chains/domain/entities/rpc-uri.entity';
import { RpcUriAuthentication } from '@/modules/chains/domain/entities/rpc-uri-authentication.entity';

export class RpcUri implements DomainRpcUri {
  @ApiProperty({ enum: Object.values(RpcUriAuthentication) })
  authentication!: RpcUriAuthentication;
  @ApiProperty()
  value!: string;
}
