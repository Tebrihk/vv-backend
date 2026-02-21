const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Vault = sequelize.define('Vault', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  },
  total_amount: {
    type: DataTypes.DECIMAL(36, 18),
    allowNull: false,
    defaultValue: 0,

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
  tableName: 'vaults',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
n
      unique: true,
    },
    {
      fields: ['owner_address'],
    },
    {

  ],
});

module.exports = Vault;
