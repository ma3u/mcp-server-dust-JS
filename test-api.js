// Test file to check the available methods of the DustAPI class
const { DustAPI } = require('@dust-tt/client');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create a DustAPI instance
const dustClient = new DustAPI({
  apiKey: process.env.DUST_API_KEY,
  workspaceId: process.env.DUST_WORKSPACE_ID,
  baseUrl: process.env.DUST_DOMAIN || 'https://dust.tt'
});

// Log the available methods
console.log('DustAPI instance available methods:');
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(dustClient)));

// Try to use a few methods that we'd need
async function testAPI() {
  try {
    console.log('\nTesting available API methods...');
    
    // Check if we can get the workspace
    console.log('\nTrying to get workspace info...');
    try {
      const workspace = await dustClient.workspace();
      console.log('✅ Workspace info:', workspace);
    } catch (error) {
      console.error('❌ Error getting workspace:', error.message);
    }
    
    // Try to create a conversation
    console.log('\nTrying to create a conversation...');
    try {
      const conversation = await dustClient.createConversation({
        title: 'Test Conversation',
      });
      console.log('✅ Conversation created:', conversation);
      
      const conversationId = conversation.id;
      
      // Try to create a message
      console.log('\nTrying to create a message...');
      try {
        const message = await dustClient.createMessage({
          conversation_id: conversationId,
          content: 'Hello, Dust!',
          role: 'user'
        });
        console.log('✅ Message created:', message);
        
        // Try to create a run
        console.log('\nTrying to create a run...');
        try {
          const run = await dustClient.createRun({
            conversation_id: conversationId,
            stream: false
          });
          console.log('✅ Run created:', run);
        } catch (error) {
          console.error('❌ Error creating run:', error.message);
        }
      } catch (error) {
        console.error('❌ Error creating message:', error.message);
      }
    } catch (error) {
      console.error('❌ Error creating conversation:', error.message);
    }
  } catch (error) {
    console.error('Error testing API:', error.message);
  }
}

// Run the test
testAPI();
