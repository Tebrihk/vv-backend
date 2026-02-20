const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test data for a sample claim
const sampleClaim = {
  user_address: '0x1234567890123456789012345678901234567890',
  token_address: '0xA0b86a33E6441e6c8d0A1c9c8c8d8d8d8d8d8d8d', // Example token address
  amount_claimed: '100.5',
  claim_timestamp: '2024-01-15T10:30:00Z',
  transaction_hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  block_number: 18500000
};

async function testHistoricalPriceTracking() {
  console.log('🧪 Testing Historical Price Tracking Implementation\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data);

    // Test 2: Process a single claim
    console.log('\n2. Testing single claim processing...');
    const claimResponse = await axios.post(`${BASE_URL}/api/claims`, sampleClaim);
    console.log('✅ Claim processed successfully:', claimResponse.data);

    const claimId = claimResponse.data.data.id;

    // Test 3: Process batch claims
    console.log('\n3. Testing batch claim processing...');
    const batchClaims = [
      { ...sampleClaim, transaction_hash: '0x1111111111111111111111111111111111111111111111111111111111111111', amount_claimed: '50.25' },
      { ...sampleClaim, transaction_hash: '0x2222222222222222222222222222222222222222222222222222222222222222', amount_claimed: '75.75' }
    ];
    
    const batchResponse = await axios.post(`${BASE_URL}/api/claims/batch`, { claims: batchClaims });
    console.log('✅ Batch claims processed:', batchResponse.data);

    // Test 4: Get realized gains
    console.log('\n4. Testing realized gains calculation...');
    const gainsResponse = await axios.get(`${BASE_URL}/api/claims/${sampleClaim.user_address}/realized-gains`);
    console.log('✅ Realized gains calculated:', gainsResponse.data);

    // Test 5: Backfill prices (if there are any claims without prices)
    console.log('\n5. Testing price backfill...');
    const backfillResponse = await axios.post(`${BASE_URL}/api/claims/backfill-prices`);
    console.log('✅ Price backfill completed:', backfillResponse.data);

    console.log('\n🎉 All tests passed! Historical price tracking is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testHistoricalPriceTracking();
}

module.exports = { testHistoricalPriceTracking, sampleClaim };
