export const ORDER_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/swaps/order.json';

export const orderSchema = {
  $id: ORDER_SCHEMA_ID,
  type: 'object',
  properties: {
    sellToken: { type: 'string' },
    buyToken: { type: 'string' },
    receiver: {
      oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
    },
    sellAmount: { type: 'string' },
    buyAmount: { type: 'string' },
    validTo: { type: 'integer' },
    appData: { type: 'string' },
    feeAmount: { type: 'string' },
    kind: { type: 'string', enum: ['buy', 'sell'] },
    partiallyFillable: { type: 'boolean' },
    sellTokenBalance: {
      type: 'string',
      enum: ['erc20', 'internal', 'external'],
    },
    buyTokenBalance: { type: 'string', enum: ['erc20', 'internal'] },
    signingScheme: {
      type: 'string',
      enum: ['eip712', 'ethsign', 'presign', 'eip1271'],
    },
    signature: { type: 'string' },
    from: {
      oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
    },
    quoteId: {
      oneOf: [{ type: 'integer' }, { type: 'null', nullable: true }],
    },
    creationDate: { type: 'string', isDate: true },
    class: { type: 'string', enum: ['market', 'limit', 'liquidity'] },
    owner: { type: 'string' },
    uid: { type: 'string' },
    availableBalance: {
      oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
    },
    executedSellAmount: { type: 'string' },
    executedSellAmountBeforeFees: { type: 'string' },
    executedBuyAmount: { type: 'string' },
    executedFeeAmount: { type: 'string' },
    invalidated: { type: 'boolean' },
    status: {
      type: 'string',
      enum: [
        'presignaturePending',
        'open',
        'fulfilled',
        'cancelled',
        'expired',
      ],
    },
    fullFeeAmount: { type: 'string' },
    isLiquidityOrder: { type: 'boolean' },
    ethflowData: {
      oneOf: [
        {
          type: 'object',
          properties: {
            refundTxHash: {
              oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
            },
            userValidTo: { type: 'integer' },
          },
        },
        { type: 'null', nullable: true },
      ],
    },
    onchainUser: {
      oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
    },
    onchainOrderData: {
      type: ['object'],
      properties: {
        sender: { type: 'string' },
        placementError: {
          oneOf: [
            {
              type: 'string',
              enum: [
                'QuoteNotFound',
                'ValidToTooFarInFuture',
                'PreValidationError',
              ],
            },
            { type: 'null', nullable: true },
          ],
        },
      },
    },
    executedSurplusFee: {
      oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
    },
    fullAppData: {
      oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
    },
  },
  required: [
    'sellToken',
    'buyToken',
    'sellAmount',
    'buyAmount',
    'validTo',
    'appData',
    'feeAmount',
    'kind',
    'partiallyFillable',
    'sellTokenBalance',
    'buyTokenBalance',
    'signingScheme',
    'signature',
    'creationDate',
    'class',
    'owner',
    'uid',
    'executedSellAmount',
    'executedSellAmountBeforeFees',
    'executedBuyAmount',
    'executedFeeAmount',
    'invalidated',
    'status',
    'fullFeeAmount',
    'isLiquidityOrder',
  ],
};
