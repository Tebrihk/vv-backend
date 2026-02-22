const { sequelize } = require('../database/connection');
const ClaimsHistory = require('./claimsHistory');
const Vault = require('./vault');
const SubSchedule = require('./subSchedule');
const Organization = require('./organization');


const models = {
  ClaimsHistory,
  Vault,
  SubSchedule,
  Organization,

  sequelize,
};

// Setup associations
Object.keys(models).forEach((modelName) => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

module.exports = models;
