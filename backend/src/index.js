const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server for GraphQL subscriptions
const httpServer = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Database connection and models
const { sequelize } = require('./database/connection');
const models = require('./models');

// Services
const indexingService = require('./services/indexingService');
const adminService = require('./services/adminService');
const vestingService = require('./services/vestingService');

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Vesting Vault API is running!' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes for claims and indexing
app.post('/api/claims', async (req, res) => {
  try {
    const claim = await indexingService.processClaim(req.body);
    res.status(201).json({ success: true, data: claim });
  } catch (error) {
    console.error('Error processing claim:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/claims/batch', async (req, res) => {
  try {
    const result = await indexingService.processBatchClaims(req.body.claims);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error processing batch claims:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/claims/backfill-prices', async (req, res) => {
  try {
    const processedCount = await indexingService.backfillMissingPrices();
    res.json({ 
      success: true, 
      message: `Backfilled prices for ${processedCount} claims` 
    });
  } catch (error) {
    console.error('Error backfilling prices:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
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
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Admin Routes
app.post('/api/admin/revoke', async (req, res) => {
  try {
    const { adminAddress, targetVault, reason } = req.body;
    const result = await adminService.revokeAccess(adminAddress, targetVault, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error revoking access:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/admin/create', async (req, res) => {
  try {
    const { adminAddress, targetVault, vaultConfig } = req.body;
    const result = await adminService.createVault(adminAddress, targetVault, vaultConfig);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error creating vault:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/admin/transfer', async (req, res) => {
  try {
    const { adminAddress, targetVault, newOwner } = req.body;
    const result = await adminService.transferVault(adminAddress, targetVault, newOwner);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error transferring vault:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/admin/audit-logs', async (req, res) => {
  try {
    const { limit } = req.query;
    const result = await adminService.getAuditLogs(limit ? parseInt(limit) : 100);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Admin Key Management Routes
app.post('/api/admin/propose-new-admin', async (req, res) => {
  try {
    const { currentAdminAddress, newAdminAddress, contractAddress } = req.body;
    const result = await adminService.proposeNewAdmin(currentAdminAddress, newAdminAddress, contractAddress);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error proposing new admin:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/admin/accept-ownership', async (req, res) => {
  try {
    const { newAdminAddress, transferId } = req.body;
    const result = await adminService.acceptOwnership(newAdminAddress, transferId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error accepting ownership:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/admin/transfer-ownership', async (req, res) => {
  try {
    const { currentAdminAddress, newAdminAddress, contractAddress } = req.body;
    const result = await adminService.transferOwnership(currentAdminAddress, newAdminAddress, contractAddress);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error transferring ownership:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/admin/pending-transfers', async (req, res) => {
  try {
    const { contractAddress } = req.query;
    const result = await adminService.getPendingTransfers(contractAddress);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching pending transfers:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Vesting Routes
app.post('/api/vaults', async (req, res) => {
  try {
    const vault = await vestingService.createVault(req.body);
    res.status(201).json({ success: true, data: vault });
  } catch (error) {
    console.error('Error creating vault:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/vaults/:vaultAddress/top-up', async (req, res) => {
  try {
    const { vaultAddress } = req.params;
    const topUpData = { ...req.body, vault_address: vaultAddress };
    const subSchedule = await vestingService.processTopUp(topUpData);
    res.status(201).json({ success: true, data: subSchedule });
  } catch (error) {
    console.error('Error processing top-up:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/vaults/:vaultAddress/schedule', async (req, res) => {
  try {
    const { vaultAddress } = req.params;
    const { beneficiaryAddress } = req.query;
    const schedule = await vestingService.getVestingSchedule(vaultAddress, beneficiaryAddress);
    res.json({ success: true, data: schedule });
  } catch (error) {
    console.error('Error getting vesting schedule:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/vaults/:vaultAddress/:beneficiaryAddress/withdrawable', async (req, res) => {
  try {
    const { vaultAddress, beneficiaryAddress } = req.params;
    const { timestamp } = req.query;
    const vestingInfo = await vestingService.calculateWithdrawableAmount(
      vaultAddress, 
      beneficiaryAddress, 
      timestamp ? new Date(timestamp) : new Date()
    );
    res.json({ success: true, data: vestingInfo });
  } catch (error) {
    console.error('Error calculating withdrawable amount:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/vaults/:vaultAddress/:beneficiaryAddress/withdraw', async (req, res) => {
  try {
    const { vaultAddress, beneficiaryAddress } = req.params;
    const withdrawalData = { 
      ...req.body, 
      vault_address: vaultAddress, 
      beneficiary_address: beneficiaryAddress 
    };
    const result = await vestingService.processWithdrawal(withdrawalData);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/vaults/:vaultAddress/summary', async (req, res) => {
  try {
    const { vaultAddress } = req.params;
    const summary = await vestingService.getVaultSummary(vaultAddress);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error getting vault summary:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Start server
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    await sequelize.sync();
    console.log('Database synchronized successfully.');
    
    // Initialize GraphQL Server
    let graphQLServer = null;
    try {
      // Import GraphQL server (using require for CommonJS compatibility)
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
    
    // Start the HTTP server
    httpServer.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`REST API available at: http://localhost:${PORT}`);
      if (graphQLServer) {
        console.log(`GraphQL API available at: http://localhost:${PORT}/graphql`);
      }
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

startServer();
