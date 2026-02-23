import { models } from '../../../models';
import { vaultResolver } from '../resolvers/vaultResolver';
import { userResolver } from '../resolvers/userResolver';
import { proofResolver } from '../resolvers/proofResolver';

// Mock models
jest.mock('../../../models', () => ({
  models: {
    Vault: {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    Beneficiary: {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    SubSchedule: {
      create: jest.fn(),
      findAll: jest.fn()
    },
    ClaimsHistory: {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      bulkCreate: jest.fn()
    },
    Sequelize: {
      Op: {
        gte: jest.fn(),
        lte: jest.fn()
      }
    }
  }
}));

describe('GraphQL Resolvers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Vault Resolver', () => {
        it('should deny access when admin does not belong to org', async () => {
          // Simulate Organization A's admin trying to access Organization B's vault
          const mockOrgA = { id: 'orgA', admin_address: '0xadminA' };
          const mockOrgB = { id: 'orgB', admin_address: '0xadminB' };
          // Mock isAdminOfOrg to return false
          jest.mock('../middleware/auth', () => ({
            isAdminOfOrg: jest.fn().mockResolvedValue(false)
          }));
          await expect(vaultResolver.Query.vault(null, { address: '0xvaultB', orgId: mockOrgB.id, adminAddress: mockOrgA.admin_address }))
            .rejects.toThrow('Access denied: admin does not belong to organization.');
        });

        it('should allow access when admin belongs to org', async () => {
          const mockOrgA = { id: 'orgA', admin_address: '0xadminA' };
          const mockVault = { id: '1', address: '0xvaultA', org_id: 'orgA', beneficiaries: [], subSchedules: [] };
          // Mock isAdminOfOrg to return true
          jest.mock('../middleware/auth', () => ({
            isAdminOfOrg: jest.fn().mockResolvedValue(true)
          }));
          (models.Vault.findOne as jest.Mock).mockResolvedValue(mockVault);
          const result = await vaultResolver.Query.vault(null, { address: '0xvaultA', orgId: mockOrgA.id, adminAddress: mockOrgA.admin_address });
          expect(result).toEqual(mockVault);
        });
    describe('Query.vault', () => {
      it('should fetch a vault by address', async () => {
        const mockVault = {
          id: '1',
          address: '0x123...',
          name: 'Test Vault',
          token_address: '0xabc...',
          owner_address: '0xowner...',
          total_amount: '1000',
          beneficiaries: [],
          subSchedules: []
        };

        (models.Vault.findOne as jest.Mock).mockResolvedValue(mockVault);

        const result = await vaultResolver.Query.vault(null, { address: '0x123...' });

        expect(models.Vault.findOne).toHaveBeenCalledWith({
          where: { address: '0x123...' },
          include: [
            { model: models.Beneficiary, as: 'beneficiaries' },
            { model: models.SubSchedule, as: 'subSchedules' }
          ]
        });
        expect(result).toEqual(mockVault);
      });

      it('should throw error when vault not found', async () => {
        (models.Vault.findOne as jest.Mock).mockResolvedValue(null);

        await expect(vaultResolver.Query.vault(null, { address: '0x123...' }))
          .rejects.toThrow('Failed to fetch vault');
      });
    });

    describe('Query.vaults', () => {
      it('should fetch vaults with pagination', async () => {
        const mockVaults = [
          { id: '1', address: '0x123...' },
          { id: '2', address: '0x456...' }
        ];

        (models.Vault.findAll as jest.Mock).mockResolvedValue(mockVaults);

        const result = await vaultResolver.Query.vaults(null, { 
          ownerAddress: '0xowner...', 
          first: 10, 
          after: '0' 
        });

        expect(models.Vault.findAll).toHaveBeenCalledWith({
          where: { owner_address: '0xowner...' },
          include: [
            { model: models.Beneficiary, as: 'beneficiaries' },
            { model: models.SubSchedule, as: 'subSchedules' }
          ],
          limit: 10,
          offset: 0,
          order: [['created_at', 'DESC']]
        });
        expect(result).toEqual(mockVaults);
      });
    });

    describe('Mutation.createVault', () => {
      it('should create a new vault', async () => {
        const mockVault = {
          id: '1',
          address: '0x123...',
          name: 'Test Vault',
          token_address: '0xabc...',
          owner_address: '0xowner...',
          total_amount: '1000'
        };

        (models.Vault.create as jest.Mock).mockResolvedValue(mockVault);

        const input = {
          address: '0x123...',
          name: 'Test Vault',
          tokenAddress: '0xabc...',
          ownerAddress: '0xowner...',
          totalAmount: '1000'
        };

        const result = await vaultResolver.Mutation.createVault(null, { input });

        expect(models.Vault.create).toHaveBeenCalledWith({
          address: '0x123...',
          name: 'Test Vault',
          token_address: '0xabc...',
          owner_address: '0xowner...',
          total_amount: '1000'
        });
        expect(result).toEqual(mockVault);
      });
    });
  });

  describe('User Resolver', () => {
    describe('Query.beneficiary', () => {
      it('should fetch a beneficiary', async () => {
        const mockVault = { id: '1', address: '0x123...' };
        const mockBeneficiary = {
          id: '1',
          vault_id: '1',
          address: '0xbeneficiary...',
          total_allocated: '500',
          total_withdrawn: '100'
        };

        (models.Vault.findOne as jest.Mock).mockResolvedValue(mockVault);
        (models.Beneficiary.findOne as jest.Mock).mockResolvedValue(mockBeneficiary);

        const result = await userResolver.Query.beneficiary(null, {
          vaultAddress: '0x123...',
          beneficiaryAddress: '0xbeneficiary...'
        });

        expect(models.Vault.findOne).toHaveBeenCalledWith({
          where: { address: '0x123...' }
        });
        expect(models.Beneficiary.findOne).toHaveBeenCalledWith({
          where: {
            vault_id: '1',
            address: '0xbeneficiary...'
          },
          include: [{ model: models.Vault, as: 'vault' }]
        });
        expect(result).toEqual(mockBeneficiary);
      });
    });

    describe('Query.claims', () => {
      it('should fetch claims with filters', async () => {
        const mockClaims = [
          {
            id: '1',
            user_address: '0xuser...',
            token_address: '0xtoken...',
            amount_claimed: '100'
          }
        ];

        (models.ClaimsHistory.findAll as jest.Mock).mockResolvedValue(mockClaims);

        const result = await userResolver.Query.claims(null, {
          userAddress: '0xuser...',
          tokenAddress: '0xtoken...',
          first: 10,
          after: '0'
        });

        expect(models.ClaimsHistory.findAll).toHaveBeenCalledWith({
          where: {
            user_address: '0xuser...',
            token_address: '0xtoken...'
          },
          limit: 10,
          offset: 0,
          order: [['claim_timestamp', 'DESC']]
        });
        expect(result).toEqual(mockClaims);
      });
    });

    describe('Mutation.withdraw', () => {
      it('should process withdrawal successfully', async () => {
        const mockVault = { id: '1', address: '0x123...' };
        const mockBeneficiary = {
          id: '1',
          vault_id: '1',
          address: '0xbeneficiary...',
          total_allocated: '500',
          total_withdrawn: '100',
          update: jest.fn().mockResolvedValue({})
        };

        (models.Vault.findOne as jest.Mock).mockResolvedValue(mockVault);
        (models.Beneficiary.findOne as jest.Mock).mockResolvedValue(mockBeneficiary);

        const input = {
          vaultAddress: '0x123...',
          beneficiaryAddress: '0xbeneficiary...',
          amount: '50',
          transactionHash: '0xtx...',
          blockNumber: '12345'
        };

        const result = await userResolver.Mutation.withdraw(null, { input });

        expect(mockBeneficiary.update).toHaveBeenCalledWith({
          total_withdrawn: '150'
        });
        expect(result).toBeDefined();
      });
    });
  });

  describe('Proof Resolver', () => {
    describe('Query.health', () => {
      it('should return health status', () => {
        const result = proofResolver.Query.health();
        expect(result).toBe('GraphQL API is healthy');
      });
    });

    describe('Mutation.revokeAccess', () => {
      it('should create audit log for access revocation', async () => {
        const input = {
          adminAddress: '0xadmin...',
          targetVault: '0x123...',
          reason: 'Security violation'
        };

        const result = await proofResolver.Mutation.revokeAccess(null, { input });

        expect(result).toEqual({
          id: expect.stringMatching(/^audit-\d+$/),
          adminAddress: '0xadmin...',
          action: 'REVOKE_ACCESS',
          targetVault: '0x123...',
          details: 'Security violation',
          timestamp: expect.any(Date),
          transactionHash: null
        });
      });
    });
  });
});

describe('Resolver Error Handling', () => {
  it('should handle database errors gracefully', async () => {
    (models.Vault.findOne as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

    await expect(vaultResolver.Query.vault(null, { address: '0x123...' }))
      .rejects.toThrow('Failed to fetch vault: Database connection failed');
  });

  it('should handle validation errors', async () => {
    const mockVault = { id: '1', address: '0x123...' };
    const mockBeneficiary = {
      id: '1',
      total_allocated: '500',
      total_withdrawn: '100'
    };

    (models.Vault.findOne as jest.Mock).mockResolvedValue(mockVault);
    (models.Beneficiary.findOne as jest.Mock).mockResolvedValue(mockBeneficiary);

    const input = {
      vaultAddress: '0x123...',
      beneficiaryAddress: '0xbeneficiary...',
      amount: '1000', // More than available
      transactionHash: '0xtx...',
      blockNumber: '12345'
    };

    await expect(userResolver.Mutation.withdraw(null, { input }))
      .rejects.toThrow('Insufficient withdrawable amount');
  });
});
