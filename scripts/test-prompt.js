#!/usr/bin/env node

/**
 * Simple test script for prompt submission and completion waiting
 * Usage: node scripts/test-prompt.js [prompt] [name]
 */

const API_BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error('❌ ERROR: API_KEY environment variable is required');
  console.error('Set it in your .env.local file or export it: export API_KEY=your-key');
  process.exit(1);
}

// Default test values
const defaultPrompt = process.argv[2] || 'Hello! Please respond with a friendly greeting and tell me what you can help with.';
const defaultName = process.argv[3] || 'Test Prompt';

async function submitPrompt(prompt, name) {
  console.log('🚀 Submitting prompt to API...');
  console.log(`📝 Name: "${name}"`);
  console.log(`💬 Prompt: "${prompt}"`);
  console.log('');

  try {
    const response = await fetch(`${API_BASE_URL}/api/traces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        name,
        prompt,
        metadata: { 
          testScript: true, 
          timestamp: new Date().toISOString() 
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`API Error: ${result.error}`);
    }

    console.log('✅ Prompt submitted successfully!');
    console.log(`🆔 Trace ID: ${result.data.id}`);
    console.log(`📊 Status: ${result.data.status}`);
    console.log(`🕐 Created: ${result.data.createdAt}`);
    console.log('');

    return result.data.id;

  } catch (error) {
    console.error('❌ Failed to submit prompt:', error.message);
    process.exit(1);
  }
}

async function getTrace(traceId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/traces/${traceId}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`API Error: ${result.error}`);
    }

    return result.data;

  } catch (error) {
    console.error('❌ Failed to get trace:', error.message);
    throw error;
  }
}

async function waitForCompletion(traceId, timeoutMs = 60000) {
  console.log('⏳ Waiting for processing to complete...');
  console.log(`⏱️  Timeout: ${timeoutMs / 1000} seconds`);
  console.log('');

  const startTime = Date.now();
  let lastStatus = '';
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const trace = await getTrace(traceId);
      
      if (trace.status !== lastStatus) {
        console.log(`📊 Status update: ${trace.status}`);
        lastStatus = trace.status;
      }
      
      if (['completed', 'failed'].includes(trace.status)) {
        console.log('');
        console.log('🎉 Processing completed!');
        console.log(`📊 Final Status: ${trace.status}`);
        console.log(`⏱️  Total Duration: ${trace.duration || 0}ms`);
        console.log(`📅 Updated: ${trace.updatedAt}`);
        
        if (trace.events && trace.events.length > 0) {
          console.log('');
          console.log('📋 Events:');
          trace.events.forEach((event, i) => {
            console.log(`  ${i + 1}. ${event.agentType} - ${event.outcome.success ? '✅ Success' : '❌ Failed'}`);
            if (event.duration) {
              console.log(`     Duration: ${event.duration}ms`);
            }
          });

          // Show the coordinator's response
          const coordinatorEvent = trace.events.find(e => e.agentType === 'coordinator');
          if (coordinatorEvent) {
            console.log('');
            console.log('🤖 Coordinator Response:');
            console.log('─'.repeat(50));
            if (coordinatorEvent.outcome.success) {
              console.log(coordinatorEvent.outcome.result);
            } else {
              console.log(`❌ Error: ${coordinatorEvent.outcome.error}`);
            }
            console.log('─'.repeat(50));
          }
        }
        
        return trace;
      }
      
      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error('⚠️ Error checking trace status:', error.message);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('');
  console.log('⏰ Timeout reached - processing may still be ongoing');
  console.log(`🔗 Check manually: ${API_BASE_URL}/api/traces/${traceId}`);
  
  // Return the last known status
  try {
    return await getTrace(traceId);
  } catch (error) {
    console.error('❌ Failed to get final trace status:', error.message);
    process.exit(1);
  }
}

async function main() {
  console.log('🧪 Agent Processing Test Script');
  console.log('━'.repeat(50));
  console.log(`🌐 API URL: ${API_BASE_URL}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 8)}...`);
  console.log('');

  const traceId = await submitPrompt(defaultPrompt, defaultName);
  await waitForCompletion(traceId);
  
  console.log('');
  console.log('✨ Test completed!');
  console.log(`🔗 View trace: ${API_BASE_URL}/api/traces/${traceId}`);
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('');
  console.log('👋 Test interrupted by user');
  process.exit(0);
});

// Run the test
main().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});