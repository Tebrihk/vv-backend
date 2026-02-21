const { Vault, SubSchedule, Beneficiary } = require('../models');

// Setup model associations
Vault.hasMany(SubSchedule, {
  foreignKey: 'vault_id',
  as: 'subSchedules',
  onDelete: 'CASCADE',
});

SubSchedule.belongsTo(Vault, {
  foreignKey: 'vault_id',
  as: 'vault',
});

Vault.hasMany(Beneficiary, {
  foreignKey: 'vault_id',
  as: 'beneficiaries',
  onDelete: 'CASCADE',
});

Beneficiary.belongsTo(Vault, {
  foreignKey: 'vault_id',
  as: 'vault',
});

// Add associate methods to models
Vault.associate = function(models) {
  Vault.hasMany(models.SubSchedule, {
    foreignKey: 'vault_id',
    as: 'subSchedules',
  });
  
  Vault.hasMany(models.Beneficiary, {
    foreignKey: 'vault_id',
    as: 'beneficiaries',
  });
};

SubSchedule.associate = function(models) {
  SubSchedule.belongsTo(models.Vault, {
    foreignKey: 'vault_id',
    as: 'vault',
  });
};

Beneficiary.associate = function(models) {
  Beneficiary.belongsTo(models.Vault, {
    foreignKey: 'vault_id',
    as: 'vault',
  });
};

module.exports = {
  Vault,
  SubSchedule,
  Beneficiary,
};
