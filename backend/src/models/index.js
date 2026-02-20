const { sequelize } = require('../database/connection');
const ClaimsHistory = require('./claimsHistory');

const models = {
  ClaimsHistory,
  sequelize,
};

// Setup associations if needed in the future
Object.keys(models).forEach((modelName) => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

module.exports = models;
