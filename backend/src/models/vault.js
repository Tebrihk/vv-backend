const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Vault = sequelize.define('Vault', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  token_address: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  owner_address: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  total_amount: {
    type: DataTypes.DECIMAL(36, 18),
    allowNull: false,
    defaultValue: 0,
  },
  tag: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Vault category tag (e.g., Seed, Private, Advisors, Team)',
  },
  org_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'organizations',
      key: 'id'
    }
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
      fields: ['address'],
      unique: true,
    },
    {
      fields: ['owner_address'],
    },
    {
      fields: ['org_id'],
    }
  ],
});

// Add association method
Vault.associate = function (models) {
  Vault.belongsTo(models.Organization, {
    foreignKey: 'org_id',
    as: 'organization'
  });
};

module.exports = Vault;
