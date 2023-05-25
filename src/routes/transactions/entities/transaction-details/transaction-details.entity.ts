import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { SafeAppInfo } from '../safe-app-info.entity';
import { TransactionData } from '../transaction-data.entity';
import { TransactionInfo } from '../transaction-info.entity';
import { TransactionStatus } from '../transaction-status.entity';
import { ModuleExecutionDetails } from './module-execution-details.entity';
import { MultisigExecutionDetails } from './multisig-execution-details.entity';

@ApiExtraModels(
  TransactionInfo,
  TransactionData,
  MultisigExecutionDetails,
  ModuleExecutionDetails,
  SafeAppInfo,
)
export class TransactionDetails {
  @ApiProperty()
  safeAddress: string;
  @ApiProperty()
  txId: string;
  @ApiPropertyOptional({ type: Number, nullable: true })
  executedAt: number | null;
  @ApiProperty()
  txStatus: TransactionStatus;
  @ApiProperty()
  txInfo: TransactionInfo;
  @ApiPropertyOptional({ type: TransactionData, nullable: true })
  txData: TransactionData | null;
  @ApiPropertyOptional({
    oneOf: [
      { $ref: getSchemaPath(MultisigExecutionDetails) },
      { $ref: getSchemaPath(ModuleExecutionDetails) },
    ],
    nullable: true,
  })
  detailedExecutionInfo:
    | MultisigExecutionDetails
    | ModuleExecutionDetails
    | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  txHash: string | null;
  @ApiPropertyOptional({ type: SafeAppInfo, nullable: true })
  safeAppInfo: SafeAppInfo | null;
}
