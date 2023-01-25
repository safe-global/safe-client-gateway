import { DataDecoded } from '../../data-decoder/entities/data-decoded.entity';

export interface CreationTransaction {
  created: Date;
  creator: string;
  transactionHash: string;
  factoryAddress: string | null;
  masterCopy: string | null;
  setupData: string | null;
  dataDecoded: DataDecoded | null;
}
