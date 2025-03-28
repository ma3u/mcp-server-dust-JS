/**
 * Dust.tt API Client Test
 * This script demonstrates connecting to the Dust API using the @dust-tt/client package
 * Based on the official SDK example from the NPM package documentation
 */

const { DustAPI } = require('@dust-tt/client');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function main() {
  // Configuration from environment variables
  const config = {
    workspaceId: process.env.DUST_WORKSPACE_ID || '11453f1c9e',
    apiKey: process.env.DUST_API_KEY || 'sk-32482554ff5109791773970d8db38abb',
    baseUrl: process.env.DUST_DOMAIN || 'https://dust.tt',
    agentId: process.env.DUST_AGENT_ID || '442875',
    username: process.env.DUST_USERNAME || 'systems_analyst',
    fullName: process.env.DUST_FULLNAME || 'Ma Bu',
    timezone: process.env.DUST_TIMEZONE || 'Europe/Berlin'
  };

  console.log('=========================================');
  console.log('Dust.tt API SDK Example');
  console.log('=========================================');
  console.log(`Workspace ID: ${config.workspaceId}`);
  console.log(`Agent ID: ${config.agentId}`);
  console.log(`Base URL: ${config.baseUrl}`);
  console.log('=========================================');

  // Initialize the client
  console.log('\nInitializing Dust API client...');
  const dustApi = new DustAPI(
    { url: config.baseUrl },
    { workspaceId: config.workspaceId, apiKey: config.apiKey },
    console
  );
  
  try {
    // Get available agents
    console.log('\nFetching available agents...');
    const agentsResult = await dustApi.getAgentConfigurations({});

    if (agentsResult.isErr()) {
      throw new Error(`Failed to get agents: ${agentsResult.error.message}`);
    }
    
    const agents = agentsResult.value.filter((agent) => agent.status === "active");
    console.log(`Found ${agents.length} active agents:`);
    agents.forEach((agent, index) => {
      console.log(`${index + 1}. ${agent.name} (ID: ${agent.id})`);
      if (String(agent.id) === String(config.agentId)) {
        console.log(`   -> This is our target agent`);
      }
    });
    
    // Check if our target agent exists
    const targetAgent = agents.find(agent => String(agent.id) === String(config.agentId));
    if (!targetAgent) {
      throw new Error(`Agent with ID ${config.agentId} not found!`);
    }
    
    // Set up context for the conversation
    const context = {
      timezone: config.timezone,
      username: config.username,
      fullName: config.fullName
    };

    // The message to send to the agent
    const question = "Hello! Please introduce yourself and explain what you can help me with.";
    console.log(`\nCreating conversation with initial message: "${question}"`);

    // Create a conversation with an initial message that mentions our agent
    const conversationResult = await dustApi.createConversation({
      title: "API Test Conversation",
      message: {
        content: question,
        mentions: [
          {
            configurationId: config.agentId,
          },
        ],
        context,
      },
    });

    if (conversationResult.isErr()) {
      throw new Error(`Failed to create conversation: ${conversationResult.error.message}`);
    }

    const { conversation, message } = conversationResult.value;
    console.log(`Conversation created with ID: ${conversation.sId}`);
    console.log(`Message sent with ID: ${message.sId}`);

    // Set up abort controller for stream cancellation (optional)
    const abortController = new AbortController();
    const signal = abortController.signal;

    // After 60 seconds, abort the stream if it's still running
    const timeout = setTimeout(() => {
      console.log('\nStream timeout reached, aborting...');
      abortController.abort();
    }, 60000);

    console.log('\nStarting event stream to receive agent response...');

    try {
      // Stream the agent's answer events
      const streamResult = await dustApi.streamAgentAnswerEvents({
        conversation,
        userMessageId: message.sId,
        signal,
      });

      if (streamResult.isErr()) {
        throw new Error(`Failed to start stream: ${streamResult.error.message}`);
      }

      const { eventStream } = streamResult.value;

      let answer = "";
      let chainOfThought = "";

      console.log('\nReceiving response in real-time:');
      console.log('=========================================');

      // Process events from the stream
      for await (const event of eventStream) {
        if (!event) {
          continue;
        }

        switch (event.type) {
          case "user_message_error": {
            console.error(
              `User message error: code: ${event.error.code} message: ${event.error.message}`
            );
            break;
          }
          case "agent_error": {
            console.error(
              `Agent error: code: ${event.error.code} message: ${event.error.message}`
            );
            break;
          }
          case "agent_action_success": {
            console.log('\n[Agent performed an action]');
            break;
          }
          case "generation_tokens": {
            if (event.classification === "tokens") {
              // Real-time streaming of the response
              process.stdout.write(event.text);
              answer = (answer + event.text).trim();
            } else if (event.classification === "chain_of_thought") {
              chainOfThought += event.text;
            }
            break;
          }
          case "agent_message_success": {
            // Final complete message
            answer = event.message.content ?? "";
            console.log('\n\n[Message completed]');
            break;
          }
          default:
            // Nothing to do on unsupported events
            break;
        }
      }

      // Clear the timeout since stream completed
      clearTimeout(timeout);

      console.log('\n=========================================');
      console.log('\nFull response:');
      console.log('=========================================');
      console.log(answer);
      console.log('=========================================');

      console.log('\nConversation completed successfully!');
      console.log(`- Conversation ID: ${conversation.sId}`);
      console.log(`- You can view this conversation in the Dust.tt workspace:`);
      console.log(`  ${config.baseUrl}/w/${config.workspaceId}/assistant/conversations/${conversation.sId}`);

    } catch (error) {
      // Clear the timeout if there was an error
      clearTimeout(timeout);

      if (error.name === "AbortError") {
        console.log('\nStream was aborted');
      } else {
        throw error; // Re-throw other errors
      }
    }
  } catch (error) {
    console.error('\nError:');
    console.error(error.message);
    if (error.dustError) {
      console.error('Dust API error:', error.dustError);
    }
  }
}

main().catch(error => {
  console.error('Error in main function:', error);
});