export type Contract = {
  address: string;
  chainId: string;
  displayName?: string;
};

export type ContractId = `${Contract['chainId']}:${Contract['address']}`;
