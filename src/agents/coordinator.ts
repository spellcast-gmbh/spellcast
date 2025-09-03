import { Agent, webSearchTool } from '@openai/agents';
import { linearHandoff } from './linear-agent';
import { hostingHandoff } from './hosting-agent';
import { AgentTracing } from './util';
import { RECOMMENDED_PROMPT_PREFIX } from '@openai/agents-core/extensions';
import { env } from '../lib/env';

export const coordinator: AgentTracing = (t) => {
  // Build handoffs array based on available API keys
  const handoffs = [];
  
  if (env.LINEAR_API_KEY) {
    handoffs.push(linearHandoff(t));
  }
  
  if (env.VERCEL_API_KEY) {
    handoffs.push(hostingHandoff(t));
  }

  // Build capabilities description based on available services
  const availableServices = [];
  if (env.LINEAR_API_KEY) {
    availableServices.push('- Linear issue management (create, search, update issues and comments)');
  }
  if (env.VERCEL_API_KEY) {
    availableServices.push('- Vercel deployment monitoring (list deployments, check status, view logs, manage projects)');
  }

  const servicesText = availableServices.length > 0 
    ? `\n\nAvailable specialized services:\n${availableServices.join('\n')}`
    : '\n\nNo specialized services are currently configured. Ensure API keys are set for Linear and/or Vercel integration.';

  return new Agent({
    name: 'Coordinator',
    instructions: `${RECOMMENDED_PROMPT_PREFIX}
    You are a helpful coordinator agent that manages conversations and delegates tasks to specialized agents.
      
      Your primary role is to:
      - Understand user requests and determine the best agent to handle them
      - Provide general assistance for non-specialized tasks
      - Delegate to specialized agents when their services are needed${servicesText}
      
      Be helpful and decide quickly whether a task should be handled by you or delegated.`,
    handoffs,
    tools: [webSearchTool()]  
  });
};

export default coordinator;