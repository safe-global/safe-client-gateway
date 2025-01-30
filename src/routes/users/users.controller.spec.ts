describe('UsersController', () => {
  describe('GET /v1/users', () => {
    it.todo('should return the user with wallets');

    // Note: we could extensively test JWT validity but it is covered in the AuthGuard tests
    it.todo('should return a 401 if not authenticated');

    it.todo('should return a 401 is the AuthPayload is empty');

    it.todo('should return a 404 if the user is not found');
  });

  describe('DELETE /v1/users', () => {
    it.todo('should delete the user');

    // Note: we could extensively test JWT validity but it is covered in the AuthGuard tests
    it.todo('should return a 401 if not authenticated');

    it.todo('should return a 401 is the AuthPayload is empty');

    it.todo('should return a 404 if the user is not found');
  });

  describe('POST /v1/users/wallet', () => {
    it.todo('should create a user with a wallet');

    // Note: we could extensively test JWT validity but it is covered in the AuthGuard tests
    it.todo('should return a 401 if not authenticated');

    it.todo('should return a 401 is the AuthPayload is empty');

    it.todo('should return a 409 if the wallet already exists');
  });

  describe('DELETE /v1/users/wallet/:walletAddress', () => {
    it.todo('should delete a wallet from a user');

    // Note: we could extensively test JWT validity but it is covered in the AuthGuard tests
    it.todo('should return a 401 if not authenticated');

    it.todo('should return a 401 is the AuthPayload is empty');

    it.todo('should return a 409 if the authenticated one');

    it.todo('should return a 404 if the user is not found');

    it.todo('should return a 400 if the wallet is the last one');

    it.todo('should return a 409 if the wallet could not be removed');
  });
});
