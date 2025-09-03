# Agentic Spellcast Framework

A multi-agent framework built with OpenAI Agents that orchestrates specialized AI agents for project management and deployment monitoring. Designed to be integrated with custom GPTs for seamless workflow automation.

## Overview

This is an agentic framework that provides intelligent task delegation through specialized agents:

- **🤖 Coordinator Agent**: Main orchestrator that routes tasks to specialized agents
- **📋 Linear Agent**: Manages Linear issues, comments, and project workflows
- **🚀 Hosting Agent**: Monitors Vercel deployments, logs, and infrastructure

## Quick Start

### 1. Environment Setup

```bash
# Clone and install
git clone <repository-url>
cd spellcast
npm install

# Configure environment
cp .env.example .env.local
```

### 2. Configure API Keys

Add your API keys to `.env.local`:

```env
# Required
API_KEY=your_secure_api_key_here, used as a simple bearer
OPENAI_API_KEY=your_openai_api_key_here

# Optional (agents only activate if keys are present)
LINEAR_API_KEY=your_linear_api_key_here    # For Linear integration
VERCEL_API_KEY=your_vercel_api_key_here    # For Vercel monitoring

# Firebase (for trace storage)
FIREBASE_SERVICE_ACCOUNT={"type": "service_account", ...}
FIREBASE_PROJECT_ID=your_project_id
```

### 3. Run the Server

```bash
npm run dev
# Server runs on http://localhost:3000
```

## Custom GPT Integration

### Suggested System Prompt

```
You are an AI assistant that helps users manage their development workflow using the Agentic Spellcast Framework. This system provides specialized agents for Linear project management and Vercel deployment monitoring.

**Available Capabilities:**
- **Linear Integration**: Create, search, update issues and comments across teams and projects
- **Vercel Monitoring**: Monitor deployments, check status, analyze logs, and manage projects  
- **Smart Routing**: Automatically delegate tasks to the appropriate specialized agent

**Base API URL:** https://your-spellcast-domain.com
**Authentication:** Use the provided API key in the Authorization header

**Usage Guidelines:**
1. Always check which services are available before suggesting actions
2. For Linear tasks (issues, bugs, tickets): Use the Linear agent
3. For deployment monitoring (Vercel, hosting, logs): Use the Hosting agent  
4. For general queries or multi-step workflows: Use the Coordinator agent
5. Provide clear, structured responses with next steps when appropriate

**API Usage:**
- POST /api/traces - Create new agent trace with task description
- GET /api/traces - List all traces and their status
- GET /api/traces/{id} - Get detailed trace results and events

Always provide helpful context about what actions will be taken and suggest relevant follow-up tasks.

```

## Available Agents

### Coordinator Agent
**Purpose**: Main orchestrator that routes requests to specialized agents  
**Capabilities**: 
- Intelligent task routing
- Multi-agent workflow coordination
- General assistance and web search

### Linear Agent  
**Purpose**: Linear issue and project management  
**Capabilities**:
- Create, search, and update issues
- Manage comments and discussions
- Handle team, user, and project resolution
- Issue state and priority management

**Tools Available**:
- `create_issue` - Create new Linear issues
- `search_issues` - Search issues by various criteria  
- `get_issue` - Get detailed issue information
- `update_issue` - Update existing issues
- `get_issue_comments` - Retrieve issue comments
- `add_comment` - Add comments to issues

### Hosting Agent
**Purpose**: Vercel deployment monitoring and management  
**Capabilities**:
- Monitor deployment status and health
- Analyze build and runtime logs
- Track deployment history
- Project management

**Tools Available**:
- `get_deployments` - List deployments with status
- `get_deployment_status` - Get detailed deployment info
- `get_deployment_logs` - Retrieve build/runtime logs  
- `get_projects` - List all Vercel projects

## API Reference

Just check the swagger ui at `/api/docs/ui`

## Adding New Agents

To extend the framework with additional agents:

### 1. Create Agent Implementation

Create a new agent file in `src/agents/`:

```typescript
// src/agents/my-agent.ts
import { Agent, tool } from '@openai/agents';
import { AgentTracing, ToolTracing } from './util';

const myTool: ToolTracing = (t) => tool({
  name: 'my_tool',
  description: 'Description of what this tool does',
  parameters: z.object({
    param: z.string().describe('Parameter description')
  }),
  async execute({ param }) {
    // Tool implementation
    return { result: 'success' };
  }
});

export const myAgent: AgentTracing = (t) => new Agent({
  name: 'My Agent',
  instructions: 'Agent instructions here',
  tools: [myTool(t)]
});
```

### 2. Update Type Schemas

Add your agent to the schema in `src/models/agenticTraceSchemas.ts`:

```typescript
export const AgentTypeSchema = z.enum([
  'coordinator',
  'linear', 
  'hosting',
  'my-agent', // Add your agent here
]);
```

### 3. Update Swagger Documentation

Add your agent's tools to the `AgentType` schema in `public/swagger.json` to document the API capabilities.

### 4. Add to Coordinator

Update `src/agents/coordinator.ts` to include handoff to your agent:

```typescript
import { myAgentHandoff } from './my-agent';

// Add conditional handoff based on required API keys
if (env.MY_SERVICE_API_KEY) {
  handoffs.push(myAgentHandoff(t));
}
```

### 5. Resources

- **OpenAI Agents Documentation**: https://openai.github.io/openai-agents-js/
- **Agent Patterns**: See existing agents in `src/agents/` for implementation examples
- **Tool Creation**: Follow the pattern in existing tools for consistent error handling and tracing

## Development

### Project Structure

```
src/
├── agents/           # Agent implementations
│   ├── coordinator.ts    # Main orchestrator
│   ├── linear-agent.ts   # Linear integration  
│   ├── hosting-agent.ts  # Vercel monitoring
│   └── util.ts          # Agent utilities
├── app/api/         # REST API endpoints
├── lib/             # Utilities and services
├── models/          # TypeScript schemas
└── __tests__/       # Test suites
```

### Testing

```bash
npm test                    # Run all tests
npm test hosting-agent     # Run specific agent tests
```

### Building

```bash
npm run build              # Production build
npm run dev               # Development server
```

## Security

- API key authentication on all endpoints
- Environment variable protection
- Input validation with Zod schemas
- No API keys exposed in logs or responses
- Secure agent-to-service communication

## License

[Your License Here]
