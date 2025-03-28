/**
 * Dust.tt API Client Test
 * This script implements the streaming solution exactly as shown in the official SDK documentation
 * Source: https://www.npmjs.com/package/@dust-tt/client
 */

const { DustAPI } = require('@dust-tt/client');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function main() {
  // Configuration from environment variables only - no hardcoded secrets
  const config = {
    workspaceId: process.env.DUST_WORKSPACE_ID,
    apiKey: process.env.DUST_API_KEY,
    baseUrl: process.env.DUST_DOMAIN || 'https://dust.tt',
    agentId: process.env.DUST_AGENT_ID,
    username: process.env.DUST_USERNAME || 'user',
    fullName: process.env.DUST_FULLNAME || 'Dust API User',
    timezone: process.env.DUST_TIMEZONE || 'UTC'
  };
  
  // Verify required environment variables are set
  if (!config.workspaceId || !config.apiKey || !config.agentId) {
    throw new Error('Missing required environment variables. Please set DUST_WORKSPACE_ID, DUST_API_KEY, and DUST_AGENT_ID');
  }

  console.log('=========================================');
  console.log('Dust.tt API SDK Example - Official Documentation Implementation');
  console.log('=========================================');
  console.log(`Workspace ID: ${config.workspaceId}`);
  console.log(`Agent ID: ${config.agentId}`);
  console.log(`Base URL: ${config.baseUrl}`);
  console.log('=========================================');

  try {
    console.log('\nFollowing the exact SDK documentation approach');
    console.log('Source: https://www.npmjs.com/package/@dust-tt/client');
    
    // Initialize the Dust API client
    const dustApi = new DustAPI(
      { url: config.baseUrl },
      { workspaceId: config.workspaceId, apiKey: config.apiKey },
      console
    );
    
    // Following the example from the documentation
    // Setup context for user information
    const context = {
      timezone: config.timezone,
      username: config.username,
      fullName: config.fullName
    };
    
    console.log('\nCreating conversation with initial message...');
    
    // Start a new conversation with a message mentioning the agent
    const conversationRes = await dustApi.createConversation({
      title: "Documentation Example Conversation",
      message: {
        content: "Hello! What can you help me with?",
        mentions: [{ configurationId: config.agentId }],
        context: context,
      },
    });
    
    if (conversationRes.isErr()) {
      throw new Error(`Failed to create conversation: ${conversationRes.error.message}`);
    }
    
    const { conversation, message } = conversationRes.value;
    
    console.log(`Conversation created with ID: ${conversation.sId}`);
    console.log(`Message sent with ID: ${message.sId}`);

    // For handling stream cancellation
    const controller = new AbortController();
    const signal = controller.signal;
    
    // Set a timeout for stream cancellation
    const timeout = setTimeout(() => {
      console.log('Stream timeout reached, aborting...');
      controller.abort();
    }, 60000);
    
    // Now using the exact streaming implementation from the SDK documentation
    console.log('\nFollowing the SDK documentation for streaming...');
    
    try {
      // Wait a moment for the agent message to be created
      // This is not in the documentation but necessary due to timing issues
      console.log('Waiting 15s for the agent to start processing...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      // Stream the agent's answer
      console.log('\nStarting event stream to receive agent response...');
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