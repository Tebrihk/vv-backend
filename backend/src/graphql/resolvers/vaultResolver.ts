const models = require('../../models');
const cacheService = require('../../services/cacheService');
const tvlService = require('../../services/tvlService');

export const vaultResolver = {
  Query: {
    vault: async (_: any, { address, orgId, adminAddress }: { address: string, orgId: string, adminAddress: string }) => {
      try {
        // Enforce org/admin check
        const { isAdminOfOrg } = require('../middleware/auth');
        const isAdmin = await isAdminOfOrg(adminAddress, orgId);
        if (!isAdmin) {
          throw new Error('Access denied: admin does not belong to organization.');
        }
        const vault = await models.Vault.findOne({
          where: { address, org_id: orgId },
          include: [
            {
              model: models.Beneficiary,
              as: 'beneficiaries'
            },
            {
              model: models.SubSchedule,
              as: 'subSchedules'
            }
          ]
        });
        return vault;
      } catch (error) {
        console.error('Error fetching vault:', error);
        throw new Error(`Failed to fetch vault: ${error.message}`);
      }
    },

    vaults: async (_: any, { orgId, adminAddress, first = 50, after }: { orgId: string, adminAddress: string, first?: number, after?: string }) => {
      try {
        // Enforce org/admin check
        const { isAdminOfOrg } = require('../middleware/auth');
        const isAdmin = await isAdminOfOrg(adminAddress, orgId);
        if (!isAdmin) {
          throw new Error('Access denied: admin does not belong to organization.');
        }
        const offset = after ? parseInt(after) : 0;
        const vaults = await models.Vault.findAll({
          where: { org_id: orgId },
          include: [
            {
              model: models.Beneficiary,
              as: 'beneficiaries'
            },
            {
              model: models.SubSchedule,
              as: 'subSchedules'
            }
          ],
          limit: first,
          offset,
          order: [['created_at', 'DESC']]
        });
        return vaults;
      } catch (error) {
        console.error('Error fetching vaults:', error);
        throw new Error(`Failed to fetch vaults: ${error.message}`);
      }
    },

    vaultSummary: async (_: any, { vaultAddress }: { vaultAddress: string }) => {
      try {
        const vault = await models.Vault.findOne({
          where: { address: vaultAddress },
          include: [
            {
              model: models.Beneficiary,
              as: 'beneficiaries'
            },
            {
              model: models.SubSchedule,
              as: 'subSchedules'
            }
          ]
        });

        if (!vault) {
          throw new Error('Vault not found');
        }

        const totalAllocated = vault.beneficiaries.reduce((sum: any, beneficiary: any) => 
          sum + parseFloat(beneficiary.total_allocated), 0);
        const totalWithdrawn = vault.beneficiaries.reduce((sum: any, beneficiary: any) => 
          sum + parseFloat(beneficiary.total_withdrawn), 0);
        const remainingAmount = totalAllocated - totalWithdrawn;
        const activeBeneficiaries = vault.beneficiaries.filter((beneficiary: any) => 
          parseFloat(beneficiary.total_allocated) > parseFloat(beneficiary.total_withdrawn)).length;

        return {
          totalAllocated: totalAllocated.toString(),
          totalWithdrawn: totalWithdrawn.toString(),
          remainingAmount: remainingAmount.toString(),
          activeBeneficiaries,
          totalBeneficiaries: vault.beneficiaries.length
        };
      } catch (error) {
        console.error('Error fetching vault summary:', error);
        throw new Error(`Failed to fetch vault summary: ${error.message}`);
      }
    }
  },

  Mutation: {
    createVault: async (_: any, { input }: { input: any }) => {
      try {
        const vault = await models.Vault.create({
          address: input.address,
          name: input.name,
          token_address: input.tokenAddress,
          owner_address: input.ownerAddress,
          total_amount: input.totalAmount
        });

        // Invalidate cache for the owner
        if (input.ownerAddress) {
          await cacheService.invalidateUserVaults(input.ownerAddress);
          console.log(`Invalidated cache for user vaults: ${input.ownerAddress}`);
        }

        // Update TVL for new vault
        try {
          await tvlService.handleVaultCreated(vault.toJSON());
        } catch (tvlError) {
          console.error('Error updating TVL for new vault:', tvlError);
          // Don't throw - TVL update failure shouldn't fail vault creation
        }

        return vault;
      } catch (error) {
        console.error('Error creating vault:', error);
        throw new Error(`Failed to create vault: ${error.message}`);
      }
    },

    topUpVault: async (_: any, { input }: { input: any }) => {
      try {
        const vault = await models.Vault.findOne({
          where: { address: input.vaultAddress }
        });

        if (!vault) {
          throw new Error('Vault not found');
        }

        const startTimestamp = new Date();
        const endTimestamp = new Date(startTimestamp.getTime() + (input.vestingDuration * 1000));

        const subSchedule = await models.SubSchedule.create({
          vault_id: vault.id,
          top_up_amount: input.amount,
          cliff_duration: input.cliffDuration,
          vesting_duration: input.vestingDuration,
          start_timestamp: startTimestamp,
          end_timestamp: endTimestamp,
          transaction_hash: input.transactionHash,
          block_number: input.blockNumber
        });

        // Update vault total amount
        await vault.update({
          total_amount: (parseFloat(vault.total_amount) + parseFloat(input.amount)).toString()
        });

        // Update TVL for vault top-up
        try {
          await tvlService.handleVaultCreated(vault.toJSON());
        } catch (tvlError) {
          console.error('Error updating TVL for vault top-up:', tvlError);
          // Don't throw - TVL update failure shouldn't fail top-up
        }

        return subSchedule;
      } catch (error) {
        console.error('Error processing top-up:', error);
        throw new Error(`Failed to process top-up: ${error.message}`);
      }
    }
  },

  Vault: {
    beneficiaries: async (vault: any) => {
      try {
        return await models.Beneficiary.findAll({
          where: { vault_id: vault.id }
        });
      } catch (error) {
        console.error('Error fetching beneficiaries:', error);
        return [];
      }
    },

    subSchedules: async (vault: any) => {
      try {
        return await models.SubSchedule.findAll({
          where: { vault_id: vault.id },
          order: [['created_at', 'DESC']]
        });
      } catch (error) {
        console.error('Error fetching sub-schedules:', error);
        return [];
      }
    },

    summary: async (vault: any) => {
      try {
        const beneficiaries = await models.Beneficiary.findAll({
          where: { vault_id: vault.id }
        });

        const totalAllocated = beneficiaries.reduce((sum: number, beneficiary: any) => 
          sum + parseFloat(beneficiary.total_allocated), 0);
        const totalWithdrawn = beneficiaries.reduce((sum: number, beneficiary: any) => 
          sum + parseFloat(beneficiary.total_withdrawn), 0);
        const remainingAmount = totalAllocated - totalWithdrawn;
        const activeBeneficiaries = beneficiaries.filter((beneficiary: any) => 
          parseFloat(beneficiary.total_allocated) > parseFloat(beneficiary.total_withdrawn)).length;

        return {
          totalAllocated: totalAllocated.toString(),
          totalWithdrawn: totalWithdrawn.toString(),
          remainingAmount: remainingAmount.toString(),
          activeBeneficiaries,
          totalBeneficiaries: beneficiaries.length
        };
      } catch (error) {
        console.error('Error calculating vault summary:', error);
        return null;
      }
    }
  }
};
