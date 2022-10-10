export class Contract {
  address: string;
  name: string;
  displayName: string;
  logoUri: string;
  contractAbi?: object;
  trustedForDelegateCall: boolean;
}
