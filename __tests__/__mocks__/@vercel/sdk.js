// Mock for @vercel/sdk to avoid ESM import issues in tests

class MockVercel {
  constructor(token) {
    this.token = token;
  }

  deployments = {
    list: jest.fn().mockResolvedValue({
      deployments: [
        {
          uid: 'mock-deployment-1',
          name: 'test-project',
          url: 'test-project.vercel.app',
          state: 'READY',
          created: Date.now() - 3600000, // 1 hour ago
        }
      ]
    }),
    get: jest.fn().mockResolvedValue({
      uid: 'mock-deployment-1',
      name: 'test-project',
      url: 'test-project.vercel.app',
      state: 'READY',
      created: Date.now() - 3600000,
    }),
    getEvents: jest.fn().mockResolvedValue([
      {
        type: 'stdout',
        payload: {
          text: 'Build completed successfully'
        }
      }
    ])
  };

  projects = {
    list: jest.fn().mockResolvedValue({
      projects: [
        {
          id: 'mock-project-1',
          name: 'test-project',
        }
      ]
    })
  };
}

module.exports = {
  Vercel: MockVercel,
  __esModule: true,
  default: MockVercel
};