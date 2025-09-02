import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { env } from '@/lib/env';
import { AgentProcessor } from '@/lib/agentProcessor';

// Test configuration
const API_BASE_URL = env.BASE_URL || 'http://localhost:3000';
const API_KEY = env.API_KEY;
const TEST_TIMEOUT = 60000; // 60 seconds

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface SubmitPromptResponse extends ApiResponse {
  data: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
  };
}

interface TraceResponse extends ApiResponse {
  data: {
    id: string;
    name: string;
    status: string;
    events: any[];
    duration?: number;
    createdAt: string;
    updatedAt: string;
  };
}

async function submitPrompt(prompt: string, name: string): Promise<SubmitPromptResponse> {
  const response = await fetch(`${API_BASE_URL}/api/traces`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      name,
      prompt,
      metadata: { testCase: true },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}

async function getTrace(traceId: string): Promise<TraceResponse> {
  const response = await fetch(`${API_BASE_URL}/api/traces/${traceId}`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}

async function waitForCompletion(traceId: string, timeoutMs: number = 30000): Promise<TraceResponse> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const trace = await getTrace(traceId);
    
    if (['completed', 'failed'].includes(trace.data.status)) {
      return trace;
    }
    
    console.log(`Trace ${traceId} status: ${trace.data.status}, waiting...`);
    
    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error(`Timeout waiting for trace completion after ${timeoutMs}ms`);
}

describe('Agent Integration Tests', () => {
  beforeAll(() => {
    if (!API_KEY) {
      throw new Error('API_KEY environment variable is required for tests');
    }
  });

  it('should submit a simple prompt and wait for completion', async () => {
    console.log('🚀 Starting prompt submission test...');
    
    // Submit prompt
    const submitResponse = await submitPrompt(
      'Hello, please respond with a simple greeting.',
      'Simple Greeting Test'
    );

    expect(submitResponse.success).toBe(true);
    expect(submitResponse.data.id).toBeDefined();
    expect(submitResponse.data.status).toBe('pending');
    expect(submitResponse.data.name).toBe('Simple Greeting Test');

    console.log(`✅ Prompt submitted successfully. Trace ID: ${submitResponse.data.id}`);

    // Wait for completion
    console.log('⏳ Waiting for agent processing to complete...');
    const completedTrace = await waitForCompletion(submitResponse.data.id, 45000);

    expect(completedTrace.success).toBe(true);
    expect(completedTrace.data.status).toBeOneOf(['completed', 'failed']);
    expect(completedTrace.data.events).toHaveLength(1);
    expect(completedTrace.data.events[0].agentType).toBe('coordinator');
    expect(completedTrace.data.duration).toBeGreaterThan(0);

    console.log(`✅ Trace completed with status: ${completedTrace.data.status}`);
    console.log(`📊 Processing time: ${completedTrace.data.duration}ms`);
    
    if (completedTrace.data.status === 'completed') {
      console.log(`🤖 Agent response: ${completedTrace.data.events[0].outcome.result}`);
    } else {
      console.log(`❌ Agent failed: ${completedTrace.data.events[0].outcome.error}`);
    }

  }, TEST_TIMEOUT);

  it('should handle a more complex prompt', async () => {
    console.log('🚀 Starting complex prompt test...');
    
    const complexPrompt = `Please analyze the following scenario: 
    A company wants to improve their customer satisfaction. 
    What are 3 key strategies they should consider?`;

    const submitResponse = await submitPrompt(
      complexPrompt,
      'Customer Satisfaction Analysis'
    );

    expect(submitResponse.success).toBe(true);
    console.log(`✅ Complex prompt submitted. Trace ID: ${submitResponse.data.id}`);

    const completedTrace = await waitForCompletion(submitResponse.data.id, 45000);

    expect(completedTrace.success).toBe(true);
    expect(completedTrace.data.status).toBeOneOf(['completed', 'failed']);
    expect(completedTrace.data.events).toHaveLength(1);

    console.log(`✅ Complex trace completed with status: ${completedTrace.data.status}`);
    console.log(`📊 Processing time: ${completedTrace.data.duration}ms`);

    if (completedTrace.data.status === 'completed') {
      const response = completedTrace.data.events[0].outcome.result;
      expect(response).toBeDefined();
      expect(response.length).toBeGreaterThan(50); // Expect a substantial response
      console.log(`🤖 Agent response preview: ${response.substring(0, 100)}...`);
    }

  }, TEST_TIMEOUT);

  it('should handle multiple concurrent prompts', async () => {
    console.log('🚀 Starting concurrent prompts test...');
    
    const prompts = [
      { name: 'Math Question 1', prompt: 'What is 15 + 27?' },
      { name: 'Math Question 2', prompt: 'What is 8 * 9?' },
      { name: 'Simple Question', prompt: 'What color is the sky?' },
    ];

    // Submit all prompts concurrently
    const submitPromises = prompts.map(p => submitPrompt(p.prompt, p.name));
    const submitResponses = await Promise.all(submitPromises);

    // Verify all submissions succeeded
    submitResponses.forEach((response, i) => {
      expect(response.success).toBe(true);
      expect(response.data.name).toBe(prompts[i].name);
      console.log(`✅ Submitted prompt ${i + 1}: ${response.data.id}`);
    });

    // Wait for all to complete
    const completionPromises = submitResponses.map(r => 
      waitForCompletion(r.data.id, 45000)
    );
    const completedTraces = await Promise.all(completionPromises);

    // Verify all completed
    completedTraces.forEach((trace, i) => {
      expect(trace.success).toBe(true);
      expect(['completed', 'failed']).toContain(trace.data.status);
      console.log(`✅ Trace ${i + 1} completed: ${trace.data.status} (${trace.data.duration}ms)`);
    });

    console.log('✅ All concurrent prompts processed successfully!');

  }, TEST_TIMEOUT * 2); // Double timeout for concurrent test
});

// Helper to extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}

expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    return {
      message: () => `expected ${received} to be one of ${expected.join(', ')}`,
      pass,
    };
  },
});