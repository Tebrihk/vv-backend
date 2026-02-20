import { PubSub } from 'graphql-subscriptions';
import { models } from '../../models';

const pubsub = new PubSub();

// Subscription event constants
export const SUBSCRIPTION_EVENTS = {
  VAULT_UPDATED: 'VAULT_UPDATED',
  BENEFICIARY_UPDATED: 'BENEFICIARY_UPDATED',
  NEW_CLAIM: 'NEW_CLAIM',
  WITHDRAWAL_PROCESSED: 'WITHDRAWAL_PROCESSED',
  AUDIT_LOG_CREATED: 'AUDIT_LOG_CREATED',
  ADMIN_TRANSFER_UPDATED: 'ADMIN_TRANSFER_UPDATED'
};

export const subscriptionResolver = {
  Subscription: {
    vaultUpdated: {
      subscribe: (_: any, { vaultAddress }: { vaultAddress?: string }) => {
        const subscription = vaultAddress 
          ? pubsub.asyncIterator([`${SUBSCRIPTION_EVENTS.VAULT_UPDATED}_${vaultAddress}`])
          : pubsub.asyncIterator([SUBSCRIPTION_EVENTS.VAULT_UPDATED]);
        
        return subscription;
      },
      resolve: (payload: any) => payload
    },

    beneficiaryUpdated: {
      subscribe: (_: any, { vaultAddress, beneficiaryAddress }: { 
        vaultAddress?: string, 
        beneficiaryAddress?: string 
      }) => {
        let eventName = SUBSCRIPTION_EVENTS.BENEFICIARY_UPDATED;
        
        if (vaultAddress && beneficiaryAddress) {
          eventName = `${SUBSCRIPTION_EVENTS.BENEFICIARY_UPDATED}_${vaultAddress}_${beneficiaryAddress}`;
        } else if (vaultAddress) {
          eventName = `${SUBSCRIPTION_EVENTS.BENEFICIARY_UPDATED}_${vaultAddress}`;
        }
        
        return pubsub.asyncIterator([eventName]);
      },
      resolve: (payload: any) => payload
    },

    newClaim: {
      subscribe: (_: any, { userAddress }: { userAddress?: string }) => {
        const subscription = userAddress 
          ? pubsub.asyncIterator([`${SUBSCRIPTION_EVENTS.NEW_CLAIM}_${userAddress}`])
          : pubsub.asyncIterator([SUBSCRIPTION_EVENTS.NEW_CLAIM]);
        
        return subscription;
      },
      resolve: (payload: any) => payload
    },

    withdrawalProcessed: {
      subscribe: (_: any, { vaultAddress, beneficiaryAddress }: { 
        vaultAddress?: string, 
        beneficiaryAddress?: string 
      }) => {
        let eventName = SUBSCRIPTION_EVENTS.WITHDRAWAL_PROCESSED;
        
        if (vaultAddress && beneficiaryAddress) {
          eventName = `${SUBSCRIPTION_EVENTS.WITHDRAWAL_PROCESSED}_${vaultAddress}_${beneficiaryAddress}`;
        } else if (vaultAddress) {
          eventName = `${SUBSCRIPTION_EVENTS.WITHDRAWAL_PROCESSED}_${vaultAddress}`;
        }
        
        return pubsub.asyncIterator([eventName]);
      },
      resolve: (payload: any) => payload
    },

    auditLogCreated: {
      subscribe: () => {
        return pubsub.asyncIterator([SUBSCRIPTION_EVENTS.AUDIT_LOG_CREATED]);
      },
      resolve: (payload: any) => payload
    },

    adminTransferUpdated: {
      subscribe: (_: any, { contractAddress }: { contractAddress?: string }) => {
        const subscription = contractAddress 
          ? pubsub.asyncIterator([`${SUBSCRIPTION_EVENTS.ADMIN_TRANSFER_UPDATED}_${contractAddress}`])
          : pubsub.asyncIterator([SUBSCRIPTION_EVENTS.ADMIN_TRANSFER_UPDATED]);
        
        return subscription;
      },
      resolve: (payload: any) => payload
    }
  }
};

// Helper functions to publish events
export const publishVaultUpdate = async (vaultAddress: string, vaultData: any) => {
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

    if (vault) {
      // Publish to general vault updates
      pubsub.publish(SUBSCRIPTION_EVENTS.VAULT_UPDATED, { vaultUpdated: vault });
      
      // Publish to specific vault updates
      pubsub.publish(`${SUBSCRIPTION_EVENTS.VAULT_UPDATED}_${vaultAddress}`, { vaultUpdated: vault });
    }
  } catch (error) {
    console.error('Error publishing vault update:', error);
  }
};

export const publishBeneficiaryUpdate = async (
  vaultAddress: string, 
  beneficiaryAddress: string, 
  beneficiaryData: any
) => {
  try {
    const vault = await models.Vault.findOne({
      where: { address: vaultAddress }
    });

    if (vault) {
      const beneficiary = await models.Beneficiary.findOne({
        where: { 
          vault_id: vault.id,
          address: beneficiaryAddress
        },
        include: [
          {
            model: models.Vault,
            as: 'vault'
          }
        ]
      });

      if (beneficiary) {
        // Publish to general beneficiary updates
        pubsub.publish(SUBSCRIPTION_EVENTS.BENEFICIARY_UPDATED, { beneficiaryUpdated: beneficiary });
        
        // Publish to vault-specific beneficiary updates
        pubsub.publish(`${SUBSCRIPTION_EVENTS.BENEFICIARY_UPDATED}_${vaultAddress}`, { 
          beneficiaryUpdated: beneficiary 
        });
        
        // Publish to specific beneficiary updates
        pubsub.publish(`${SUBSCRIPTION_EVENTS.BENEFICIARY_UPDATED}_${vaultAddress}_${beneficiaryAddress}`, { 
          beneficiaryUpdated: beneficiary 
        });
      }
    }
  } catch (error) {
    console.error('Error publishing beneficiary update:', error);
  }
};

export const publishNewClaim = async (userAddress: string, claimData: any) => {
  try {
    const claim = await models.ClaimsHistory.findOne({
      where: { transaction_hash: claimData.transactionHash }
    });

    if (claim) {
      // Publish to general claim updates
      pubsub.publish(SUBSCRIPTION_EVENTS.NEW_CLAIM, { newClaim: claim });
      
      // Publish to user-specific claim updates
      pubsub.publish(`${SUBSCRIPTION_EVENTS.NEW_CLAIM}_${userAddress}`, { newClaim: claim });
    }
  } catch (error) {
    console.error('Error publishing new claim:', error);
  }
};

export const publishWithdrawalProcessed = async (
  vaultAddress: string, 
  beneficiaryAddress: string, 
  withdrawableInfo: any
) => {
  try {
    // Publish to general withdrawal updates
    pubsub.publish(SUBSCRIPTION_EVENTS.WITHDRAWAL_PROCESSED, { withdrawalProcessed: withdrawableInfo });
    
    // Publish to vault-specific withdrawal updates
    pubsub.publish(`${SUBSCRIPTION_EVENTS.WITHDRAWAL_PROCESSED}_${vaultAddress}`, { 
      withdrawalProcessed: withdrawableInfo 
    });
    
    // Publish to specific beneficiary withdrawal updates
    pubsub.publish(`${SUBSCRIPTION_EVENTS.WITHDRAWAL_PROCESSED}_${vaultAddress}_${beneficiaryAddress}`, { 
      withdrawalProcessed: withdrawableInfo 
    });
  } catch (error) {
    console.error('Error publishing withdrawal processed:', error);
  }
};

export const publishAuditLogCreated = async (auditLog: any) => {
  try {
    pubsub.publish(SUBSCRIPTION_EVENTS.AUDIT_LOG_CREATED, { auditLogCreated: auditLog });
  } catch (error) {
    console.error('Error publishing audit log created:', error);
  }
};

export const publishAdminTransferUpdated = async (contractAddress: string, transferData: any) => {
  try {
    // Publish to general admin transfer updates
    pubsub.publish(SUBSCRIPTION_EVENTS.ADMIN_TRANSFER_UPDATED, { adminTransferUpdated: transferData });
    
    // Publish to contract-specific admin transfer updates
    pubsub.publish(`${SUBSCRIPTION_EVENTS.ADMIN_TRANSFER_UPDATED}_${contractAddress}`, { 
      adminTransferUpdated: transferData 
    });
  } catch (error) {
    console.error('Error publishing admin transfer updated:', error);
  }
};

// Export pubsub instance for use in other resolvers
export { pubsub };
