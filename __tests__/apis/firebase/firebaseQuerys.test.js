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

// Mock the game_config.json
jest.mock('../../../game_config.json', () => ({
  roleXpThresholds: {
    'Poop': 370,
    'Maggot': 370,
    'Cockroach': 740,
    'Rat': 960,
    'Sub-human': 1050,
    'Peasant': 1350,
    'Scholar': 1600,
    'Merchant': 1850,
    'Knight': 2100,
    'Noble': 2400,
    'Lord': 2900,
    'King': 3500,
    'Emperor': 4000
  },
  FesteringDuration: 120000,
  XpBoostPoop: 40,
  XpBoostMaggot: 60,
  XpBoostCoockroach: 80,
  XpBoostRat: 100,
  XpBoostSubhuman: 120,
  XpBoostPeasant: 160,
  XpBoostScholar: 200,
  XpBoostMerchant: 240,
  XpBoostKnight: 300,
  XpBoostNoble: 360,
  XpBoostLord: 420,
  XpBoostKing: 500,
  XpBoostEmperor: 600
}));

// Mock the eventEmitter
jest.mock('../../../functions/eventEmitter', () => {
  // Create a mock event emitter with on and emit functions
  const eventHandlers = {};
  
  return {
    eventEmitter: {
      emit: jest.fn((event, ...args) => {
        const handlers = eventHandlers[event] || [];
        handlers.forEach(handler => handler(...args));
      }),
      on: jest.fn((event, handler) => {
        if (!eventHandlers[event]) {
          eventHandlers[event] = [];
        }
        eventHandlers[event].push(handler);
      })
    }
  };
});

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
const gameConfig = require('../../../game_config.json');

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
      expect(CacheAddUser).toHaveBeenCalledWith('user123', 'TestUser');
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
    
    // Helper: mock client that lets changeRole return early (member has 0 roles, not 1)
    function makeMockClient(userId) {
      const mockMember = {
        id: userId,
        displayName: 'TestUser',
        roles: {
          cache: { filter: jest.fn().mockReturnValue({ size: 0 }) },
        },
        guild: { roles: { cache: { find: jest.fn() } } },
      };
      const mockGuild = { members: { fetch: jest.fn().mockResolvedValue(mockMember) } };
      return { guilds: { fetch: jest.fn().mockResolvedValue(mockGuild) } };
    }

    // New test for XP threshold upgrade when role advancement is available
    test('upgrades user role when XP exceeds threshold and role upgrade is available', async () => {
      // Mock user data
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ XP: 350, role: 'Poop' }),
        exists: () => true
      });

      const userId = 'user123';
      const xpChange = 50; // This will take user above the Poop->Maggot threshold (370)
      const client = makeMockClient(userId);

      await DBUpdateXP(userId, xpChange, client);

      // XP should be set to (350 + 50 - 370) = 30 (remainder after upgrade)
      expect(_mockSet).toHaveBeenCalledWith(30);
      // The role-change path was triggered
      expect(client.guilds.fetch).toHaveBeenCalled();
    });

    // New test for XP threshold when role advancement is not yet reached
    test('does not upgrade user role when XP is below the next threshold', async () => {
      // Mock user data for Knight role — XP 2080 + 100 = 2180 which is below Noble threshold 2400
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ XP: 2080, role: 'Knight' }),
        exists: () => true
      });

      const userId = 'user123';
      const xpChange = 100;
      const client = {};

      await DBUpdateXP(userId, xpChange, client);

      // XP should just accumulate; no role upgrade path invoked
      expect(_mockSet).toHaveBeenCalledWith(2180);
    });

    // Test for XP accumulating right at threshold boundary
    test('accumulates XP correctly when just below the threshold', async () => {
      // 2399 + 0 = 2399 — just below Noble threshold 2400, no upgrade
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ XP: 2399, role: 'Knight' }),
        exists: () => true
      });

      const userId = 'user123';
      const client = {};

      await DBUpdateXP(userId, 0, client);

      expect(_mockSet).toHaveBeenCalledWith(2399);
    });

    // Test for multiple role upgrades when far exceeding thresholds
    test('handles multiple role upgrades if XP gain far exceeds thresholds', async () => {
      // Mock user data — 360 + 800 = 1160. Poop→Maggot at 370, Maggot→Cockroach at 740.
      // After Poop→Maggot: remainder = 1160 - 370 = 790
      // After Maggot→Cockroach: remainder = 790 - 740 = 50
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ XP: 360, role: 'Poop' }),
        exists: () => true
      });

      const userId = 'user123';
      const xpChange = 800;
      const client = makeMockClient(userId);

      await DBUpdateXP(userId, xpChange, client);

      // XP should be set to remainder after two upgrades
      expect(_mockSet).toHaveBeenCalledWith(50);
      // Role-change path was triggered
      expect(client.guilds.fetch).toHaveBeenCalled();
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
  
  describe('DBBoostXPForAllUsers', () => {
    test('applies role-specific XP boost amounts to users', async () => {
      // Mock users data with various roles
      _mockOnce.mockResolvedValueOnce({
        val: () => ({
          'user1': { XP: 100, role: 'Poop' },
          'user2': { XP: 200, role: 'Maggot' },
          'user3': { XP: 300, role: 'Peasant' },
          'user4': { XP: 400, role: 'Knight' },
          'user5': { XP: 500, role: 'Emperor' }
        })
      });
      
      // Mock individual user data for the XP updates
      // Need to mock 5 calls to DBUpdateXP which means 5 user fetches
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ XP: 100, role: 'Poop' }),
        exists: () => true
      });
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ XP: 200, role: 'Maggot' }),
        exists: () => true
      });
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ XP: 300, role: 'Peasant' }),
        exists: () => true
      });
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ XP: 400, role: 'Knight' }),
        exists: () => true
      });
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ XP: 500, role: 'Emperor' }),
        exists: () => true
      });
      
      const client = {};
      const boostCount = 1;
      
      await DBBoostXPForAllUsers(boostCount, client);
      
      // Should fetch users
      expect(db.ref).toHaveBeenCalledWith('users');
      
      // Should update each user with the correct role-specific boost amount
      expect(db.ref).toHaveBeenCalledWith('users/user1/XP');
      expect(_mockSet).toHaveBeenCalledWith(100 + gameConfig.XpBoostPoop);
      
      expect(db.ref).toHaveBeenCalledWith('users/user2/XP');
      expect(_mockSet).toHaveBeenCalledWith(200 + gameConfig.XpBoostMaggot);
      
      expect(db.ref).toHaveBeenCalledWith('users/user3/XP');
      expect(_mockSet).toHaveBeenCalledWith(300 + gameConfig.XpBoostPeasant);
      
      expect(db.ref).toHaveBeenCalledWith('users/user4/XP');
      expect(_mockSet).toHaveBeenCalledWith(400 + gameConfig.XpBoostKnight);
      
      expect(db.ref).toHaveBeenCalledWith('users/user5/XP');
      expect(_mockSet).toHaveBeenCalledWith(500 + gameConfig.XpBoostEmperor);
      
      // Should update the last boost time
      expect(db.ref).toHaveBeenCalledWith('LastXpBoost');
      expect(_mockSet).toHaveBeenCalledWith(expect.any(Number));
    });
    
    test('applies multiple XP boosts correctly when recovering from downtime', async () => {
      // Mock users data with various roles
      _mockOnce.mockResolvedValueOnce({
        val: () => ({
          'user1': { XP: 100, role: 'Poop' },
          'user2': { XP: 200, role: 'Knight' }
        })
      });
      
      // Mock individual user data for the XP updates
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ XP: 100, role: 'Poop' }),
        exists: () => true
      });
      _mockOnce.mockResolvedValueOnce({
        val: () => ({ XP: 200, role: 'Knight' }),
        exists: () => true
      });
      
      const client = {};
      const boostCount = 3; // Simulating 3 missed boosts
      
      await DBBoostXPForAllUsers(boostCount, client);
      
      // Should fetch users
      expect(db.ref).toHaveBeenCalledWith('users');
      
      // Should update each user with the correct role-specific boost amount multiplied by boostCount
      expect(db.ref).toHaveBeenCalledWith('users/user1/XP');
      expect(_mockSet).toHaveBeenCalledWith(100 + (gameConfig.XpBoostPoop * 3));
      
      expect(db.ref).toHaveBeenCalledWith('users/user2/XP');
      expect(_mockSet).toHaveBeenCalledWith(200 + (gameConfig.XpBoostKnight * 3));
      
      // Should update the last boost time
      expect(db.ref).toHaveBeenCalledWith('LastXpBoost');
      expect(_mockSet).toHaveBeenCalledWith(expect.any(Number));
    });
  });
});
