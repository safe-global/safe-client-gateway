describe('UserOrganizationsRepository', () => {
  describe('findOneOrFail', () => {
    it.todo('should find a user organization');

    it.todo('should throw an error if the user organization does not exist');
  });

  describe('findOne', () => {
    it.todo('should find a user organization');

    it.todo('should return null if the user organization does not exist');
  });

  describe('findOrFail', () => {
    it.todo('should find user organizations');

    it.todo('should throw an error if user organizations do not exist');
  });

  describe('find', () => {
    it.todo('should find user organizations');

    it.todo('should return an empty array if user organizations do not exist');
  });

  describe('inviteUsers', () => {
    it.todo(
      'should invite users to an organization and return the user organizations',
    );

    it.todo('should throw an error if the signer_address does not exist');

    it.todo('should throw if the signer_address has no user');

    it.todo('should throw an error if the organization does not exist');

    it.todo('should throw an error if the signer_address is not ACTIVE');

    it.todo('should create PENDING users for invitees that have no user');
  });

  describe('acceptInvite', () => {
    it.todo(
      'should accept an invite to an organization, setting the user organization and user to ACTIVE',
    );

    it.todo('should throw an error if the signer_address does not exist');

    it.todo('should throw if the signer_address has no user');

    it.todo('should throw an error if the organization does not exist');

    it.todo('should throw an error if the user organization is not INVITED');
  });

  describe('declineInvite', () => {
    it.todo(
      'should accept an invite to an organization, setting the user organization to DECLINED',
    );

    it.todo('should throw an error if the signer_address does not exist');

    it.todo('should throw if the signer_address has no user');

    it.todo('should throw an error if the organization does not exist');

    it.todo('should throw an error if the user organization is not INVITED');
  });

  describe('findAuthorizedUserOrgsOrFail', () => {
    it.todo('should find user organizations by organization id');

    it.todo('should throw an error if the signer_address does not exist');

    it.todo('should throw if the signer_address has no user');

    it.todo('should throw an error if the org does not exist');

    // Not sure if feasible
    it.todo(
      'should return an empty array if the org has no user organizations',
    );
  });

  describe('updateRole', () => {
    it.todo('should update the role of a user organization');

    it.todo('should throw an error if the signer_address does not exist');

    it.todo('should throw if the signer_address has no user');

    it.todo('should throw an error if the organization has no ACTIVE ADMINs');

    it.todo('should throw if the signer_address is not an ACTIVE ADMIN');

    it.todo('should throw an error if downgrading the last ACTIVE ADMIN');

    it.todo(
      'should throw an error if the user organization does not exist in the organization',
    );
  });

  describe('removeUser', () => {
    it.todo('should remove the user');

    it.todo('should throw an error if the signer_address does not exist');

    it.todo('should throw if the signer_address has no user');

    it.todo('should throw an error if the organization has no ACTIVE ADMINs');

    it.todo('should throw if the signer_address is not an ACTIVE ADMIN');

    it.todo('should throw an error if removing the last ACTIVE ADMIN');

    it.todo(
      'should throw an error if the user organization does not exist in the organization',
    );
  });
});
