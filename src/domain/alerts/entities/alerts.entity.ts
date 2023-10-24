export type Contract = {
  address: string;
  networkId: string;
  displayName?: string;
};

export type ContractId = `${Contract['networkId']}:${Contract['address']}`;
