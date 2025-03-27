/**
 * DUST MCP Client Test
 * This script tests sending a message to the DUST agent via the MCP server
 * and receiving the response via Server-Sent Events (SSE).
 */

const axios = require('axios');
const dotenv = require('dotenv');
const http = require('http');
const https = require('https');
const { URL } = require('url');

// Load environment variables
dotenv.config();

// Configuration
const config = {
  mcpHost: process.env.MCP_HOST || '127.0.0.1',
  mcpPort: process.env.MCP_PORT || 5001,
  agentId: process.env.DUST_AGENT_ID || '442875',
  testMessage: 'Hello! Please introduce yourself and explain what you can help me with.'
};

// Base URL for the MCP server
const baseUrl = `http://${config.mcpHost}:${config.mcpPort}`;

/**
 * Send a message to the DUST agent and stream the response
 */
async function testChatWithDustAgent() {
  console.log('=========================================');
  console.log('DUST MCP Client Test');
  console.log('=========================================');
  console.log(`MCP Server: ${baseUrl}`);
  console.log(`Agent ID: ${config.agentId}`);
  console.log(`Test message: "${config.testMessage}"`);
  console.log('=========================================');
  console.log('Connecting to MCP server...');
  
  try {
    // First, get the available models to verify connection
    const modelsResponse = await axios.post(`${baseUrl}/mcp`, {
      jsonrpc: '2.0',
      id: 1,
      method: 'getModels',
      params: {}
    });
    
    if (modelsResponse.data.error) {
      throw new Error(`Error getting models: ${modelsResponse.data.error.message}`);
    }
    
    console.log('Available models:');
    modelsResponse.data.result.forEach(model => {
      console.log(`- ${model.name} (${model.id}): ${model.description}`);
    });
    
    // Check if our agent is available
    const targetAgent = modelsResponse.data.result.find(
      model => String(model.id) === String(config.agentId)
    );
    
    if (!targetAgent) {
      throw new Error(`Agent with ID ${config.agentId} not found. Available agents: ${modelsResponse.data.result.map(m => m.id).join(', ')}`);
    }
    
    console.log('=========================================');
    console.log(`Sending test message to ${targetAgent.name}...`);
    
    // Prepare chat parameters
    const messages = [
      {
        role: 'user',
        content: config.testMessage
      }
    ];
    
    // Encode parameters for the URL
    const params = encodeURIComponent(JSON.stringify({
      messages,
      model: config.agentId
    }));
    
    // Set up the stream URL
    const url = `${baseUrl}/mcp/stream?method=chat&params=${params}`;
    console.log(`Connecting to stream: ${url.substring(0, 100)}...`);
    
    // Use the URL module to parse the URL
    const parsedUrl = new URL(url);
    let fullResponse = '';
    
    // Make a request with the appropriate headers for SSE
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    };

    // Use HTTP or HTTPS depending on the URL
    const requester = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = requester.request(options, (res) => {
      if (res.statusCode !== 200) {
        console.error(`Error: Status Code ${res.statusCode}`);
        console.error(res.statusMessage);
        return;
      }
      
      // Handle streaming response
      let buffer = '';
      
      res.on('data', (chunk) => {
        // Add the new chunk to our buffer
        buffer += chunk.toString();
        
        // Process any complete events in the buffer
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep the last incomplete chunk in the buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const eventData = line.slice(6); // Remove 'data: ' prefix
            try {
              const data = JSON.parse(eventData);
              console.log('Received event:', JSON.stringify(data).substring(0, 100) + '...');
              
              if (data.params && data.params.type === 'text') {
                // Received a text chunk
                fullResponse += data.params.text;
                process.stdout.write(data.params.text);
              } else if (data.params && data.params.type === 'done') {
                // Chat completed
                console.log('\n=========================================');
                console.log('Chat completed successfully!');
                console.log('Full response:');
                console.log(fullResponse);
                req.destroy(); // Close the connection
              } else if (data.params && data.params.type === 'error') {
                // Error occurred
                console.error('\nError:', data.params.error);
                req.destroy(); // Close the connection
              }
            } catch (error) {
              console.error('Error parsing event data:', error);
              console.error('Raw data:', eventData);
            }
          }
        }
      });
      
      res.on('error', (error) => {
        console.error('Error in response stream:', error);
      });
      
      res.on('end', () => {
        console.log('\nStream ended');
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
    });
    
    console.log('Waiting for response (this may take a few seconds)...');
    
    // Send the request
    req.end();
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testChatWithDustAgent();
