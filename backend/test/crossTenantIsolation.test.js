const axios = require('axios');
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Replace with actual org and admin addresses for your test DB
const ORG_A = { id: 'org-a-uuid', admin: '0xadminA' };
const ORG_B = { id: 'org-b-uuid', admin: '0xadminB' };

async function testWebhookIsolation() {
  console.log('🔒 Testing webhook registration isolation...');
  // Admin A registers webhook for Org A (should succeed)
  let res = await axios.post(`${BASE_URL}/api/admin/webhooks`, {
    organization_id: ORG_A.id,
    webhook_url: 'https://webhook-a.com',
    admin_address: ORG_A.admin
  });
  if (res.status !== 201) throw new Error('Admin A failed to register webhook for Org A');
  console.log('✅ Admin A registered webhook for Org A');

  // Admin B tries to register webhook for Org A (should fail)
  let failed = false;
  try {
    await axios.post(`${BASE_URL}/api/admin/webhooks`, {
      organization_id: ORG_A.id,
      webhook_url: 'https://webhook-b.com',
      admin_address: ORG_B.admin
    });
  } catch (e) {
    if (e.response && e.response.status === 403) {
      failed = true;
      console.log('✅ Admin B forbidden from registering webhook for Org A');
    }
  }
  if (!failed) throw new Error('Admin B should not be able to register webhook for Org A');
}

async function testVaultExportIsolation() {
  console.log('🔒 Testing vault export isolation...');
  // Assume vaultA belongs to Org A
  const vaultAId = 'vault-a-uuid';
  // Admin A exports vaultA (should succeed)
  let res = await axios.get(`${BASE_URL}/api/vault/${vaultAId}/export?admin_address=${ORG_A.admin}`);
  if (res.status !== 200) throw new Error('Admin A failed to export vaultA');
  console.log('✅ Admin A exported vaultA');

  // Admin B tries to export vaultA (should fail)
  let failed = false;
  try {
    await axios.get(`${BASE_URL}/api/vault/${vaultAId}/export?admin_address=${ORG_B.admin}`);
  } catch (e) {
    if (e.response && e.response.status === 403) {
      failed = true;
      console.log('✅ Admin B forbidden from exporting vaultA');
    }
  }
  if (!failed) throw new Error('Admin B should not be able to export vaultA');
}

(async () => {
  try {
    await testWebhookIsolation();
    await testVaultExportIsolation();
    console.log('\n🎉 Cross-tenant isolation tests passed!');
  } catch (e) {
    console.error('❌ Cross-tenant isolation test failed:', e.message);
    process.exit(1);
  }
})();
