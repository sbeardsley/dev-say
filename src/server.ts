#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';
import { z } from 'zod';

const execAsync = promisify(exec);

// Create Express application
const app = express();
app.use(express.json());

// Configure CORS for browser-based clients
app.use(cors({
  origin: '*',
  exposedHeaders: ['Mcp-Session-Id']
}));

// Store transports by session ID
const transports: Record<string, StreamableHTTPServerTransport> = {};

// Create MCP server
function createMCPServer() {
  const server = new McpServer(
    {
      name: 'macos-say',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register the speak tool
  server.tool(
    'speak',
    'Convert text to speech using macOS say command',
    {
      text: z.string().describe('The text to speak'),
      voice: z.string().optional().describe('The voice to use (optional). Run "say -v ?" to see available voices'),
      rate: z.number().optional().describe('Speech rate in words per minute (optional, default is 175)'),
      outputFile: z.string().optional().describe('Save audio to file instead of playing (optional)'),
    },
    async ({ text, voice, rate, outputFile }) => {
      if (platform() !== 'darwin') {
        throw new Error('This server only works on macOS');
      }

      try {
        let command = 'say';
        
        if (voice) {
          command += ` -v "${voice}"`;
        }
        
        if (rate) {
          command += ` -r ${rate}`;
        }
        
        if (outputFile) {
          command += ` -o "${outputFile}"`;
        }
        
        command += ` "${text.replace(/"/g, '\\"')}"`;

        await execAsync(command);

        return {
          content: [
            {
              type: 'text',
              text: outputFile 
                ? `Speech saved to ${outputFile}` 
                : 'Text spoken successfully',
            },
          ],
        };
      } catch (error) {
        throw new Error(`Error executing say command: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  return server;
}

// Main function
async function main() {
  const mode = process.env.MCP_TRANSPORT || 'http';
  const port = parseInt(process.env.PORT || '8837', 10);

  if (mode === 'stdio') {
    // Stdio mode for local Claude Code
    const server = createMCPServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('macOS Say MCP server running in stdio mode...');
  } else {
    // HTTP mode for devcontainer access
    
    // Handle all MCP requests on /mcp endpoint
    app.all('/mcp', async (req, res) => {
      console.error(`Received ${req.method} request to /mcp`);
      
      try {
        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'] as string;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
          // Reuse existing transport
          transport = transports[sessionId];
        } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
          // Create new transport and server for this session
          const server = createMCPServer();
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
            onsessioninitialized: (sessionId) => {
              console.error(`Session initialized with ID: ${sessionId}`);
              transports[sessionId] = transport;
            }
          });
          
          // Set up cleanup handler
          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && transports[sid]) {
              console.error(`Transport closed for session ${sid}`);
              delete transports[sid];
            }
          };
          
          // Connect server to transport
          await server.connect(transport);
        } else {
          // Invalid request
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided or not an initialization request',
            },
            id: null,
          });
          return;
        }

        // Handle the request with the transport
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('Error handling request:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : String(error),
          },
          id: null,
        });
      }
    });

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.json({ 
        status: 'ok', 
        transport: 'streamable-http',
        sessions: Object.keys(transports).length,
      });
    });

    // Start Express server
    app.listen(port, '0.0.0.0', () => {
      console.error(`MCP Streamable HTTP server listening on http://0.0.0.0:${port}`);
      console.error(`From devcontainer, connect to: http://host.docker.internal:${port}/mcp`);
    });
  }
}

// Run the server
main().catch(console.error);