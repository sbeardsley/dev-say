# macOS Say MCP Server

An MCP (Model Context Protocol) server that provides text-to-speech functionality using the macOS `say` command. This allows Claude Code running in a devcontainer to trigger speech synthesis on your Mac host.

## Features

- Convert text to speech using macOS native `say` command
- Choose from available system voices
- Adjust speech rate
- Save audio to file (AIFF format)
- Works seamlessly with Claude Code in devcontainers

## Prerequisites

- macOS (required - uses the native `say` command)
- Node.js 16+ 
- npm or yarn

## Installation

1. Clone this repository on your Mac host:
```bash
git clone <repository-url>
cd dev-say
```

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript code:
```bash
npm run build
```

## Usage

### Running the Server

The server supports two transport modes:

#### HTTP Mode (for Devcontainer/Remote Access)
```bash
# Default mode - runs HTTP server on port 8837
npm start

# Or explicitly set HTTP mode
MCP_TRANSPORT=http PORT=8837 npm start
```

#### Stdio Mode (Legacy)
```bash
MCP_TRANSPORT=stdio npm start
```

For development with hot reload:
```bash
npm run dev
```

### Configuration

#### For Claude Code in Devcontainer

1. **Start the server on your Mac host:**
```bash
cd /path/to/dev-say
npm install
npm run build
npm start  # Runs HTTP server on port 8837
```

2. **Configure Claude Code inside the devcontainer:**

Use the Claude Code CLI to add the MCP server:
```bash
claude mcp add --transport http dev-say http://host.docker.internal:8837/mcp
```

Alternatively, you can manually add to your MCP settings (typically `~/.config/claude/settings.json` in the container):

```json
{
  "mcpServers": {
    "dev-say": {
      "url": "http://host.docker.internal:8837/mcp",
      "transport": "http"
    }
  }
}
```

**Important:** The server uses the MCP Streamable HTTP transport which requires:
- Proper Accept headers (`application/json, text/event-stream`)
- Session management via `Mcp-Session-Id` header
- Initialize request to start a session

Claude Code should handle this automatically when configured with `"transport": "http"`.

The `host.docker.internal` hostname automatically resolves to your Mac host from within the Docker container.

#### For Local Claude Code on Mac

1. **Start the server on your Mac:**
```bash
cd /path/to/dev-say
npm install
npm run build
npm start  # Runs HTTP server on port 8837
```

2. **Configure Claude Code:**

Use the Claude Code CLI to add the MCP server:
```bash
claude mcp add --transport http dev-say http://localhost:8837/mcp
```

Alternatively, you can manually add to your Claude Code MCP settings (`~/Library/Application Support/Claude/claude_code_config.json`):

```json
{
  "mcpServers": {
    "dev-say": {
      "url": "http://localhost:8837/mcp",
      "transport": "http"
    }
  }
}
```

### Available Tools

The server exposes a single `speak` tool with the following parameters:

- **text** (required): The text to speak
- **voice** (optional): The voice to use (run `say -v ?` in terminal to see available voices)
- **rate** (optional): Speech rate in words per minute (default: 175)
- **outputFile** (optional): Path to save audio file instead of playing

### Example Usage in Claude Code

Once configured, you can use the speak tool in Claude Code:

```
Use the speak tool to say "Hello, world!"
```

With options:
```
Use the speak tool to say "Hello" with voice "Samantha" at rate 200
```

Save to file:
```
Use the speak tool to save "This is a test" to output.aiff
```

## Available Voices

To see all available voices on your system, run:
```bash
say -v ?
```

Popular voices include:
- Alex (US English)
- Samantha (US English) 
- Daniel (British English)
- Karen (Australian English)
- Tessa (South African English)

## Troubleshooting

### Devcontainer Connection Issues

#### Server not accessible from container
- Ensure the server is running on your Mac: `npm start`
- Check the server is listening on all interfaces: should show `0.0.0.0:8837`
- Test connectivity from container: `curl http://host.docker.internal:8837/health`
- Verify Docker Desktop settings allow host networking

#### MCP configuration not working
- Check Claude Code settings location in your container
- Verify the curl command can reach the server
- Look for error messages in Claude Code logs

### General Issues

#### Server not connecting
- Ensure the path in your MCP config is absolute and correct
- Check that the server builds successfully with `npm run build`
- Verify Node.js is in your PATH

#### No sound output
- Check your Mac's volume settings
- Ensure the `say` command works in terminal: `say "test"`
- Verify you're running on macOS (not Linux/Windows)

#### Voice not found
- Use `say -v ?` to list available voices
- Voice names are case-sensitive

### Testing the Server

#### Test HTTP endpoint directly:
```bash
# From your Mac
curl -X POST http://localhost:8837/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'

# From devcontainer
curl -X POST http://host.docker.internal:8837/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'
```

#### Test health endpoint:
```bash
curl http://localhost:8837/health
```

## Development

### Project Structure
```
dev-say/
├── src/
│   └── server.ts       # MCP server implementation
├── dist/               # Compiled JavaScript (generated)
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── README.md          # This file
```

### Building
```bash
npm run build
```

### Testing Locally
You can test the `say` command directly:
```bash
say "Hello, world!"
say -v Samantha "Hello"
say -r 300 "Fast speech"
say -o output.aiff "Save to file"
```

## License

MIT
