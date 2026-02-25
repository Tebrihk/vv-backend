const axios = require('axios');
const { sequelize } = require('./src/database/connection');
const { Vault } = require('./src/models');

// Test data for token distribution
const testTokenAddress = '0x1234567890123456789012345678901234567890';
const testVaults = [
  {
    address: '0x1111111111111111111111111111111111111111',
    name: 'Team Vault 1',
    token_address: testTokenAddress,
    owner_address: '0xowner111111111111111111111111111111111111111',
    total_amount: '5000000',
    tag: 'Team'
  },
  {
    address: '0x2222222222222222222222222222222222222222',
    name: 'Advisors Vault',
    token_address: testTokenAddress,
    owner_address: '0xowner111111111111111111111111111111111111111',
    total_amount: '1000000',
    tag: 'Advisors'
  },
  {
    address: '0x3333333333333333333333333333333333333333',
    name: 'Seed Round Vault',
    token_address: testTokenAddress,
    owner_address: '0xowner111111111111111111111111111111111111111',
    total_amount: '8000000',
    tag: 'Seed'
  },
  {
    address: '0x4444444444444444444444444444444444444444',
    name: 'Private Sale Vault',
    token_address: testTokenAddress,
    owner_address: '0xowner111111111111111111111111111111111111111',
    total_amount: '3000000',
    tag: 'Private'
  },
  {
    address: '0x5555555555555555555555555555555555555555',
    name: 'Team Vault 2',
    token_address: testTokenAddress,
    owner_address: '0xowner111111111111111111111111111111111111111',
    total_amount: '2000000',
    tag: 'Team'
  },
  {
    address: '0x6666666666666666666666666666666666666666',
    name: 'Uncategorized Vault',
    token_address: testTokenAddress,
    owner_address: '0xowner111111111111111111111111111111111111111',
    total_amount: '1500000',
    tag: null
  }
];

async function setupTestData() {
  console.log('🔧 Setting up test data...');
  
  try {
    await sequelize.authenticate();
    
    // Clean up existing test data
    await Vault.destroy({
      where: {
        token_address: testTokenAddress
      }
    });
    
    // Create test vaults
    await Vault.bulkCreate(testVaults);
    
    console.log('✅ Test data created successfully');
    
    // Verify the data was created
    const vaults = await Vault.findAll({
      where: { token_address: testTokenAddress }
    });
    
    console.log(`📊 Created ${vaults.length} test vaults:`);
    vaults.forEach(vault => {
      console.log(`  - ${vault.name}: ${vault.total_amount} (${vault.tag || 'No tag'})`);
    });
    
  } catch (error) {
    console.error('❌ Failed to setup test data:', error.message);
    throw error;
  }
}

async function testDistributionEndpoint() {
  const baseURL = process.env.BASE_URL || 'http://localhost:4000';
  
  console.log('\n🧪 Testing token distribution endpoint...');
  
  try {
    const response = await axios.get(`${baseURL}/api/token/${testTokenAddress}/distribution`);
    
    console.log('✅ Endpoint response:', response.status);
    console.log('📊 Distribution data:');
    
    const { data } = response.data;
    
    if (data.length === 0) {
      console.log('⚠️  No distribution data returned');
    } else {
      data.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.label}: ${item.amount.toLocaleString()} tokens`);
      });
      
      // Calculate total
      const total = data.reduce((sum, item) => sum + item.amount, 0);
      console.log(`\n💰 Total distributed: ${total.toLocaleString()} tokens`);
      
      // Verify expected results
      const expected = [
        { label: 'Seed', amount: 8000000 },
        { label: 'Team', amount: 7000000 }, // 5000000 + 2000000
        { label: 'Private', amount: 3000000 },
        { label: 'Advisors', amount: 1000000 }
      ];
      
      console.log('\n🔍 Verification:');
      let allMatch = true;
      
      expected.forEach((exp, index) => {
        const actual = data[index];
        if (actual && actual.label === exp.label && actual.amount === exp.amount) {
          console.log(`  ✅ ${exp.label}: ${exp.amount.toLocaleString()} (correct)`);
        } else {
          console.log(`  ❌ Expected ${exp.label}: ${exp.amount.toLocaleString()}, got ${actual ? `${actual.label}: ${actual.amount.toLocaleString()}` : 'nothing'}`);
          allMatch = false;
        }
      });
      
      if (allMatch) {
        console.log('\n🎉 All distribution data is correct!');
      } else {
        console.log('\n❌ Some distribution data is incorrect');
      }
    }
    
  } catch (error) {
    console.error('❌ Endpoint test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testEdgeCases() {
  const baseURL = process.env.BASE_URL || 'http://localhost:4000';
  
  console.log('\n🧪 Testing edge cases...');
  
  try {
    // Test with non-existent token address
    console.log('1. Testing non-existent token address...');
    const nonExistentResponse = await axios.get(`${baseURL}/api/token/0x0000000000000000000000000000000000000000/distribution`);
    console.log('✅ Non-existent token response:', nonExistentResponse.status, nonExistentResponse.data);
    
    // Test with invalid address format
    console.log('2. Testing invalid address format...');
    try {
      await axios.get(`${baseURL}/api/token/invalid-address/distribution`);
      console.log('❌ Should have failed with invalid address');
    } catch (error) {
      console.log('✅ Invalid address correctly rejected:', error.response?.status);
    }
    
  } catch (error) {
    console.error('❌ Edge case test failed:', error.message);
  }
}

async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    await Vault.destroy({
      where: {
        token_address: testTokenAddress
      }
    });
    
    console.log('✅ Test data cleaned up');
    await sequelize.close();
  } catch (error) {
    console.error('❌ Failed to cleanup test data:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting Token Distribution API Tests...\n');
  
  try {
    await setupTestData();
    await testDistributionEndpoint();
    await testEdgeCases();
    await cleanupTestData();
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📝 API Usage:');
    console.log('GET /api/token/:address/distribution');
    console.log('Response format:');
    console.log('{');
    console.log('  "success": true,');
    console.log('  "data": [');
    console.log('    { "label": "Team", "amount": 7000000 },');
    console.log('    { "label": "Seed", "amount": 8000000 },');
    console.log('    { "label": "Private", "amount": 3000000 },');
    console.log('    { "label": "Advisors", "amount": 1000000 }');
    console.log('  ]');
    console.log('}');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { setupTestData, testDistributionEndpoint, testEdgeCases, cleanupTestData };
