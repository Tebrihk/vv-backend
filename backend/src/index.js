const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// Vesting Management Routes
app.post('/api/vault/top-up', async (req, res) => {
  try {
    const { adminAddress, vaultAddress, topUpConfig } = req.body;
    const result = await adminService.topUpVault(adminAddress, vaultAddress, topUpConfig);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error topping up vault:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/vault/:vaultAddress/details', async (req, res) => {
  try {
    const { vaultAddress } = req.params;
    const result = await adminService.getVaultDetails(vaultAddress);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching vault details:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/vault/:vaultAddress/releasable', async (req, res) => {
  try {
    const { vaultAddress } = req.params;
    const { asOfDate } = req.query;
    const result = await adminService.calculateReleasableAmount(
      vaultAddress, 
      asOfDate ? new Date(asOfDate) : new Date()
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error calculating releasable amount:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/vault/release', async (req, res) => {
  try {
    const { adminAddress, vaultAddress, releaseAmount, userAddress } = req.body;
    const result = await adminService.releaseTokens(adminAddress, vaultAddress, releaseAmount, userAddress);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error releasing tokens:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Indexing Service Routes for Vesting Events
app.post('/api/indexing/top-up', async (req, res) => {
  try {
    const result = await indexingService.processTopUpEvent(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Error processing top-up event:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/indexing/release', async (req, res) => {
  try {
    const result = await indexingService.processReleaseEvent(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error processing release event:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Delegate Management Routes
app.post('/api/delegate/set', async (req, res) => {
  try {
    const { vaultId, ownerAddress, delegateAddress } = req.body;
    const result = await vestingService.setDelegate(vaultId, ownerAddress, delegateAddress);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error setting delegate:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/delegate/claim', async (req, res) => {
  try {
    const { delegateAddress, vaultAddress, releaseAmount } = req.body;
    const result = await vestingService.claimAsDelegate(delegateAddress, vaultAddress, releaseAmount);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in delegate claim:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/delegate/:vaultAddress/info', async (req, res) => {
  try {
    const { vaultAddress } = req.params;
    const result = await vestingService.getVaultWithSubSchedules(vaultAddress);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching delegate info:', error);
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
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

startServer();
