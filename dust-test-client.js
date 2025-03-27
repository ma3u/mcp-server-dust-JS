/**
 * Minimal Dust API Client using the official @dust-tt/client package
 * This script follows the exact examples from https://www.npmjs.com/package/@dust-tt/client
 */

const { DustAPI } = require('@dust-tt/client');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configuration from environment variables
const config = {
  apiKey: process.env.DUST_API_KEY,
  workspaceId: process.env.DUST_WORKSPACE_ID,
  url: process.env.DUST_DOMAIN || 'https://dust.tt',
  username: process.env.DUST_USERNAME || 'systems_analyst',
  fullName: process.env.DUST_FULLNAME || 'Systems Analyst',
  email: 'user@example.com', // Placeholder email
  timezone: process.env.DUST_TIMEZONE || 'Europe/Berlin',
  prompt: process.argv[2] || 'Hello! Please introduce yourself and explain what you can help me with.'
};

// Verify required configuration
if (!config.apiKey || !config.workspaceId) {
  console.error('Error: Required environment variables missing.\nPlease make sure DUST_API_KEY and DUST_WORKSPACE_ID are set in your .env file.');
  process.exit(1);
}

console.log('=== Dust API Test Client (Official SDK) ===');
console.log('CONFIGURATION FOR ISSUE REPRODUCTION:');

// Log all configuration values for reproduction (with API key masked)
const maskedApiKey = config.apiKey ? `${config.apiKey.substring(0, 4)}...${config.apiKey.substring(config.apiKey.length - 4)}` : 'not set';

console.log(`URL: ${config.url}`);
console.log(`API Key: ${maskedApiKey} (length: ${config.apiKey?.length || 0})`);
console.log(`Workspace ID: ${config.workspaceId}`);
console.log(`Agent ID: ${config.agentId || 'not set (will use first available)'}`); 
console.log(`SDK Version: ${require('@dust-tt/client/package.json').version}`);
console.log(`Node.js Version: ${process.version}`);
console.log(`Operating System: ${process.platform} ${process.arch}`);
console.log(`User Context:`);
console.log(`  - Username: ${config.username}`);
console.log(`  - Full Name: ${config.fullName}`);
console.log(`  - Email: ${config.email}`);
console.log(`  - Timezone: ${config.timezone}`);
console.log(`Prompt: "${config.prompt}"`);

console.log('\nINITIALIZING CLIENT WITH:');
console.log(`dustApi = new DustAPI(\n  { url: "${config.url}" },\n  { workspaceId: "${config.workspaceId}", apiKey: "***" },\n  console\n);\n`);
console.log('==========================================');

// Initialize the Dust API client exactly as in the documentation
const dustApi = new DustAPI(
  {
    url: config.url,
  },
  {
    workspaceId: config.workspaceId,
    apiKey: config.apiKey,
  },
  console
);

/**
 * Main function to run the Dust client test
 */
async function main() {
  try {
    // Step 1: Get all available agents (exactly as in docs)
    console.log('\n1. Getting available agents...');
    
    // Log the dustApi structure for debugging
    console.log('DustAPI instance method check:');
    console.log('- Has getAgentConfigurations:', typeof dustApi.getAgentConfigurations === 'function');
    console.log('- Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(dustApi)));
    
    try {
      console.log('Calling dustApi.getAgentConfigurations()...');
      
      // Add detailed error tracking with wrapped promise
      const r = await Promise.resolve().then(async () => {
        try {
          console.log('Executing getAgentConfigurations...');
          return await dustApi.getAgentConfigurations();
        } catch (err) {
          console.error('\n\nERROR DETAILS (Synchronous error):');
          console.error('- Error type:', err.constructor.name);
          console.error('- Message:', err.message);
          console.error('- Stack trace:', err.stack);
          throw err;
        }
      }).catch(err => {
        console.error('\n\nERROR DETAILS (Asynchronous error):');
        console.error('- Error type:', err.constructor.name);
        console.error('- Message:', err.message);
        console.error('- Stack trace:', err.stack);
        throw err; // Re-throw to be caught by outer try/catch
      });
      
      console.log('Call completed successfully');

      if (r.isErr()) {
        throw new Error(`API Error: ${r.error.message}`);
      }
      
      const agents = r.value.filter((agent) => agent.status === 'active');
      console.log(`\n✓ Found ${agents.length} active agents:`);
      agents.forEach(agent => {
        console.log(`  - ${agent.name} (${agent.sId})`);
      });
      
      // Select an agent for our conversation
      let agentId = config.agentId;
      if (!agentId && agents.length > 0) {
        agentId = agents[0].sId;
        const selectedAgent = agents.find(a => a.sId === agentId);
        console.log(`\n✓ Using agent: ${selectedAgent.name} (${selectedAgent.sId})`);
      } else if (!agents.some(a => a.sId === agentId)) {
        console.warn(`\n⚠️ Warning: Specified agent ID '${agentId}' not found or not active.`);
        console.log('Will use the first available agent instead.');
        agentId = agents[0]?.sId;
      }
      
      if (!agentId) {
        throw new Error('No active agents found in the workspace.');
      }

      // Step 2: Create a conversation with message (exactly as in docs)
      console.log('\n2. Creating conversation with message...');
      
      // Define the context for the message (exactly as in docs)
      const context = {
        timezone: config.timezone,
        username: config.username,
        email: config.email,
        fullName: config.fullName,
        profilePictureUrl: null,
        origin: 'api', // As mentioned in docs: "Contact us to add more"
      };
      
      // Create the conversation (exactly as in docs)
      const r2 = await dustApi.createConversation({
        title: null,
        visibility: 'unlisted',
        message: {
          content: config.prompt,
          mentions: [
            {
              configurationId: agentId,
            },
          ],
          context,
        },
      });
      
      if (r2.isErr()) {
        throw new Error(r2.error.message);
      }
      
      const { conversation, message } = r2.value;
      console.log(`\n✓ Conversation created: ${conversation.sId}`);
      console.log(`✓ Message sent: ${message.sId}`);
      
      // Step 3: Stream the agent response (exactly as in docs)
      console.log('\n3. Streaming agent response...');
    
      try {
        // Create abort controller for timeout (exactly as in docs)
        const controller = new AbortController();
        const signal = controller.signal;
        
        // Set a timeout (as mentioned in docs)
        const timeout = setTimeout(() => controller.abort(), 60000);
        
        const r3 = await dustApi.streamAgentAnswerEvents({
          conversation,
          userMessageId: message.sId,
          signal,
        });
      
        clearTimeout(timeout);
        
        if (r3.isErr()) {
          throw new Error(r3.error.message);
        }
        
        const { eventStream } = r3.value;
        
        // These variables match the exact pattern from the docs
        let answer = "";
        let action = undefined; // AgentActionPublicType in TypeScript
        let chainOfThought = "";
        
        console.log('\nStreaming response (output will appear below):');
      
        // Process the event stream exactly as in the docs
        for await (const event of eventStream) {
          if (!event) {
            continue;
          }
          
          switch (event.type) {
            case "user_message_error": {
              console.error(
                `User message error: code: ${event.error.code} message: ${event.error.message}`
              );
              return;
            }
            case "agent_error": {
              console.error(
                `Agent message error: code: ${event.error.code} message: ${event.error.message}`
              );
              return;
            }
            case "agent_action_success": {
              action = event.action;
              break;
            }
            case "generation_tokens": {
              if (event.classification === "tokens") {
                process.stdout.write(event.text); // Added for UX - not in original docs
                answer = (answer + event.text).trim();
              } else if (event.classification === "chain_of_thought") {
                chainOfThought += event.text;
              }
              break;
            }
            case "agent_message_success": {
              answer = event.message.content ?? "";
              break;
            }
            default: {
              // Nothing to do for unsupported event types
            }
          }
        }
      
        // Display the final results
        console.log('\n-------- FINAL RESPONSE --------');
        console.log(answer);
        console.log('-------------------------------');
        
        if (chainOfThought) {
          console.log('\n-------- CHAIN OF THOUGHT --------');
          console.log(chainOfThought.substring(0, 300) + (chainOfThought.length > 300 ? '...' : ''));
          console.log('--------------------------------');
        }
        
        console.log('\n✓ Response received successfully');
        
      } catch (error) {
        // Handle aborts as shown in docs
        if (error instanceof Error && error.message.includes("AbortError")) {
          console.log('\n❌ Stream aborted (timeout)'); // Stream aborted as mentioned in docs
        } else {
          console.error(`\n❌ Other error: ${error.message}`); // Other error as mentioned in docs
        }
      }
    } catch (error) {
      console.error('\n❌ ERROR IN AGENT CONFIGURATION:');
      console.error('- Error type:', error.constructor.name);
      console.error('- Message:', error.message);
      console.error('- Stack trace:', error.stack);
    }
  } catch (error) {
    console.error(`\n❌ OUTER ERROR: ${error.message}`);
    console.error('- Stack trace:', error.stack);
  }
}

// Run the main function
main();

