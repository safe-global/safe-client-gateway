export interface Order {
  sellToken: string;
  buyToken: string;
  receiver: string | null;
  sellAmount: string;
  buyAmount: string;
  validTo: number;
  appData: string;
  feeAmount: string;
  kind: 'buy' | 'sell';
  partiallyFillable: boolean;
  sellTokenBalance: 'erc20' | 'internal' | 'external';
  buyTokenBalance: 'erc20' | 'internal';
  signingScheme: 'eip712' | 'ethsign' | 'presign' | 'eip1271';
  signature: string;
  from: string | null;
  quoteId: number | null;
  creationDate: Date;
  class: 'market' | 'limit' | 'liquidity';
  owner: string;
  uid: string;
  availableBalance: string | null;
  executedSellAmount: string;
  executedSellAmountBeforeFees: string;
  executedBuyAmount: string;
  executedFeeAmount: string;
  invalidated: boolean;
  status:
    | 'presignaturePending'
    | 'open'
    | 'fulfilled'
    | 'cancelled'
    | 'expired';
  fullFeeAmount: string;
  isLiquidityOrder: boolean;
  ethflowData: {
    refundTxHash: string;
    userValidTo: number;
  } | null;
  onchainUser: string | null;
  onchainOrderData: {
    sender: string;
    placementError:
      | 'QuoteNotFound'
      | 'ValidToTooFarInFuture'
      | 'PreValidationError'
      | null;
  } | null;
  executedSurplusFee: string | null;
  fullAppData: string | null;
}
