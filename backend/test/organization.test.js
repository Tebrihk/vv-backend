const { sequelize, models } = require('../src/models');

async function testOrganizationModel() {
  console.log('🧪 Testing Organization Model Implementation\n');

  try {
    // Sync the database (this will create the tables if they don't exist)
    await sequelize.sync({ force: false }); // Use force: false to avoid dropping existing data
    
    console.log('✅ Database synced successfully');

    // Test 1: Create an organization
    console.log('\n1. Testing organization creation...');
    
    const testOrg = await models.Organization.create({
      name: 'Test Organization',
      logo_url: 'https://example.com/logo.png',
      website_url: 'https://example.com',
      discord_url: 'https://discord.gg/example',
      admin_address: '0x1234567890123456789012345678901234567890'
    });
    
    console.log('✅ Organization created:', testOrg.toJSON());

    // Test 2: Find the organization by admin address
    console.log('\n2. Testing organization retrieval by admin address...');
    
    const foundOrg = await models.Organization.findOne({
      where: { admin_address: '0x1234567890123456789012345678901234567890' }
    });
    
    console.log('✅ Organization retrieved:', foundOrg.toJSON());

    // Test 3: Create a vault and link it to the organization
    console.log('\n3. Testing vault creation with organization link...');
    
    const testVault = await models.Vault.create({
      address: '0xabcdef1234567890abcdef1234567890abcdef1234',
      name: 'Test Vault',
      token_address: '0xdef1234567890abcdef1234567890abcdef12345',
      owner_address: '0x1234567890123456789012345678901234567890',
      total_amount: '1000',
      org_id: foundOrg.id
    });
    
    console.log('✅ Vault created with organization link:', testVault.toJSON());

    // Test 4: Test the association - get vaults for the organization
    console.log('\n4. Testing organization-vault association...');
    
    const orgWithVaults = await models.Organization.findByPk(foundOrg.id, {
      include: [{
        model: models.Vault,
        as: 'vaults'
      }]
    });
    
    console.log('✅ Organization with associated vaults:', {
      org: orgWithVaults.toJSON(),
      vaults: orgWithVaults.vaults.map(v => v.toJSON())
    });

    console.log('\n🎉 All organization model tests passed!');

    // Clean up - delete the test data (optional)
    // await testVault.destroy();
    // await testOrg.destroy();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testOrganizationModel();
}

module.exports = { testOrganizationModel };