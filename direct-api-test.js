require('dotenv').config();
const fetch = require('node-fetch');

// Use the same credentials as in the main client
const apiKey = process.env.DUST_API_KEY;
const workspaceId = process.env.DUST_WORKSPACE_ID;
const baseUrl = process.env.DUST_DOMAIN || 'https://dust.tt';

async function testDirectApi() {
  console.log('=== Testing direct API call ===');
  console.log(`URL: ${baseUrl}`);
  console.log(`API Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)} (length: ${apiKey.length})`);
  console.log(`Workspace ID: ${workspaceId}`);
  
  try {
    // This mimics the curl command directly
    const url = `${baseUrl}/api/v1/w/${workspaceId}/assistant/agent_configurations`;
    console.log(`\nMaking direct fetch request to: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${apiKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('\n✓ Success! API responded with:');
    console.log(`Found ${data.length} agent configurations`);
    
    // Print first few items as sample
    if (data.length > 0) {
      console.log('\nSample agent (first item):');
      const sample = data[0];
      console.log(JSON.stringify(sample, null, 2));
    }
    
    return data;
  } catch (error) {
    console.error('\n❌ Direct API Error:');
    console.error('- Error type:', error.constructor.name);
    console.error('- Message:', error.message);
    console.error('- Stack trace:', error.stack);
  }
}

// Run the test
testDirectApi().then(() => {
  console.log('\nDirect API test completed');
});
