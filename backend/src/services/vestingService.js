const { Vault, SubSchedule } = require('../models');
const { Op } = require('sequelize');

class VestingService {
  /**
   * Calculate the vesting projection for a vault
   * @param {string} vaultId - The UUID or Address of the vault
   * @returns {Promise<Array<{date: string, amount: number}>>}
   */
  async getVaultProjection(vaultId) {
    // Try to find by UUID first, then address
    let whereClause = {};
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vaultId);
    
    if (isUUID) {
      whereClause.id = vaultId;
    } else {
      whereClause.vault_address = vaultId;
    }

    const vault = await Vault.findOne({
      where: whereClause,
      include: [{
        model: SubSchedule,
        as: 'subSchedules',
        // Assuming is_active is used as per IndexingService
        required: false
      }]
    });

    if (!vault) {
      throw new Error('Vault not found');
    }

    const schedules = vault.subSchedules || [];
    if (schedules.length === 0) {
      return [];
    }

    // Collect critical dates
    const criticalDates = new Set();
    const scheduleData = schedules.map(schedule => {
      const topUpDate = new Date(schedule.top_up_timestamp || schedule.created_at);
      const cliffDate = schedule.cliff_date ? new Date(schedule.cliff_date) : null;
      const vestingStartDate = new Date(schedule.vesting_start_date);
      const vestingDuration = schedule.vesting_duration; // in seconds
      const vestingEndDate = new Date(vestingStartDate.getTime() + vestingDuration * 1000);
      
      const amount = parseFloat(schedule.top_up_amount);

      // Add critical dates
      criticalDates.add(topUpDate.toISOString().split('T')[0]);
      if (cliffDate) {
        criticalDates.add(cliffDate.toISOString().split('T')[0]);
      }
      criticalDates.add(vestingStartDate.toISOString().split('T')[0]);
      criticalDates.add(vestingEndDate.toISOString().split('T')[0]);

      return {
        topUpDate,
        cliffDate,
        vestingStartDate,
        vestingEndDate,
        vestingDuration,
        amount
      };
    });

    // Sort unique dates
    const sortedDates = Array.from(criticalDates).sort();

    // Calculate total vested at each date
    const projection = sortedDates.map(dateStr => {
      const date = new Date(dateStr);
      // Set to end of day to ensure we capture the state at that date? 
      // Or beginning? Usually for charts, exact timestamps matter, but user asked for '2024-01-01'.
      // Let's use the date object as parsed (UTC 00:00).
      
      let totalVested = 0;

      for (const schedule of scheduleData) {
        totalVested += this.calculateVestedAmountForSchedule(schedule, date);
      }

      return {
        date: dateStr,
        amount: totalVested
      };
    });

    return projection;
  }

  calculateVestedAmountForSchedule(schedule, date) {
    // Logic matches IndexingService.calculateSubScheduleReleasable but for total vested (ignoring released)
    
    // 1. Before cliff (if exists) -> 0
    if (schedule.cliffDate && date < schedule.cliffDate) {
      return 0;
    }

    // 2. Before vesting start -> 0
    if (date < schedule.vestingStartDate) {
      return 0;
    }

    // 3. After vesting end -> Full amount
    if (date >= schedule.vestingEndDate) {
      return schedule.amount;
    }

    // 4. During vesting -> Linear
    const vestedTime = date.getTime() - schedule.vestingStartDate.getTime();
    const totalDuration = schedule.vestingDuration * 1000;
    
    if (totalDuration === 0) return schedule.amount; // Instant vesting

    const ratio = vestedTime / totalDuration;
    return schedule.amount * ratio;
  }
}

module.exports = new VestingService();
