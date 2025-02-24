// __tests__/apis/firebase/firebaseDb.test.js

// Mock the firebase-admin module before requiring any modules that might use it
jest.mock('firebase-admin', () => {
  // Create a mock admin object
  const mockAdmin = {
    initializeApp: jest.fn(),
    credential: {
      cert: jest.fn().mockReturnValue({})
    },
    database: jest.fn().mockReturnValue({
      ref: jest.fn().mockReturnValue({})
    })
  };
  return mockAdmin;
});

// Mock dotenv since we need process.env variables
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

describe('Firebase Database Initialization', () => {
  // Save original env and restore after tests
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup mock environment variables
    process.env = { 
      ...originalEnv,
      FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
        "type": "service_account",
        "project_id": "test-project",
        "private_key_id": "test-key-id",
        "private_key": "test-key",
        "client_email": "test@example.com"
      }),
      FIREBASE_DATABASEURL: 'https://test-project.firebaseio.com'
    };
  });

  afterAll(() => {
    // Restore original env
    process.env = originalEnv;
  });

  test('initializes Firebase with correct credentials', () => {
    // This will trigger the initialization code
    const admin = require('firebase-admin');
    
    // Now import the module we want to test
    const { db } = require('../../../apis/firebase/firebaseDb');
    
    // Check that initializeApp was called with the right parameters
    expect(admin.initializeApp).toHaveBeenCalledWith({
      credential: expect.any(Object),
      databaseURL: 'https://test-project.firebaseio.com'
    });
    
    // Check that credential.cert was called with the parsed service account
    expect(admin.credential.cert).toHaveBeenCalledWith({
      "type": "service_account",
      "project_id": "test-project",
      "private_key_id": "test-key-id",
      "private_key": "test-key",
      "client_email": "test@example.com"
    });
    
    // Check that database was called
    expect(admin.database).toHaveBeenCalled();
    
    // Verify that db is defined
    expect(db).toBeDefined();
  });

  test('throws error when FIREBASE_SERVICE_ACCOUNT is not set', () => {
    // Remove the environment variable
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    
    // Reset modules to force re-initialization
    jest.resetModules();
    
    // Should throw an error when we try to import the module
    expect(() => {
      require('../../../apis/firebase/firebaseDb');
    }).toThrow("FIREBASE_SERVICE_ACCOUNT is not set in the environment");
  });
});
