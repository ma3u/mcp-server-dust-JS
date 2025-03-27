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
const dustApi = new DustAPI(
  { url: config.url },
  { workspaceId: config.workspaceId, apiKey: config.apiKey },
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
      console.log(`Checking API methods: ${typeof dustApi.getAgentConfigurations === 'function' ? '✓' : '✗'}`);
      
      // Get agent configurations
      console.log('Fetching agent configurations...');
      const agentResult = await dustApi.getAgentConfigurations().catch(err => {
        console.error('\nAPI ERROR:');
        console.error(`- ${err.message}`);
        console.error(`- ${err.stack}`);
        throw err;
      });
      
      if (agentResult.isErr()) {
        throw new Error(`API Error: ${agentResult.error.message}`);
      }
      
      // Handle the agents
      const agents = agentResult.value.filter(agent => agent.status === 'active');
      console.log(`✓ Found ${agents.length} active agents`);
      
      // Select an agent
      let agentId = config.agentId;
      if (!agentId && agents.length > 0) {
        agentId = agents[0].sId;
        console.log(`✓ Using first agent: ${agents[0].name}`);
      } else if (agentId && !agents.some(a => a.sId === agentId)) {
        console.log(`⚠️ Agent ID '${agentId}' not found. Using first available.`);
        agentId = agents[0]?.sId;
      }
      
      if (!agentId) {
        throw new Error('No active agents found');
      }

      // 2. Create a conversation
      console.log('\n2. Creating conversation...');
      
      const context = {
        timezone: config.timezone,
        username: config.username,
        email: config.email,
        fullName: config.fullName,
        profilePictureUrl: null,
        origin: 'api'
      };
      
      const conversationResult = await dustApi.createConversation({
        title: null,
        visibility: 'unlisted',
        message: {
          content: config.prompt,
          mentions: [{ configurationId: agentId }],
          context
        }
      });
      
      if (conversationResult.isErr()) {
        throw new Error(`Conversation error: ${conversationResult.error.message}`);
      }
      
      const { conversation, message } = conversationResult.value;
      console.log(`✓ Conversation created: ${conversation.sId}`);
      
      // 3. Stream the response
      console.log('\n3. Streaming response...');
    
      // Setup timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      
      try {
        const streamResult = await dustApi.streamAgentAnswerEvents({
          conversation,
          userMessageId: message.sId,
          signal: controller.signal
        });
      
        clearTimeout(timeout);
        
        if (streamResult.isErr()) {
          throw new Error(streamResult.error.message);
        }
        
        // Process the stream
        const { eventStream } = streamResult.value;
        let answer = "";
        let chainOfThought = "";
        
        console.log('\nAgent is responding:');
      
        for await (const event of eventStream) {
          if (!event) continue;
          
          switch (event.type) {
            case "user_message_error":
            case "agent_error":
              console.error(`Error: ${event.error.message}`);
              return;
              
            case "generation_tokens":
              if (event.classification === "tokens") {
                process.stdout.write(event.text); // Real-time output
                answer = (answer + event.text).trim();
              } else if (event.classification === "chain_of_thought") {
                chainOfThought += event.text;
              }
              break;
              
            case "agent_message_success":
              answer = event.message.content ?? "";
              break;
          }
        }
      
        // Show summary
        console.log('\n\n--- Response Summary ---');
        console.log(`✓ Answer received (${answer.length} chars)`);
        
        if (chainOfThought) {
          console.log(`✓ Chain of thought captured (${chainOfThought.length} chars)`);
        }
        
      } catch (error) {
        clearTimeout(timeout);
        if (error.message.includes("AbortError")) {
          console.log('❌ Response timed out after 60 seconds');
        } else {
          console.error(`❌ Stream error: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`\n❌ API ERROR: ${error.message}`);
    }
  } catch (error) {
    console.error(`FATAL ERROR: ${error.message}`);
  }
}

// Run the main function
main();

