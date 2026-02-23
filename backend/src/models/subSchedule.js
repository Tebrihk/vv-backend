const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const SubSchedule = sequelize.define('SubSchedule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  vault_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'vaults',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  },
  top_up_amount: {
    type: DataTypes.DECIMAL(36, 18),
    allowNull: false,
    comment: 'Amount of tokens added in this top-up',
  },
  top_up_transaction_hash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  top_up_timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  cliff_duration: {
    type: DataTypes.INTEGER, // in seconds
    allowNull: true,
    defaultValue: 0,
  },
  cliff_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  vesting_start_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  vesting_duration: {
    type: DataTypes.INTEGER, // in seconds
    allowNull: false,
  },
  amount_released: {
    type: DataTypes.DECIMAL(36, 18),
    defaultValue: 0,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'sub_schedules',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['vault_id'],
    },
    {
      fields: ['is_active'],
    },
  ],
});

module.exports = SubSchedule;
