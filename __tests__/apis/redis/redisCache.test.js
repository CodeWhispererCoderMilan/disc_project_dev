const redis = require('redis');
const { 
    initializeRedis,
    CacheAddUser,
    CacheRemoveUser,
    CacheSetUserXP,
    CacheGetUserXP,
    closeRedisConnection
} = require('../../../apis/redis/redisCache');

jest.mock('../../../game_config.json', () => ({
    FesterCooldown: 1000,
    FesteringDuration: 1000,
    SwarmCooldown: 1000,
    HighWritTimeout: 1000,
    EminentWritTimeout: 1000,
    RoyalWritTimeout: 1000,
    ImperialWritTimeout: 1000,
    WritDeleteTimeout: 1000
}));

describe('Redis Cache Functions', () => {
    beforeAll(async () => {
        // Initialize Redis connection before running tests
        await initializeRedis();
    });

    afterAll(async () => {
        // Close Redis connection after all tests
        await closeRedisConnection();
    });

    describe('User XP Caching', () => {
        const testUserId = 'test-user-123';

        beforeEach(async () => {
            // Add a test user before each test
            await CacheAddUser(testUserId);
        });

        afterEach(async () => {
            // Remove the test user after each test
            await CacheRemoveUser(testUserId);
        });

        test('CacheAddUser should add a user with initial XP of 0', async () => {
            const xp = await CacheGetUserXP(testUserId);
            expect(xp).toBe('0');
        });

        test('CacheSetUserXP should set and retrieve user XP correctly', async () => {
            const xpToSet = 100;
            await CacheSetUserXP(testUserId, xpToSet);
            
            const retrievedXP = await CacheGetUserXP(testUserId);
            expect(parseInt(retrievedXP)).toBe(xpToSet);
        });

        test('CacheRemoveUser should remove the user from cache', async () => {
            await CacheRemoveUser(testUserId);
            
            await expect(CacheGetUserXP(testUserId)).rejects.toThrow();
        });
    });
});
