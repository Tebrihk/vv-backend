const { Vault, SubSchedule, Beneficiary, Notification, sequelize } = require('../models');
const { Op } = require('sequelize');
const emailService = require('./emailService');
const cron = require('node-cron');

class NotificationService {
  constructor() {
    this.cronJob = null;
  }

  /**
   * Start the notification cron job
   */
  start() {
    // Run every hour
    this.cronJob = cron.schedule('0 * * * *', async () => {
      console.log('Running cliff notification cron job...');
      await this.checkAndNotifyCliffs();
    });
    console.log('Cliff notification cron job started.');
  }

  /**
   * Check all vaults and sub-schedules for passed cliffs and notify beneficiaries
   */
  async checkAndNotifyCliffs() {
    try {
      const now = new Date();

      // 1. Check Vault cliffs
      const vaultsWithCliffPassed = await Vault.findAll({
        where: {
          cliff_date: {
            [Op.lte]: now,
            [Op.ne]: null
          },
          is_active: true
        },
        include: [{
          model: Beneficiary,
          as: 'beneficiaries',
          where: {
            email: { [Op.ne]: null }
          }
        }]
      });

      for (const vault of vaultsWithCliffPassed) {
        for (const beneficiary of vault.beneficiaries) {
          await this.notifyIfRequired(beneficiary, vault, null, 'CLIFF_PASSED', vault.total_amount);
        }
      }

      // 2. Check SubSchedule cliffs
      const subSchedulesWithCliffPassed = await SubSchedule.findAll({
        where: {
          cliff_date: {
            [Op.lte]: now,
            [Op.ne]: null
          },
          is_active: true
        },
        include: [{
          model: Vault,
          as: 'vault',
          include: [{
            model: Beneficiary,
            as: 'beneficiaries',
            where: {
              email: { [Op.ne]: null }
            }
          }]
        }]
      });

      for (const subSchedule of subSchedulesWithCliffPassed) {
        for (const beneficiary of subSchedule.vault.beneficiaries) {
          await this.notifyIfRequired(beneficiary, subSchedule.vault, subSchedule, 'CLIFF_PASSED', subSchedule.top_up_amount);
        }
      }

    } catch (error) {
      console.error('Error in checkAndNotifyCliffs:', error);
    }
  }

  /**
   * Notify if not already notified
   * @param {Object} beneficiary - Beneficiary model instance
   * @param {Object} vault - Vault model instance
   * @param {Object|null} subSchedule - SubSchedule model instance or null
   * @param {string} type - Notification type
   * @param {string} amount - Claimable amount
   */
  async notifyIfRequired(beneficiary, vault, subSchedule, type, amount) {
    const transaction = await sequelize.transaction();
    try {
      // Check if notification already sent
      const existingNotification = await Notification.findOne({
        where: {
          beneficiary_id: beneficiary.id,
          vault_id: vault.id,
          sub_schedule_id: subSchedule ? subSchedule.id : null,
          type
        },
        transaction
      });

      if (!existingNotification) {
        console.log(`Sending ${type} email to ${beneficiary.email} for vault ${vault.vault_address}`);
        
        const emailSent = await emailService.sendCliffPassedEmail(beneficiary.email, amount);
        
        if (emailSent) {
          await Notification.create({
            beneficiary_id: beneficiary.id,
            vault_id: vault.id,
            sub_schedule_id: subSchedule ? subSchedule.id : null,
            type,
            sent_at: new Date()
          }, { transaction });
          
          console.log(`Notification recorded in DB for ${beneficiary.email}`);
        }
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error(`Failed to process notification for beneficiary ${beneficiary.id}:`, error);
    }
  }
}

module.exports = new NotificationService();
