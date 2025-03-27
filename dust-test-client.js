/**
 * Minimal Dust API Client using the official @dust-tt/client package
 */
require('dotenv').config();
const { DustAPI } = require('@dust-tt/client');

// Configuration from environment variables
const config = {
  apiKey: process.env.DUST_API_KEY,
  workspaceId: process.env.DUST_WORKSPACE_ID,
  url: process.env.DUST_DOMAIN || 'https://dust.tt',
  agentId: process.env.DUST_AGENT_ID,
  username: process.env.DUST_USERNAME || 'systems_analyst',
  fullName: process.env.DUST_FULLNAME || 'Systems Analyst',
  email: process.env.DUST_EMAIL || 'user@example.com',
  timezone: process.env.DUST_TIMEZONE || 'Europe/Berlin',
  prompt: process.argv[2] || 'Hello! Please introduce yourself and explain what you can help me with.'
};

// Verify required configuration
if (!config.apiKey || !config.workspaceId) {
  console.error('Error: Missing DUST_API_KEY or DUST_WORKSPACE_ID in .env file');
  process.exit(1);
}

// Log configuration (with API key masked)
const maskedApiKey = `${config.apiKey.substring(0, 4)}...${config.apiKey.substring(config.apiKey.length - 4)}`;
console.log('=== Dust API Test Client ===');
console.log(`URL: ${config.url}`);
console.log(`API Key: ${maskedApiKey} (${config.apiKey.length} chars)`);
console.log(`Workspace ID: ${config.workspaceId}`);
console.log(`Agent ID: ${config.agentId || 'using first available'}`);
console.log(`SDK Version: ${require('@dust-tt/client/package.json').version}`);
console.log(`Environment: Node.js ${process.version}, ${process.platform} ${process.arch}`);

// Initialize the Dust API client

const dustAPI = new DustAPI(
  {
    url: config.url,
  },
  {
    workspaceId:config.workspaceId,
    apiKey: config.apiKey,
  },
  console
);


/**
 * Main function to run the Dust client test
 */
async function main() {
  try {
    // 1. Get available agents
    console.log('\n1. Getting available agents...');
    
    try {
      // Simple debugging info about available methods
      console.log(`Checking API methods: ${typeof dustAPI.getAgentConfigurations === 'function' ? '✓' : '✗'}`);
      
      // get all Agents
      const result = await (async () => {
        try {
          const response = await dustAPI.getAgentConfigurations();
          if (response.isErr()) {
            return { success: false, error: response.error };
          }
          return { success: true, data: response.value };
        } catch (error) {
          return { success: false, error };
        }
      })();

      if (!result.success) {
        console.error('Failed to get agent configurations:', result.error);
        return;
      }

      const agents = result.data.filter(agent => agent.status === 'active');
      console.log(`✓ Found ${agents.length} active agents`);
    } catch (error) {
      console.error(`Error getting available agents:`, error);
      return;
    }
  } catch (error) {
    console.error(`Error in main function:`, error);
    return;
  }
}

// Run the main function
main(); 
