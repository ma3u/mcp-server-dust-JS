const fetch = require('node-fetch');
const dotenv = require('dotenv');
const EventSource = require('eventsource');

// Load environment variables
dotenv.config();

// Base URL for our MCP server (using values from .env)
const HOST = process.env.MCP_HOST || '127.0.0.1';
const PORT = process.env.MCP_PORT || 5001;
const BASE_URL = `http://${HOST}:${PORT}/mcp`;

// Simple function to make MCP requests
async function makeMcpRequest(method, params = {}) {
  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now().toString(),
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error making MCP request to ${method}:`, error);
    throw error;
  }
}

// Function to handle streaming responses using EventSource
async function makeStreamingRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    try {
      const requestId = Date.now().toString();
      const queryParams = new URLSearchParams({
        jsonrpc: '2.0',
        id: requestId,
        method,
        params: JSON.stringify(params)
      }).toString();
      
      const eventSource = new EventSource(`${BASE_URL}?${queryParams}`);
      console.log('Connecting to SSE stream...');
      
      let responseText = '';
      
      eventSource.onopen = () => {
        console.log('Stream connection opened');
      };
      
      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        reject(error);
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.error) {
            console.error('Error from server:', data.error);
            eventSource.close();
            reject(new Error(data.error.message || 'Unknown error'));
            return;
          }
          
          if (data.type === 'text') {
            process.stdout.write(data.text);
            responseText += data.text;
          } else if (data.done) {
            console.log('\n\nStream completed');
            eventSource.close();
            resolve(responseText);
          }
        } catch (error) {
          console.error('Error parsing event data:', error, event.data);
        }
      };
      
      // Set a timeout to close the connection if it takes too long
      const timeout = setTimeout(() => {
        console.log('\n\nStream timed out after 60 seconds');
        eventSource.close();
        resolve(responseText);
      }, 60000);
      
      // Clean up timeout when the stream is done
      eventSource.addEventListener('done', () => {
        clearTimeout(timeout);
      });
    } catch (error) {
      console.error(`Error making streaming request to ${method}:`, error);
      reject(error);
    }
  });
}

// Example usage
async function main() {
  try {
    console.log(`Connecting to MCP server at ${BASE_URL}`);
    console.log(`Using Dust agent: ${process.env.DUST_AGENT_NAME} (${process.env.DUST_AGENT_ID})`);
    
    // Chat with the Dust agent using streaming
    console.log('\nStarting chat with Dust agent...');
    
    await makeStreamingRequest('chat', {
      messages: [
        { role: 'user', content: 'Tell me about systems thinking and its applications.' }
      ]
    });
    
  } catch (error) {
    console.error('Error in main:', error);
  }
}

// Run the examples
main();
