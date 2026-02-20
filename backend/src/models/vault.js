const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Vault = sequelize.define('Vault', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  vault_address: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'The blockchain address of the vault',
  },
  owner_address: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'The owner of the vault',
  },
  delegate_address: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'The delegate address that can claim on behalf of the owner',
  },
  token_address: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'The token address held in the vault',
  },
  total_amount: {
    type: DataTypes.DECIMAL(36, 18),
    allowNull: false,
    defaultValue: 0,
    comment: 'Total tokens held in the vault',
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'When vesting starts',
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'When vesting ends',
  },
  cliff_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When cliff period ends (null = no cliff)',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether the vault is active',
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
      fields: ['vault_address'],
      unique: true,
    },
    {
      fields: ['owner_address'],
    },
    {
      fields: ['delegate_address'],
    },
    {
      fields: ['token_address'],
    },
    {
      fields: ['is_active'],
    },
  ],
});

module.exports = Vault;
