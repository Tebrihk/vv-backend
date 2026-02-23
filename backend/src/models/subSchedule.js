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

    type: DataTypes.DATE,
    allowNull: false,
  },
  cliff_duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
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
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  amount_released: {
    type: DataTypes.DECIMAL(36, 18),
    allowNull: false,
    defaultValue: 0,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
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

  ],
});

module.exports = SubSchedule;
