const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { DustAPI } = require('@dust-tt/client');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

// Set up logging
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logFile = path.join(logDir, `mcp-server-${new Date().toISOString().split('T')[0]}.log`);

// Create a logging utility
const logger = {
  info: (message) => {
    const logMessage = `[INFO] [${new Date().toISOString()}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(logFile, logMessage + '\n');
  },
  error: (message, error) => {
    const errorDetails = error ? `\n${error.stack || error.message || JSON.stringify(error)}` : '';
    const logMessage = `[ERROR] [${new Date().toISOString()}] ${message}${errorDetails}`;
    console.error(logMessage);
    fs.appendFileSync(logFile, logMessage + '\n');
  },
  warn: (message) => {
    const logMessage = `[WARN] [${new Date().toISOString()}] ${message}`;
    console.warn(logMessage);
    fs.appendFileSync(logFile, logMessage + '\n');
  },
  debug: (message, obj) => {
    const details = obj ? `\n${JSON.stringify(obj, null, 2)}` : '';
    const logMessage = `[DEBUG] [${new Date().toISOString()}] ${message}${details}`;
    console.log(logMessage);
    fs.appendFileSync(logFile, logMessage + '\n');
  }
};

// Server configuration
const config = {
  mcpName: process.env.MCP_NAME || 'Dust MCP Server JS',
  mcpHost: process.env.MCP_HOST || '127.0.0.1',
  mcpPort: parseInt(process.env.MCP_PORT || '5001', 10),
  timeout: parseInt(process.env.MCP_TIMEOUT || '30', 10),
  agentId: process.env.DUST_AGENT_ID || '442875',
  workspaceId: process.env.DUST_WORKSPACE_ID || '',
  apiKey: process.env.DUST_API_KEY || '',
  agentName: process.env.DUST_AGENT_NAME || 'SystemsThinking',
  baseUrl: process.env.DUST_DOMAIN || 'https://dust.tt',
  timezone: process.env.DUST_TIMEZONE || 'UTC',
  username: process.env.DUST_USERNAME || '',
  fullName: process.env.DUST_FULLNAME || ''
};

// Initialize Express app
const app = express();
app.use(express.json());
app.use(cors());

// Initialize Dust client with configuration from .env
// DustAPI constructor expects the API key as the first parameter
const dustClient = new DustAPI(
  config.apiKey,
  { 
    workspaceId: config.workspaceId,
    baseUrl: config.baseUrl
  }
);

// Also set up direct HTTP API access
const dustApi = axios.create({
  baseURL: config.baseUrl,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`
  }
});

logger.info('Starting MCP Server with Dust integration');
logger.info('MCP Server Configuration:');
logger.info(`- MCP Name: ${config.mcpName}`);
logger.info(`- MCP Host: ${config.mcpHost}`);
logger.info(`- MCP Port: ${config.mcpPort}`);
logger.info('\nDust Configuration:');
logger.info(`- API Key (masked): ****${config.apiKey.slice(-4)}`);
logger.info(`- Workspace ID: ${config.workspaceId}`);
logger.info(`- Agent ID: ${config.agentId}`);
logger.info(`- Agent Name: ${config.agentName}`);
logger.info(`- Base URL: ${config.baseUrl}`);

// Get Dust assistant information
async function getDustAssistant() {
  try {
    // Get agent configurations using the correct endpoint
    const response = await dustApi.get(`/api/v1/w/${config.workspaceId}/assistant/agent_configurations`);
    const agents = response.data.agentConfigurations || [];
    
    // Find our agent by ID (with proper type handling)
    const targetAgent = agents.find(agent => String(agent.id) === String(config.agentId));
    
    if (!targetAgent) {
      console.warn(`Agent with ID ${config.agentId} not found. Using default values.`);
      // Log available agents for reference
      if (agents.length > 0) {
        console.log('Available agents:', agents.map(a => `${a.name} (${a.id})`).join(', '));
      }
      
      // Return mock data if agent not found
      return {
        id: config.agentId,
        name: config.agentName,
        description: `Agent from the ${process.env.DUST_WORKSPACE_NAME || 'WorkwithAI_Launchpad'} workspace`,
        workspaceId: config.workspaceId
      };
    }
    
    return {
      id: targetAgent.id,
      name: targetAgent.name,
      description: targetAgent.description || `Agent from the ${process.env.DUST_WORKSPACE_NAME} workspace`,
      workspaceId: process.env.DUST_WORKSPACE_ID
    };
  } catch (error) {
    console.error('Error fetching Dust assistant information:', error);
    // Return mock data as fallback
    return {
      id: process.env.DUST_AGENT_ID,
      name: process.env.DUST_AGENT_NAME || 'SystemsThinking',
      description: `Agent from the ${process.env.DUST_WORKSPACE_NAME || 'WorkwithAI_Launchpad'} workspace`,
      workspaceId: process.env.DUST_WORKSPACE_ID
    };
  }
}

// Create a new Dust conversation
async function createDustConversation() {
  try {
    logger.info('Creating new Dust conversation');
    const response = await dustApi.post(`/api/v1/w/${config.workspaceId}/assistant/conversations`, {
      title: 'MCP Chat Session'
    });
    logger.debug('Conversation created', response.data);
    return response.data;
  } catch (error) {
    logger.error('Error creating conversation:', error);
    throw new Error(`Failed to create conversation: ${error.message}`);
  }
}

// Add a message to a Dust conversation
async function addDustMessage(conversationId, message) {
  try {
    logger.debug(`Adding message to conversation ${conversationId}:`, message);
    
    // The Dust API requires content, mentions, and context fields in the message format
    // Based on the API error response
    let payload;
    
    if (message.role === 'user') {
      payload = { 
        content: message.content,
        mentions: [],
        context: []
      };
    } else if (message.role === 'assistant') {
      // For assistant messages, use the same format
      payload = { 
        content: message.content,
        mentions: [],
        context: []
      };
    } else {
      // Default to user message format for any other role type
      logger.warn(`Unknown message role: ${message.role}, defaulting to user format`);
      payload = { 
        content: message.content,
        mentions: [],
        context: []
      };
    }
    
    logger.debug('Sending payload to Dust API:', payload);
    
    const response = await dustApi.post(
      `/api/v1/w/${config.workspaceId}/assistant/conversations/${conversationId}/messages`,
      payload
    );
    
    logger.debug('Message added successfully');
    return response.data;
  } catch (error) {
    logger.error(`Error posting message to conversation ${conversationId}:`, error);
    if (error.response && error.response.data) {
      logger.error('Dust API error response:', error.response.data);
    }
    throw new Error(`Failed to post message: ${error.message}`);
  }
}

// Create a new Dust run with streaming
async function createDustRun(messages) {
  // The last message is the user message
  const userMessage = messages[messages.length - 1];
  
  try {
    console.log('Creating conversation with Dust assistant');
    console.log('Assistant ID:', config.agentId);
    console.log('Workspace ID:', config.workspaceId);
    
    // Create a new conversation first
    const conversation = await createDustConversation();
    console.log(`Created conversation with ID: ${conversation.conversation.sId}`);
    const conversationId = conversation.conversation.sId;
    
    // Add context messages (all but the last one which is from the user)
    if (messages.length > 1) {
      for (let i = 0; i < messages.length - 1; i++) {
        const contextMessage = messages[i];
        await addDustMessage(conversationId, contextMessage);
        console.log(`Added context message ${i + 1}/${messages.length - 1}`);
      }
    }
    
    // Now add the user message and run the model
    console.log('Posting user message and running model...');
    
    // Add the user message
    const message = await addDustMessage(conversationId, userMessage);
    console.log('Message posted, creating run...');
    
    // Create and start a run to process the message
    try {
      const runResponse = await dustApi.post(
        `/api/v1/w/${config.workspaceId}/assistant/conversations/${conversationId}/runs`,
        {
          agentConfiguration: { sId: config.agentId },
          dataSources: []
        }
      );
      
      const runId = runResponse.data.run.sId;
      console.log(`Run created with ID: ${runId}`);
      
      return {
        conversationId: conversationId,
        runId: runId,
        message: userMessage
      };
    } catch (error) {
      console.error('Error creating run:', error.message);
      throw new Error(`Failed to create run: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in conversation flow:', error.message);
    throw error;
  }
}

// Create MCP endpoints for the server

// Endpoint for MCP server metadata
app.get('/mcp', (req, res) => {
  res.json({
    jsonrpc: '2.0',
    result: {
      name: process.env.MCP_NAME || 'Dust MCP Server JS',
      description: 'A Model Context Protocol server for Dust.tt',
      vendor: {
        name: process.env.DUST_FULLNAME || 'Dust User',
      },
      models: [
        {
          id: process.env.DUST_AGENT_ID,
          name: process.env.DUST_AGENT_NAME || 'SystemsThinking',
          description: `Agent from the ${process.env.DUST_WORKSPACE_NAME || 'WorkwithAI_Launchpad'} workspace`,
          capabilities: {
            chat: true,
            streaming: true,
          }
        }
      ],
      methods: ['chat', 'getModels']
    }
  });
});

// Stream the Dust assistant response
app.get('/mcp/stream', async (req, res) => {
  try {
    logger.info('========== RECEIVED SSE REQUEST ==========');
    logger.debug('Request query:', req.query);
    
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Helper function to send SSE data
    const sendEvent = (data) => {
      logger.debug('Sending SSE event:', data);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    
    // Parse the request query parameters
    const method = req.query.method;
    const params = JSON.parse(req.query.params || '{}');
    logger.info(`Parsed method: ${method}`);
    logger.debug('Parsed params:', params);
    
    if (method !== 'chat') {
      logger.warn(`Method ${method} not supported for streaming`);
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: `Method ${method} not supported`
        },
        id: null
      });
      return;
    }
    
    // Convert the messages to Dust format
    const { messages } = params;
    
    if (!messages || !Array.isArray(messages)) {
      logger.error('Invalid messages format:', messages);
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32602,
          message: 'Invalid params: messages must be an array'
        },
        id: null
      });
      return;
    }
    
    logger.info(`Chat request with ${messages.length} messages`);
    
    try {
      // Create a new run in Dust and start streaming the response
      const { conversationId, runId, message } = await createDustRun(messages);
      logger.info(`Created run with ID ${runId} for conversation ${conversationId}`);
      
      // Send the initial response event
      sendEvent({
        jsonrpc: '2.0',
        method: 'chat',
        params: {
          type: 'start',
          id: runId,
          conversationId: conversationId
        }
      });
      
      // Set up streaming of the run output
      const pollInterval = 1000; // 1 second
      const maxRetries = 60;     // 1 minute max
      let retries = 0;
      let contentSent = false;
      
      const checkRun = async () => {
        try {
          retries++;
          logger.debug(`Polling run status (attempt ${retries}/${maxRetries})...`);
          
          // Get the run status
          const runResponse = await dustApi.get(
            `/api/v1/w/${config.workspaceId}/assistant/conversations/${conversationId}/runs/${runId}`
          );
          
          const run = runResponse.data.run;
          const status = run.status;
          logger.debug(`Run status: ${status}`);
          
          // Handle different run statuses
          if (status === 'completed') {
            // If we haven't sent any content yet, get the message content
            if (!contentSent) {
              logger.info('Run completed, fetching assistant message...');
              // Get the last message (the assistant's response)
              const messagesResponse = await dustApi.get(
                `/api/v1/w/${config.workspaceId}/assistant/conversations/${conversationId}/messages`
              );
              
              const messages = messagesResponse.data.messages || [];
              const assistantMessages = messages.filter(m => m.role === 'assistant');
              
              if (assistantMessages.length > 0) {
                const lastMessage = assistantMessages[assistantMessages.length - 1];
                logger.info(`Assistant response: ${lastMessage.content.substring(0, 100)}...`);
                
                // Send the content
                sendEvent({
                  jsonrpc: '2.0',
                  method: 'chat',
                  params: {
                    type: 'content',
                    id: runId,
                    content: lastMessage.content,
                    role: 'assistant',
                    conversationId
                  }
                });
                
                contentSent = true;
              } else {
                logger.warn('No assistant messages found in the conversation');
              }
            }
            
            // Send completion event
            logger.info('Sending completion event');
            sendEvent({
              jsonrpc: '2.0',
              method: 'chat',
              params: {
                type: 'end',
                id: runId,
                conversationId
              }
            });
            
            // End the response
            res.end();
            return;
          } else if (status === 'in_progress' || status === 'pending') {
            // Continue polling
            if (retries < maxRetries) {
              setTimeout(checkRun, pollInterval);
            } else {
              // Max retries reached
              logger.error('Max polling retries reached, timing out');
              sendEvent({
                jsonrpc: '2.0',
                method: 'chat',
                params: {
                  type: 'error',
                  id: runId,
                  error: 'Request timed out',
                  conversationId
                }
              });
              res.end();
            }
          } else if (status === 'failed') {
            // Run failed
            logger.error('Run failed');
            sendEvent({
              jsonrpc: '2.0',
              method: 'chat',
              params: {
                type: 'error',
                id: runId,
                error: 'Run failed',
                conversationId
              }
            });
            res.end();
          }
        } catch (error) {
          logger.error('Error polling run status:', error);
          sendEvent({
            jsonrpc: '2.0',
            method: 'chat',
            params: {
              type: 'error',
              id: runId,
              error: `Error: ${error.message}`,
              conversationId
            }
          });
          res.end();
        }
      };
      
      // Start the polling
      setTimeout(checkRun, pollInterval);
      
    } catch (error) {
      logger.error('Error in chat request:', error);
      sendEvent({
        jsonrpc: '2.0',
        method: 'chat',
        params: {
          type: 'error',
          error: `Error: ${error.message}`
        }
      });
      res.end();
    }
    
  } catch (error) {
    logger.error('Error setting up stream:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: error.message || 'Internal server error'
      }
    });
  }
});

// Handle JSON-RPC requests
app.post('/mcp', async (req, res) => {
  try {
    const { id, method, params } = req.body;
    
    logger.info(`Received RPC request: ${method}`);
    logger.debug('Request params:', params);
    
    switch (method) {
      case 'getModels': {
        res.json({
          jsonrpc: '2.0',
          id,
          result: [
            {
              id: process.env.DUST_AGENT_ID,
              name: process.env.DUST_AGENT_NAME || 'SystemsThinking',
              description: `Agent from the ${process.env.DUST_WORKSPACE_NAME || 'WorkwithAI_Launchpad'} workspace`,
              capabilities: {
                chat: true,
                streaming: true,
              }
            }
          ]
        });
        break;
      }
      
      case 'chat': {
        // For non-streaming chat, this would handle the request
        // but we'll recommend using the streaming endpoint
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            message: 'Chat requests should use the streaming endpoint /mcp/stream'
          }
        });
        break;
      }
      
      default:
        res.status(400).json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method ${method} not supported`
          }
        });
    }
  } catch (error) {
    logger.error('Error processing request:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body.id,
      error: {
        code: -32000,
        message: error.message || 'Internal server error'
      }
    });
  }
});

// Serve a simple test page for the client
app.get('/', (req, res) => {
  const agentName = process.env.DUST_AGENT_NAME || 'SystemsThinking';
  const hostName = process.env.MCP_HOST || '127.0.0.1';
  const portNumber = process.env.MCP_PORT || '5001';
  const agentId = process.env.DUST_AGENT_ID || '';
  const workspaceName = process.env.DUST_WORKSPACE_NAME || '';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dust MCP Server JS</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; white-space: pre-wrap; }
        .success { color: green; }
        .error { color: red; }
        .info { color: blue; }
        button { padding: 8px 15px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #45a049; }
        textarea { width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ccc; }
        #debugInfo { margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <h1>Dust MCP Server</h1>
      <p>MCP server for the ${agentName} agent is running at <code>http://${hostName}:${portNumber}/mcp</code></p>
      
      <h2>Agent Information</h2>
      <ul>
        <li><strong>Agent Name:</strong> ${agentName}</li>
        <li><strong>Agent ID:</strong> ${agentId}</li>
        <li><strong>Workspace:</strong> ${workspaceName}</li>
      </ul>
      
      <h2>Test Chat</h2>
      <div>
        <textarea id="message" rows="3" placeholder="Enter your message here...">Tell me about systems thinking.</textarea><br>
        <button id="send">Send Message</button>
      </div>
      <h3>Response:</h3>
      <pre id="response"></pre>
      <div id="debugInfo"></div>
      
      <script>
        // Helper function to log both to console and UI
        function logDebug(message) {
          console.log(message);
          document.getElementById('debugInfo').innerHTML += '<div>' + message + '</div>';
        }

        document.getElementById('send').addEventListener('click', function() {
          var message = document.getElementById('message').value;
          var responseElem = document.getElementById('response');
          var debugInfo = document.getElementById('debugInfo');
          
          // Clear previous debug info
          debugInfo.innerHTML = '<h4>Debug Information:</h4>';
          responseElem.innerHTML = '<span class="info">Connecting to Dust agent...</span>';
          
          logDebug('Sending message: ' + message.substring(0, 30) + '...');
          
          try {
            var params = new URLSearchParams({
              method: 'chat',
              params: JSON.stringify({
                messages: [
                  { role: 'user', content: message }
                ]
              })
            });
            
            logDebug('Creating EventSource connection to /mcp/stream');
            var eventSourceUrl = '/mcp/stream?' + params.toString();
            logDebug('URL: ' + eventSourceUrl);
            
            var eventSource = new EventSource(eventSourceUrl);
            
            var fullResponse = '';
            
            // Handle connection open
            eventSource.onopen = function() {
              logDebug('EventSource connection opened');
              responseElem.innerHTML = '<span class="info">Connected, waiting for response...</span>';
            };
            
            // Handle messages
            eventSource.onmessage = function(event) {
              logDebug('Received event: ' + event.data.substring(0, 50) + '...');
              
              try {
                var data = JSON.parse(event.data);
                
                if (data.error) {
                  responseElem.innerHTML = '<span class="error">Error: ' + data.error.message + '</span>';
                  logDebug('Error received: ' + data.error.message);
                  eventSource.close();
                } else if (data.type === 'text') {
                  fullResponse += data.text;
                  responseElem.innerHTML = fullResponse;
                  logDebug('Added text to response, length now: ' + fullResponse.length);
                } else if (data.done) {
                  logDebug('Received done signal, closing connection');
                  eventSource.close();
                } else {
                  logDebug('Unrecognized event data: ' + JSON.stringify(data));
                }
              } catch (e) {
                logDebug('Error parsing event: ' + e + ', data: ' + event.data);
                responseElem.innerHTML += '\n<span class="error">Error parsing response: ' + e.message + '</span>';
              }
            };
            
            // Handle errors
            eventSource.onerror = function(err) {
              logDebug('EventSource error: ' + JSON.stringify(err));
              responseElem.innerHTML += '\n<span class="error">Connection error with Dust server</span>';
              eventSource.close();
            };
            
            // Close connection after timeout if no response
            setTimeout(function() {
              if (fullResponse === '') {
                logDebug('Timeout: No response received after 30 seconds');
                responseElem.innerHTML = '<span class="error">Timeout: No response received from Dust agent. Check server logs for more information.</span>';
                eventSource.close();
              }
            }, 30000); // 30 second timeout
            
          } catch (err) {
            logDebug('Error setting up request: ' + err.message);
            responseElem.innerHTML = '<span class="error">Error: ' + err.message + '</span>';
          }
        });
      </script>
    </body>
    </html>
  `;
  
  res.send(html);
});

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Function to validate the Dust API connection
async function validateDustAPIConnection() {
  console.log('Validating Dust API connection...');
  try {
    // Check API key by getting user information directly
    try {
      // Try to fetch the /me endpoint to validate basic API access
      const meResponse = await dustApi.get('/api/v1/me');
      if (meResponse.data && meResponse.data.workspaces) {
        const userInfo = meResponse.data;
        console.log('✅ Successfully connected to Dust API!');
        console.log(`User: ${userInfo.firstName} ${userInfo.lastName} (${userInfo.username})`);
        console.log(`Workspaces: ${userInfo.workspaces.length} available`);
      } else {
        console.warn('⚠️ Connected to Dust API but received unexpected response format');
      }
    } catch (meError) {
      console.warn(`⚠️ Could not fetch user info: ${meError.message}`);
      console.log('Trying alternate validation method...');
    }
    
    // Also validate by checking agent configurations
    try {
      const agentResponse = await dustApi.get(`/api/v1/w/${config.workspaceId}/assistant/agent_configurations`);
      const agents = agentResponse.data.agentConfigurations || [];
      console.log(`Found ${agents.length} agent configurations`);
      
      // Find our specific agent
      const targetAgent = agents.find(agent => String(agent.id) === String(config.agentId));
      
      if (targetAgent) {
        console.log('✅ Successfully verified agent configuration');
        console.log(`Found agent: ${targetAgent.name} (${targetAgent.id})`);
        return true;
      } else {
        console.warn(`⚠️ Warning: Agent with ID ${config.agentId} not found in workspace`);
        if (agents.length > 0) {
          console.log('Available agents:', agents.map(a => `${a.name} (${a.id})`).join(', '));
        }
      }
    } catch (agentError) {
      console.warn(`⚠️ Could not fetch agent configurations: ${agentError.message}`);
      throw agentError; // Rethrow to be caught by outer try/catch
    }
    
    // Test creating a conversation
    console.log('\nTesting conversation creation...');
    try {
      const conversation = await dustClient.createConversation({
        title: 'API Test Conversation'
      });
      console.log('✅ Successfully created a conversation. ID:', conversation.id);
    } catch (error) {
      console.log('❌ Failed to create a conversation:', error.message);
      return false;
    }
    
    // Check if assistant ID exists
    console.log('\nValidating Assistant ID...');
    console.log('Assistant ID:', process.env.DUST_AGENT_ID);
    
    try {
      // Get agent configurations to check if our agent ID exists
      const agents = await dustClient.getAgentConfigurations();
      console.log(`Found ${agents.length} agents in the workspace.`);
      
      // Check if our agent ID is in the list
      const agentExists = agents.some(agent => agent.id === process.env.DUST_AGENT_ID);
      
      if (agentExists) {
        console.log(`✅ Assistant ID ${process.env.DUST_AGENT_ID} exists in the workspace.`);
      } else {
        console.log(`❌ Assistant ID ${process.env.DUST_AGENT_ID} not found in the workspace!`);
        console.log('Available agents:', agents.map(a => `${a.name} (${a.id})`).join(', '));
      }
    } catch (error) {
      console.log('❌ Failed to get agent configurations:', error.message);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Dust API:');
    console.error('Error message:', error.message);
    
    // Safer error handling that doesn't assume response structure
    if (error.response) {
      try {
        console.error('Response status:', error.response.status);
        if (error.response.data) {
          console.error('Response data:', JSON.stringify(error.response.data));
        }
      } catch (e) {
        console.error('Error parsing response:', e.message);
      }
    }
    
    return false;
  }
}

// Start server
const PORT = process.env.MCP_PORT || 5001;
const HOST = process.env.MCP_HOST || '127.0.0.1';
const server = app.listen(PORT, HOST, async () => {
  console.log(`MCP Server with Dust.tt integration running at http://${HOST}:${PORT}/mcp`);
  console.log(`Web interface available at http://${HOST}:${PORT}/`);
  console.log(`Using Dust agent: ${process.env.DUST_AGENT_NAME} (${process.env.DUST_AGENT_ID})`);
  console.log(`Workspace: ${process.env.DUST_WORKSPACE_NAME}`);
  console.log(`User: ${process.env.DUST_FULLNAME} (${process.env.DUST_USERNAME})`);
  console.log(`Timezone: ${process.env.DUST_TIMEZONE}`);
  
  // Validate Dust API connection
  console.log('\n=============== API VALIDATION ===============');
  const isValid = await validateDustAPIConnection();
  console.log('===============================================\n');
  
  if (!isValid) {
    console.error('❌ WARNING: Dust API connection failed! The MCP server may not work properly.');
    console.error('Please check your .env file and ensure your API key, workspace ID, and agent ID are correct.');
  }
});
