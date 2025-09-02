import { Agent } from '@openai/agents';

const coordinator = new Agent({
  name: 'Coordinator',
  instructions: 'You are a helpful assistant',
});

export default coordinator;