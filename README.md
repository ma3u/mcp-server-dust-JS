# MCP Server for Dust.tt

A Model Context Protocol (MCP) server implementation that integrates with Dust.tt, allowing Claude Desktop to communicate with Dust agents via the MCP protocol.

## Features

- MCP-compliant server with Server-Sent Events (SSE) support
- Full integration with Dust.tt API
- Support for streaming responses from Dust agents
- Methods for agent configuration management and execution

## Prerequisites

- Node.js 18+ installed
- Dust.tt API key (from your Dust.tt account)

## Setup Instructions

1. Clone this repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with your Dust.tt API key:

   ```env
   DUST_API_KEY=your_dust_api_key_here
   PORT=3000
   ```

## Running the Server

Start the server:

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

The server will be available at `http://localhost:3000/mcp`

## Available MCP Methods

The server implements the following MCP methods for Dust.tt integration:

- `getAgentConfigurations` - List all available Dust agent configurations
- `createAgentConfiguration` - Create a new Dust agent configuration
- `runAgent` - Execute a Dust agent with streaming response
- `getRunById` - Retrieve results of a specific agent run

## References

- [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Dust.tt JavaScript Client](https://www.npmjs.com/package/@dust-tt/client)
- [Claude Desktop](https://claude.ai/desktop)

## Using with Claude Desktop

Configure Claude Desktop to use this MCP server by pointing it to the `/mcp` endpoint of this server.
