const auditLogger = require('./auditLogger');
const { Vault, SubSchedule } = require('../models');

class VestingService {
  async createVault(adminAddress, vaultAddress, ownerAddress, tokenAddress, totalAmount, startDate, endDate, cliffDate = null) {
    try {
      if (!this.isValidAddress(adminAddress)) {
        throw new Error('Invalid admin address');
      }
      if (!this.isValidAddress(vaultAddress)) {
        throw new Error('Invalid vault address');
      }
      if (!this.isValidAddress(ownerAddress)) {
        throw new Error('Invalid owner address');
      }
      if (!this.isValidAddress(tokenAddress)) {
        throw new Error('Invalid token address');
      }

      const vault = await Vault.create({
        vault_address: vaultAddress,
        owner_address: ownerAddress,
        token_address: tokenAddress,
        total_amount: totalAmount,
        start_date: startDate,
        end_date: endDate,
        cliff_date: cliffDate,
      });

      auditLogger.logAction(adminAddress, 'CREATE_VAULT', vaultAddress, {
        ownerAddress,
        tokenAddress,
        totalAmount,
        startDate,
        endDate,
        cliffDate,
      });

      return {
        success: true,
        message: 'Vault created successfully',
        vault,
      };
    } catch (error) {
      console.error('Error in createVault:', error);
      throw error;
    }
  }

  async topUpVault(adminAddress, vaultAddress, topUpAmount, transactionHash, cliffDuration = null, vestingDuration) {
    try {
      if (!this.isValidAddress(adminAddress)) {
        throw new Error('Invalid admin address');
      }
      if (!this.isValidAddress(vaultAddress)) {
        throw new Error('Invalid vault address');
      }
      if (!transactionHash || !transactionHash.startsWith('0x')) {
        throw new Error('Invalid transaction hash');
      }
      if (topUpAmount <= 0) {
        throw new Error('Top-up amount must be positive');
      }
      if (!vestingDuration || vestingDuration <= 0) {
        throw new Error('Vesting duration must be positive');
      }

      const vault = await Vault.findOne({
        where: { vault_address: vaultAddress, is_active: true },
      });

      if (!vault) {
        throw new Error('Vault not found or inactive');
      }

      const topUpTimestamp = new Date();
      let cliffDate = null;
      let vestingStartDate = topUpTimestamp;

      if (cliffDuration && cliffDuration > 0) {
        cliffDate = new Date(topUpTimestamp.getTime() + cliffDuration * 1000);
        vestingStartDate = cliffDate;
      }

      const subSchedule = await SubSchedule.create({
        vault_id: vault.id,
        top_up_amount: topUpAmount,
        top_up_transaction_hash: transactionHash,
        top_up_timestamp: topUpTimestamp,
        cliff_duration: cliffDuration,
        cliff_date: cliffDate,
        vesting_start_date: vestingStartDate,
        vesting_duration: vestingDuration,
      });

      await vault.update({
        total_amount: parseFloat(vault.total_amount) + parseFloat(topUpAmount),
      });

      auditLogger.logAction(adminAddress, 'TOP_UP', vaultAddress, {
        topUpAmount,
        transactionHash,
        cliffDuration,
        vestingDuration,
        cliffDate,
        subScheduleId: subSchedule.id,
      });

      return {
        success: true,
        message: 'Vault topped up successfully with cliff configuration',
        vault,
        subSchedule,
      };
    } catch (error) {
      console.error('Error in topUpVault:', error);
      throw error;
    }
  }

  async getVaultWithSubSchedules(vaultAddress) {
    try {
      const vault = await Vault.findOne({
        where: { vault_address: vaultAddress, is_active: true },
        include: [{
          model: SubSchedule,
          as: 'subSchedules',
          where: { is_active: true },
          required: false,
        }],
      });

      if (!vault) {
        throw new Error('Vault not found or inactive');
      }

      return {
        success: true,
        vault,
      };
    } catch (error) {
      console.error('Error in getVaultWithSubSchedules:', error);
      throw error;
    }
  }

  async calculateReleasableAmount(vaultAddress, asOfDate = new Date()) {
    try {
      const result = await this.getVaultWithSubSchedules(vaultAddress);
      const { vault, subSchedules } = result;

      let totalReleasable = 0;
      const scheduleDetails = [];

      for (const subSchedule of vault.subSchedules) {
        const releasable = this.calculateSubScheduleReleasable(subSchedule, asOfDate);
        totalReleasable += releasable;
        
        scheduleDetails.push({
          subScheduleId: subSchedule.id,
          topUpAmount: subSchedule.top_up_amount,
          topUpTimestamp: subSchedule.top_up_timestamp,
          cliffDate: subSchedule.cliff_date,
          vestingStartDate: subSchedule.vesting_start_date,
          vestingDuration: subSchedule.vesting_duration,
          amountReleased: subSchedule.amount_released,
          releasableAmount: releasable,
          isCliffActive: subSchedule.cliff_date && asOfDate < subSchedule.cliff_date,
        });
      }

      return {
        success: true,
        vaultAddress,
        totalReleasable,
        scheduleDetails,
        asOfDate,
      };
    } catch (error) {
      console.error('Error in calculateReleasableAmount:', error);
      throw error;
    }
  }

  calculateSubScheduleReleasable(subSchedule, asOfDate = new Date()) {
    if (subSchedule.cliff_date && asOfDate < subSchedule.cliff_date) {
      return 0;
    }

    if (asOfDate < subSchedule.vesting_start_date) {
      return 0;
    }

    const vestingEnd = new Date(subSchedule.vesting_start_date.getTime() + subSchedule.vesting_duration * 1000);
    if (asOfDate >= vestingEnd) {
      return parseFloat(subSchedule.top_up_amount) - parseFloat(subSchedule.amount_released);
    }

    const vestedTime = asOfDate - subSchedule.vesting_start_date;
    const vestedRatio = vestedTime / (subSchedule.vesting_duration * 1000);
    const totalVested = parseFloat(subSchedule.top_up_amount) * vestedRatio;
    const releasable = totalVested - parseFloat(subSchedule.amount_released);

    return Math.max(0, releasable);
  }

  async setDelegate(vaultId, ownerAddress, delegateAddress) {
    try {
      if (!this.isValidAddress(ownerAddress)) {
        throw new Error('Invalid owner address');
      }
      if (!this.isValidAddress(delegateAddress)) {
        throw new Error('Invalid delegate address');
      }

      const vault = await Vault.findOne({
        where: { id: vaultId, owner_address: ownerAddress, is_active: true },
      });

      if (!vault) {
        throw new Error('Vault not found or access denied');
      }

      await vault.update({
        delegate_address: delegateAddress,
      });

      auditLogger.logAction(ownerAddress, 'SET_DELEGATE', vault.vault_address, {
        delegateAddress,
        vaultId,
      });

      return {
        success: true,
        message: 'Delegate set successfully',
        vault,
      };
    } catch (error) {
      console.error('Error in setDelegate:', error);
      throw error;
    }
  }

  async releaseTokens(adminAddress, vaultAddress, releaseAmount, userAddress) {
    try {
      if (!this.isValidAddress(adminAddress)) {
        throw new Error('Invalid admin address');
      }
      if (!this.isValidAddress(vaultAddress)) {
        throw new Error('Invalid vault address');
      }
      if (!this.isValidAddress(userAddress)) {
        throw new Error('Invalid user address');
      }
      if (releaseAmount <= 0) {
        throw new Error('Release amount must be positive');
      }

      const releasableResult = await this.calculateReleasableAmount(vaultAddress);
      if (releasableResult.totalReleasable < releaseAmount) {
        throw new Error(`Insufficient releasable amount. Available: ${releasableResult.totalReleasable}, Requested: ${releaseAmount}`);
      }

      const result = await this.getVaultWithSubSchedules(vaultAddress);
      const { vault } = result;
      let remainingToRelease = releaseAmount;

      for (const subSchedule of vault.subSchedules) {
        if (remainingToRelease <= 0) break;

        const releasable = this.calculateSubScheduleReleasable(subSchedule);
        if (releasable <= 0) continue;

        const releaseFromThis = Math.min(remainingToRelease, releasable);
        
        await subSchedule.update({
          amount_released: parseFloat(subSchedule.amount_released) + releaseFromThis,
        });

        remainingToRelease -= releaseFromThis;
      }

      auditLogger.logAction(adminAddress, 'RELEASE_TOKENS', vaultAddress, {
        releaseAmount,
        userAddress,
        remainingToRelease: 0,
      });

      return {
        success: true,
        message: 'Tokens released successfully',
        vaultAddress,
        releaseAmount,
        userAddress,
      };
    } catch (error) {
      console.error('Error in releaseTokens:', error);
      throw error;
    }
  }

  async claimAsDelegate(delegateAddress, vaultAddress, releaseAmount) {
    try {
      if (!this.isValidAddress(delegateAddress)) {
        throw new Error('Invalid delegate address');
      }
      if (!this.isValidAddress(vaultAddress)) {
        throw new Error('Invalid vault address');
      }
      if (releaseAmount <= 0) {
        throw new Error('Release amount must be positive');
      }

      const vault = await Vault.findOne({
        where: { vault_address: vaultAddress, delegate_address: delegateAddress, is_active: true },
      });

      if (!vault) {
        throw new Error('Vault not found or delegate not authorized');
      }

      const releasableResult = await this.calculateReleasableAmount(vaultAddress);
      if (releasableResult.totalReleasable < releaseAmount) {
        throw new Error(`Insufficient releasable amount. Available: ${releasableResult.totalReleasable}, Requested: ${releaseAmount}`);
      }

      const result = await this.getVaultWithSubSchedules(vaultAddress);
      let remainingToRelease = releaseAmount;

      for (const subSchedule of result.vault.subSchedules) {
        if (remainingToRelease <= 0) break;

        const releasable = this.calculateSubScheduleReleasable(subSchedule);
        if (releasable <= 0) continue;

        const releaseFromThis = Math.min(remainingToRelease, releasable);
        
        await subSchedule.update({
          amount_released: parseFloat(subSchedule.amount_released) + releaseFromThis,
        });

        remainingToRelease -= releaseFromThis;
      }

      auditLogger.logAction(delegateAddress, 'DELEGATE_CLAIM', vaultAddress, {
        releaseAmount,
        ownerAddress: vault.owner_address,
        remainingToRelease: 0,
      });

      return {
        success: true,
        message: 'Tokens claimed successfully by delegate',
        vaultAddress,
        releaseAmount,
        ownerAddress: vault.owner_address,
        delegateAddress,
      };
    } catch (error) {
      console.error('Error in claimAsDelegate:', error);
      throw error;
    }
  }

  isValidAddress(address) {
    return typeof address === 'string' && 
           address.startsWith('0x') && 
           address.length === 42 &&
           /^[0-9a-fA-F]+$/.test(address.slice(2));
  }
}

module.exports = new VestingService();
