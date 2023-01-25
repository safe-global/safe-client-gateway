import { DataDecoded } from '../../data-decoder/entities/data-decoded.entity';

export interface CreationTransaction {
  created: Date;
  creator: string;
  transactionHash: string;
  factoryAddress: string;
  masterCopy: string | null;
  setupData: string | null;
  dataDecoded: DataDecoded | null;
}
