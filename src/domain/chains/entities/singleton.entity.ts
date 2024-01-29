export interface Singleton {
  address: string;
  version: string;
  deployer: string;
  deployedBlockNumber: number;
  lastIndexedBlockNumber: number;
  l2: boolean;
}
