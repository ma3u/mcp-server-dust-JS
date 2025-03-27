// Simple script to check environment variables
const dotenv = require('dotenv');

// Force reload of environment variables
dotenv.config({ override: true });

console.log('Checking environment variables:');
console.log('- DUST_API_KEY: ', process.env.DUST_API_KEY ? 
  '****' + process.env.DUST_API_KEY.slice(-4) : 'not set');
console.log('- DUST_WORKSPACE_ID:', process.env.DUST_WORKSPACE_ID);
console.log('- DUST_AGENT_ID:', process.env.DUST_AGENT_ID);
