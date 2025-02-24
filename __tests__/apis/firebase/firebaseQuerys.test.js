// __tests__/apis/firebase/querys.test.js

// Mock the firebaseDb module
jest.mock('../../../apis/firebase/firebaseDb', () => {
  // Create mock ref functions
  const mockOnce = jest.fn();
  const mockSet = jest.fn().mockResolvedValue();
  const mockRemove = jest.fn().mockResolvedValue();
  
  // Create a mock ref function that returns different methods
  const mockRef = jest.fn().mockImplementation(() => ({
    once: mockOnce,
    set: mockSet,
    remove: mockRemove
  }));
  
  return {
    db: {
      ref: mockRef
    },
    // Expose the mock functions for test assertions
    _mockOnce: mockOnce,
    _mockSet: mockSet,
    _mockRemove: mockRemove
  };
});

// Mock the redisCache module
jest.mock('../../../apis/redis/redisCache', () => ({
  CacheAddUser: jest.fn().mockResolvedValue(),
  CacheRemoveUser: jest.fn().mockResolvedValue(),
  CacheSetUserXP: jest.fn().mockResolvedValue(),
  CacheIsPoopBeingFestered: jest.fn().mockResolvedValue(false),
  CacheGetFesteringTarget: jest.fn().mockResolvedValue(null),
  CacheSetFestering: jest.fn().mockResolvedValue(),
  CacheClearFestering: jest.fn().mockResolvedValue(),
  CacheGetEndows: jest.fn().mockResolvedValue([])
}));

// Mock the eventEmitter
jest.mock('../../../functions/eventEmitter', () => ({
  eventEmitter: {
    emit: jest.fn(),
    on: jest.fn()
  }
}));

// Import the modules we're testing
const { 
  DBAddUser, 
  DBRemoveUser, 
  DBUpdateXP,
  DBSetRole,
  DBResetXP,
  DBSetFestering,
  DBClearFestering,
  DBGetFestering,
  DBGetActiveFestering,
  DBGetLastXPBoostTime,
  DBSetLastXPBoostTime,
  DBBoostXPForAllUsers
} = require('../../../apis/firebase/querys');

// Import mocked dependencies for assertions
const { db, _mockOnce, _mockSet, _mockRemove } = require('../../../apis/firebase/firebaseDb');
const { 
  CacheAddUser, 
  CacheRemoveUser, 
  CacheSetUserXP,
  CacheIsPoopBeingFestered,
  CacheSetFestering,
  CacheClearFestering,
  CacheGetEndows
} = require('../../../apis/redis/redisCache');
const { eventEmitter } = require('../../../functions/eventEmitter');

describe('Firebase Query Functions', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('DBAddUser', () => {
    test('adds user to database and cache', async () => {
      const member = { id: 'user123', displayName: 'TestUser' };
      
      await DBAddUser(member);
      
      // Check database calls
      expect(db.ref).toHaveBeenCalledWith('users/user123');
      expect(_mockSet).toHaveBeenCalledWith({
        username: 'TestUser',
        XP: 0,
        role: 'Poop'
      });
      
      // Check cache calls
      expect(CacheAddUser).toHaveBeenCalledWith('user123');
    });
  });

  describe('DBRemoveUser', () => {
    test('removes user from database and cache', async () => {
      const member = { id: 'user123', displayName: 'TestUser' };
      
      await DBRemoveUser(member);
      
      // Check database calls
      expect(db.ref).toHaveBeenCalledWith('users/user123');
      expect(_mockRemove).toHaveBeenCalled();
      
      // Check cache calls
      expect(CacheRemoveUser).toHaveBeenCalledWith('user123');
    });
  });

  describe('DBUpdateXP', () => {
    test('updates user XP in database and cache', async () => {
      // Mock user data response
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ XP: 100, role: 'Poop' }),
        exists: () => true
      });
      
      const userId = 'user123';
      const xpChange = 50;
      const client = {};
      
      await DBUpdateXP(userId, xpChange, client);
      
      // Check that we fetched the user
      expect(db.ref).toHaveBeenCalledWith('users/user123');
      
      // Check that XP was updated
      expect(_mockSet).toHaveBeenCalledWith(150);
      
      // Check cache was updated
      expect(CacheSetUserXP).toHaveBeenCalledWith('user123', 150);
    });

    test('handles user with no XP', async () => {
      // Mock user data with no XP
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ role: 'Poop' }), // No XP field
        exists: () => true
      });
      
      const userId = 'user123';
      const xpChange = 50;
      const client = {};
      
      await DBUpdateXP(userId, xpChange, client);
      
      // Should treat missing XP as 0
      expect(_mockSet).toHaveBeenCalledWith(50);
    });

    test('handles negative XP changes', async () => {
      // Mock user data
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ XP: 100, role: 'Poop' }),
        exists: () => true
      });
      
      const userId = 'user123';
      const xpChange = -30;
      const client = {};
      
      await DBUpdateXP(userId, xpChange, client);
      
      // Should subtract XP
      expect(_mockSet).toHaveBeenCalledWith(70);
    });

    test('rejects if user does not have enough XP for negative change', async () => {
      // Mock user data
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ XP: 20, role: 'Poop' }),
        exists: () => true
      });
      
      const userId = 'user123';
      const xpChange = -30; // More than user has
      const client = {};
      
      await expect(DBUpdateXP(userId, xpChange, client))
        .rejects
        .toThrow('User with id user123 does not have enough XP for xp change');
      
      // Should not update database
      expect(_mockSet).not.toHaveBeenCalled();
    });

    test('handles festered poop XP sharing', async () => {
      // Mock user data
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ XP: 100, role: 'Poop' }),
        exists: () => true
      });
      
      // Mock festering relationship
      CacheIsPoopBeingFestered.mockResolvedValueOnce('maggot123');
      
      // Mock second user fetch (for maggot)
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ XP: 200, role: 'Maggot' }),
        exists: () => true
      });
      
      const userId = 'user123';
      const xpChange = 50;
      const client = {};
      
      await DBUpdateXP(userId, xpChange, client);
      
      // Poop should get half the XP
      expect(_mockSet).toHaveBeenCalledWith(125);
      
      // Check that maggot was updated with half the XP
      expect(db.ref).toHaveBeenCalledWith('users/maggot123');
      expect(_mockSet).toHaveBeenCalledWith(225);
    });

    test('handles endowed user XP boost and sharing', async () => {
      // Mock user data
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ XP: 100, role: 'Peasant' }),
        exists: () => true
      });
      
      // Mock endow relationship
      CacheGetEndows.mockResolvedValueOnce(['merchant123']);
      
      // Mock merchant user fetch
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ XP: 500, role: 'Merchant' }),
        exists: () => true
      });
      
      const userId = 'user123';
      const xpChange = 100;
      const client = {};
      
      await DBUpdateXP(userId, xpChange, client);
      
      // User should get 1.5x XP (original + 0.5x per merchant)
      expect(_mockSet).toHaveBeenCalledWith(250);
      
      // Merchant should get half of original XP
      expect(db.ref).toHaveBeenCalledWith('users/merchant123');
      expect(_mockSet).toHaveBeenCalledWith(550);
    });
  });

  describe('DBSetRole', () => {
    test('updates user role in database', async () => {
      const member = { id: 'user123', displayName: 'TestUser' };
      const newRole = 'Maggot';
      
      await DBSetRole(member, newRole);
      
      // Check database calls
      expect(db.ref).toHaveBeenCalledWith('users/user123/role');
      expect(_mockSet).toHaveBeenCalledWith('Maggot');
    });
  });

  describe('DBSetFestering and DBClearFestering', () => {
    test('sets festering relationship in database and cache', async () => {
      const maggotId = 'maggot123';
      const poopId = 'poop123';
      
      await DBSetFestering(maggotId, poopId);
      
      // Check database calls
      expect(db.ref).toHaveBeenCalledWith('festering/maggot123');
      expect(_mockSet).toHaveBeenCalledWith(expect.objectContaining({
        poopId: 'poop123',
        startTime: expect.any(Number),
        endTime: expect.any(Number)
      }));
      
      // Check cache calls
      expect(CacheSetFestering).toHaveBeenCalledWith(maggotId, poopId, expect.any(Number));
    });

    test('clears festering relationship from database and cache', async () => {
      const maggotId = 'maggot123';
      
      await DBClearFestering(maggotId);
      
      // Check database calls
      expect(db.ref).toHaveBeenCalledWith('festering/maggot123');
      expect(_mockRemove).toHaveBeenCalled();
      
      // Check cache calls
      expect(CacheClearFestering).toHaveBeenCalledWith(maggotId);
      
      // Should emit event
      expect(eventEmitter.emit).toHaveBeenCalledWith('festeringStatusChanged');
    });
  });

  describe('DBGetLastXPBoostTime and DBSetLastXPBoostTime', () => {
    test('gets last XP boost time from database', async () => {
      const timestamp = Date.now();
      _mockOnce.mockResolvedValueOnce({
        val: () => timestamp
      });
      
      const result = await DBGetLastXPBoostTime();
      
      // Check database calls
      expect(db.ref).toHaveBeenCalledWith('LastXpBoost');
      expect(result).toBe(timestamp);
    });

    test('sets last XP boost time in database', async () => {
      const timestamp = Date.now();
      
      await DBSetLastXPBoostTime(timestamp);
      
      // Check database calls
      expect(db.ref).toHaveBeenCalledWith('LastXpBoost');
      expect(_mockSet).toHaveBeenCalledWith(timestamp);
    });
  });
});
