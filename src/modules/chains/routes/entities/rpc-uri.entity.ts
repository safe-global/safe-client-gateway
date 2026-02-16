import { ApiProperty } from '@nestjs/swagger';
import { RpcUriAuthentication } from '@/modules/chains/domain/entities/rpc-uri-authentication.entity';
import { type RpcUri as DomainRpcUri } from '@/modules/chains/domain/entities/rpc-uri.entity';

export class RpcUri implements DomainRpcUri {
  @ApiProperty({ enum: Object.values(RpcUriAuthentication) })
  authentication!: RpcUriAuthentication;
  @ApiProperty()
  value!: string;
}
