describe('WalletsRepository', () => {
  describe('findOneOrFail', () => {
    it.todo('should find a wallet');

    it.todo('should throw an error if wallet is not found');
  });

  describe('findOne', () => {
    it.todo('should find a wallet');

    it.todo('should return null if wallet is not found');
  });

  describe('findOrFail', () => {
    it.todo('should find wallets');

    it.todo('should throw an error if no wallets are found');
  });

  describe('find', () => {
    it.todo('should find wallets');

    it.todo('should return an empty array if no wallets are found');
  });

  describe('findOneByAddressOrFail', () => {
    it.todo('should find a wallet by address');

    it.todo('should find a wallet by non-checksummed address');

    it.todo('should throw an error if wallet is not found');
  });

  describe('findOneByAddress', () => {
    it.todo('should find a wallet by address');

    it.todo('should find a wallet by non-checksummed address');

    it.todo('should return null if wallet is not found');
  });

  describe('findByUser', () => {
    it.todo('should find wallets by user');

    it.todo('should throw an error if invalid user ID is provided');

    it.todo('should return an empty array if no wallets are found');
  });

  describe('create', () => {
    it.todo('should create a wallet');

    it.todo('should checksum the address before saving');

    it.todo(
      'should throw an error if wallet with the same address already exists',
    );

    it.todo('should throw an error if non-existent user ID is provided');

    it.todo('should throw if invalid wallet address is provided');
  });

  describe('deleteByAddress', () => {
    it.todo('should delete a wallet by address');

    it.todo('should delete by non-checksummed address');

    it.todo('should throw if providing invalid wallet address');

    it.todo('should throw an error if wallet is not found');
  });
});
