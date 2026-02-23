const express = require('express');
const { ClaimGateway } = require('./websocket/claim.gateway');
const { RedisIoAdapter } = require('./websocket/redis.adapter');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { rateLimit } = require('express-rate-limit');

const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger/options');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const httpServer = http.createServer(app);

app.use(cors());
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

const claimRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 1,
  message: {
    success: false,
    error: 'Too many claim requests. Please wait 1 minute before trying again.'
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

const { sequelize } = require('./database/connection');
const models = require('./models');

const indexingService = require('./services/indexingService');
const adminService = require('./services/adminService');
const vestingService = require('./services/vestingService');
const discordBotService = require('./services/discordBotService');
const cacheService = require('./services/cacheService');
const tvlService = require('./services/tvlService');
const vaultExportService = require('./services/vaultExportService');
const calendarService = require('./services/calendarService');

app.get('/', (req, res) => {
  res.json({ message: 'Vesting Vault API is running!' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post('/api/claims', claimRateLimiter, async (req, res) => {
  try {
    const claim = await indexingService.processClaim(req.body);
    res.status(201).json({ success: true, data: claim });
  } catch (error) {
    console.error('Error processing claim:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/claims/batch', claimRateLimiter, async (req, res) => {
  try {
    const result = await indexingService.processBatchClaims(req.body.claims);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error processing batch claims:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/claims/backfill-prices', claimRateLimiter, async (req, res) => {
  try {
    const processedCount = await indexingService.backfillMissingPrices();
    res.json({ success: true, message: `Backfilled prices for ${processedCount} claims` });
  } catch (error) {
    console.error('Error backfilling prices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/claims/:userAddress/realized-gains', async (req, res) => {
  try {
    const { userAddress } = req.params;
    const { startDate, endDate } = req.query;
    const gains = await indexingService.getRealizedGains(
      userAddress,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );
    res.json({ success: true, data: gains });
  } catch (error) {
    console.error('Error calculating realized gains:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/revoke', async (req, res) => {
  try {
    const { adminAddress, targetVault, reason } = req.body;
    const result = await adminService.revokeAccess(adminAddress, targetVault, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error revoking access:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/create', async (req, res) => {
  try {
    const { adminAddress, targetVault, vaultConfig } = req.body;
    const result = await adminService.createVault(adminAddress, targetVault, vaultConfig);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error creating vault:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/transfer', async (req, res) => {
  try {
    const { adminAddress, targetVault, newOwner } = req.body;
    const result = await adminService.transferVault(adminAddress, targetVault, newOwner);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error transferring vault:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/audit-logs', async (req, res) => {
  try {
    const { limit } = req.query;
    const result = await adminService.getAuditLogs(limit ? parseInt(limit) : 100);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/propose-new-admin', async (req, res) => {
  try {
    const { currentAdminAddress, newAdminAddress, contractAddress } = req.body;
    const result = await adminService.proposeNewAdmin(currentAdminAddress, newAdminAddress, contractAddress);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error proposing new admin:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/accept-ownership', async (req, res) => {
  try {
    const { newAdminAddress, transferId } = req.body;
    const result = await adminService.acceptOwnership(newAdminAddress, transferId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error accepting ownership:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/transfer-ownership', async (req, res) => {
  try {
    const { currentAdminAddress, newAdminAddress, contractAddress } = req.body;
    const result = await adminService.transferOwnership(currentAdminAddress, newAdminAddress, contractAddress);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error transferring ownership:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/pending-transfers', async (req, res) => {
  try {
    const { contractAddress } = req.query;
    const result = await adminService.getPendingTransfers(contractAddress);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching pending transfers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stats/tvl', async (req, res) => {
  try {
    const tvlStats = await tvlService.getTVLStats();
    res.json({
      success: true,
      data: {
        total_value_locked: tvlStats.total_value_locked,
        active_vaults_count: tvlStats.active_vaults_count,
        formatted_tvl: tvlService.formatTVL(tvlStats.total_value_locked),
        last_updated_at: tvlStats.last_updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching TVL stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Calendar Route
app.get('/api/user/:address/calendar', async (req, res) => {
  try {
    const { address } = req.params;
    const unlocks = await calendarService.getUpcomingUnlocks(address);
    res.json({ success: true, data: unlocks });
  } catch (error) {
    console.error('Error fetching calendar:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/vault/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="vault-${id}-export-${new Date().toISOString().split('T')[0]}.csv"`);
    await vaultExportService.streamVaultAsCSV(id, res);
  } catch (error) {
    console.error('Error exporting vault:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      res.destroy(error);
    }
  }
});

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    await sequelize.sync();
    console.log('Database synchronized successfully.');

    try {
      await cacheService.connect();
      if (cacheService.isReady()) {
        console.log('Redis cache connected successfully.');
      } else {
        console.log('Redis cache not available, continuing without caching...');
      }
    } catch (cacheError) {
      console.error('Failed to connect to Redis:', cacheError);
      console.log('Continuing without Redis cache...');
    }

    let graphQLServer = null;
    try {
      const { createGraphQLServer } = require('./graphql/server');
      graphQLServer = await createGraphQLServer(app);
      console.log('GraphQL Server initialized successfully.');
      const serverInfo = graphQLServer.getServerInfo();
      console.log(`GraphQL Playground available at: ${serverInfo.playgroundUrl}`);
      console.log(`GraphQL Subscriptions available at: ${serverInfo.subscriptionEndpoint}`);
    } catch (graphqlError) {
      console.error('Failed to initialize GraphQL Server:', graphqlError);
      console.log('Continuing with REST API only...');
    }

    try {
      await discordBotService.start();
    } catch (discordError) {
      console.error('Failed to initialize Discord Bot:', discordError);
      console.log('Continuing without Discord bot...');
    }

    httpServer.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`REST API available at: http://localhost:${PORT}`);
      if (graphQLServer) {
        console.log(`GraphQL API available at: http://localhost:${PORT}/graphql`);
      }
      const redisIoAdapter = new RedisIoAdapter(httpServer);
      const claimGateway = new ClaimGateway();
      claimGateway.server = redisIoAdapter.createIOServer(PORT, { transports: ['websocket'] });
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

startServer();
