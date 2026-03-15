const redis = require('redis');
const { 
    initializeRedis,
    CacheAddUser,
    CacheRemoveUser,
    CacheSetUserXP,
    CacheGetUserXP,
    CacheSetFestering,
    CacheClearFestering,
    CacheGetFesteringTarget,
    CacheIsPoopBeingFestered,
    CacheSetFesterCooldown,
    CacheGetFesterCooldown,
    CacheClearFesterCooldown,
    CacheSetCooldown,
    CacheGetCooldown,
    CacheClearCooldown,
    CacheSetSwarmCooldown,
    CacheGetSwarmCooldown,
    CacheClearSwarmCooldown,
    CacheSetEndow,
    CacheClearEndow,
    CacheGetEndows,
    CacheCheckEndowExists,
    CacheClearMerchantEndows,
    CacheClearTargetEndows,
    CacheGetMerchantEndows,
    closeRedisConnection,
	CacheSetWrit,
	CacheCheckAndUpdateUserWrits,
	CacheDeleteWrit,
	CacheGetKnightWrits,
	CacheGetWriterWrits,
	CacheCheckActiveWrit,
	CacheUpdateWritStatus
} = require('../../../apis/redis/redisCache');

// Mock configuration values
jest.mock('../../../game_config.json', () => ({
    FesterCooldown: 1000,
    FesteringDuration: 1000,
    SwarmCooldown: 1000,
    HighWritTimeout: 1000,
    EminentWritTimeout: 1000,
    RoyalWritTimeout: 1000,
    ImperialWritTimeout: 1000,
    WritDeleteTimeout: 2100
}));

// Mock eventEmitter
jest.mock('../../../functions/eventEmitter', () => ({
    eventEmitter: {
        emit: jest.fn()
    }
}));

describe('Redis Cache Functions', () => {
    beforeAll(async () => {
        // Initialize Redis connection before running tests
        await initializeRedis();
    });

    afterAll(async () => {
        // Close Redis connection after all tests
	  await new Promise((resolve) => setTimeout(resolve, 1000));
        await closeRedisConnection();
    });

    describe('User XP Caching', () => {
        const testUserId = 'test-user-123';

        beforeEach(async () => {
            // Add a test user before each test
            await CacheAddUser(testUserId, 'testuser');
        });

        afterEach(async () => {
            // Remove the test user after each test
            await CacheRemoveUser(testUserId);
        });

        test('CacheAddUser should add a user with initial XP of 0', async () => {
            const xp = await CacheGetUserXP(testUserId);
            expect(xp).toBe(0);
        });

        test('CacheSetUserXP should set and retrieve user XP correctly', async () => {
            const xpToSet = 100;
            await CacheSetUserXP(testUserId, xpToSet);
            
            const retrievedXP = await CacheGetUserXP(testUserId);
            expect(parseInt(retrievedXP)).toBe(xpToSet);
        });

        test('CacheRemoveUser should remove the user from cache', async () => {
            await CacheRemoveUser(testUserId);

            expect(await CacheGetUserXP(testUserId)).toBeUndefined();
        });
    });

    describe('Festering Cache Functions', () => {
        const testMaggotId = 'maggot-123';
        const testPoopId = 'poop-456';
        const secondMaggotId = 'maggot-789';
        const secondPoopId = 'poop-987';


        afterEach(async () => {
            await CacheClearFestering(testMaggotId);
            await CacheClearFestering(secondMaggotId);
        });

        describe('Standard Festering Scenarios', () => {
            test('CacheSetFestering should set festering target correctly', async () => {
                const currentTime = Date.now();
                const endTime = currentTime + 10000; // 10 seconds from now

                await CacheSetFestering(testMaggotId, testPoopId, endTime);

                // Retrieve the festering target
                const festeringTarget = await CacheGetFesteringTarget(testMaggotId);
                
                expect(festeringTarget).toBe(testPoopId);
            });

            test('CacheClearFestering should remove festering target', async () => {
                const currentTime = Date.now();
                const endTime = currentTime + 10000; // 10 seconds from now

                // First, set a festering target
                await CacheSetFestering(testMaggotId, testPoopId, endTime);

                // Then clear it
                await CacheClearFestering(testMaggotId);

                // Try to get the festering target
                const festeringTarget = await CacheGetFesteringTarget(testMaggotId);
                
                expect(festeringTarget).toBeNull();
            });

            test('CacheIsPoopBeingFestered should return maggotId when poop is being festered', async () => {
                const currentTime = Date.now();
                const endTime = currentTime + 10000;

                // Set up festering relationship
                await CacheSetFestering(testMaggotId, testPoopId, endTime);

                // Check if the poop is being festered
                const festeringMaggot = await CacheIsPoopBeingFestered(testPoopId);
                
                // Should return the maggot id
                expect(festeringMaggot).toBe(testMaggotId);
            });

            test('CacheIsPoopBeingFestered should return false when poop is not being festered', async () => {
                // Check for a non-festered poop
                const festeringMaggot = await CacheIsPoopBeingFestered('non-festered-poop');
                
                expect(festeringMaggot).toBe(false);
            });

            test('CacheIsPoopBeingFestered should handle multiple festering relationships', async () => {
                const currentTime = Date.now();
                const endTime = currentTime + 10000;

                // Set up multiple festering relationships
                await CacheSetFestering(testMaggotId, testPoopId, endTime);
                await CacheSetFestering(secondMaggotId, secondPoopId, endTime);

                // Check both relationships
                const firstFesteringMaggot = await CacheIsPoopBeingFestered(testPoopId);
                const secondFesteringMaggot = await CacheIsPoopBeingFestered(secondPoopId);
                
                expect(firstFesteringMaggot).toBe(testMaggotId);
                expect(secondFesteringMaggot).toBe(secondMaggotId);
            });
        });

        describe('Edge Cases and Error Scenarios', () => {
            test('Should handle setting festering with past end time', async () => {
                const pastTime = Date.now() - 5000; // 5 seconds in the past

                await expect(CacheSetFestering(testMaggotId, testPoopId, pastTime))
                    .rejects.toThrow();
            });

            test('Should handle null or undefined inputs', async () => {
                await expect(CacheSetFestering(null, testPoopId, Date.now() + 10000))
                    .rejects.toThrow();
                
                await expect(CacheSetFestering(testMaggotId, null, Date.now() + 10000))
                    .rejects.toThrow();
            });

            test('Should handle multiple festering attempts for same maggot', async () => {
                const currentTime = Date.now();
                const endTime = currentTime + 10000;
                const alternatePoopId = 'alternate-poop-789';

                // First festering
                await CacheSetFestering(testMaggotId, testPoopId, endTime);

                // Second festering should overwrite the first
                await CacheSetFestering(testMaggotId, alternatePoopId, endTime);

                const festeringTarget = await CacheGetFesteringTarget(testMaggotId);
                expect(festeringTarget).toBe(alternatePoopId);
            });
        });
    });

    describe('Cooldown Functions', () => {
        jest.setTimeout(10000); // Increase timeout for cooldown tests

        const testUserId = 'test-user-cooldown';
        const testAbility = 'testAbility';
        const testCooldownTime = 2000; // 2 seconds

        afterEach(async () => {
            // Clean up any cooldowns
            await CacheClearCooldown(testAbility, testUserId);
            await CacheClearCooldown(testAbility);
            await CacheClearSwarmCooldown();
            await CacheClearFesterCooldown(testUserId);
        });

        describe('General Cooldown Functions', () => {
            test('CacheSetCooldown and CacheGetCooldown should work for user-specific cooldowns', async () => {
                // Set a cooldown for a specific user and ability
                await CacheSetCooldown(testAbility, testUserId, testCooldownTime);
                
                // Verify the cooldown was set
                const cooldown = await CacheGetCooldown(testAbility, testUserId);
                expect(cooldown).toBeTruthy();
            });

            test('CacheSetCooldown and CacheGetCooldown should work for global cooldowns', async () => {
                // Set a global cooldown for an ability
                await CacheSetCooldown(testAbility, null, testCooldownTime);
                
                // Verify the cooldown was set
                const cooldown = await CacheGetCooldown(testAbility);
                expect(cooldown).toBeTruthy();
            });

            test('CacheClearCooldown should remove user-specific cooldown', async () => {
                // Set a cooldown for a specific user and ability
                await CacheSetCooldown(testAbility, testUserId, testCooldownTime);
                
                // Clear the cooldown
                await CacheClearCooldown(testAbility, testUserId);
                
                // Verify the cooldown was cleared
                const cooldown = await CacheGetCooldown(testAbility, testUserId);
                expect(cooldown).toBeFalsy();
            });

            test('CacheClearCooldown should remove global cooldown', async () => {
                // Set a global cooldown for an ability
                await CacheSetCooldown(testAbility, null, testCooldownTime);
                
                // Clear the cooldown
                await CacheClearCooldown(testAbility);
                
                // Verify the cooldown was cleared
                const cooldown = await CacheGetCooldown(testAbility);
                expect(cooldown).toBeFalsy();
            });

            test('Cooldowns should automatically expire after the set duration', async () => {
                // Set a cooldown with a short duration
                const shortCooldown = 500; // 500ms
                await CacheSetCooldown(testAbility, testUserId, shortCooldown);
                
                // Verify the cooldown exists immediately
                let cooldown = await CacheGetCooldown(testAbility, testUserId);
                expect(cooldown).toBeTruthy();
                
                // Wait for the cooldown to expire
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Verify the cooldown has been automatically cleared
                cooldown = await CacheGetCooldown(testAbility, testUserId);
                expect(cooldown).toBeFalsy();
            });
        });

        describe('Specific Cooldown Functions', () => {
            test('CacheSetFesterCooldown and CacheGetFesterCooldown should work correctly', async () => {
                // Set a fester cooldown
                const startTime = Date.now();
                await CacheSetFesterCooldown(testUserId, startTime);
                
                // Verify the cooldown was set
                const cooldown = await CacheGetFesterCooldown(testUserId);
                expect(cooldown).toBeTruthy();
            });

            test('CacheClearFesterCooldown should remove fester cooldown', async () => {
                // Set a fester cooldown
                const startTime = Date.now();
                await CacheSetFesterCooldown(testUserId, startTime);
                
                // Clear the cooldown
                await CacheClearFesterCooldown(testUserId);
                
                // Verify the cooldown was cleared
                const cooldown = await CacheGetFesterCooldown(testUserId);
                expect(cooldown).toBeFalsy();
            });

            test('CacheSetSwarmCooldown and CacheGetSwarmCooldown should work correctly', async () => {
                // Set a swarm cooldown
                const startTime = Date.now();
                await CacheSetSwarmCooldown(startTime);
                
                // Verify the cooldown was set
                const cooldown = await CacheGetSwarmCooldown();
                expect(cooldown).toBeTruthy();
            });

            test('CacheClearSwarmCooldown should remove swarm cooldown', async () => {
                // Set a swarm cooldown
                const startTime = Date.now();
                await CacheSetSwarmCooldown(startTime);
                
                // Clear the cooldown
                await CacheClearSwarmCooldown();
                
                // Verify the cooldown was cleared
                const cooldown = await CacheGetSwarmCooldown();
                expect(cooldown).toBeFalsy();
            });
	});
    });
	describe('Writ Functions', () => {
		// Test setup
		const testWritType = 1; // High Writ
		const testWriterId = 'writer-123';
		const testKnightId = 'knight-456';
		const testTargetId = 'target-789';
		const testWritMessage = 'Test writ message';

		// Clean up after each test
		afterEach(async () => {
			try {
				await CacheDeleteWrit(testWritType, testWriterId, testKnightId, testTargetId);
			} catch (err) {
				// Ignore errors during cleanup
			}
		});

		test('CacheSetWrit should create a new writ correctly', async () => {
			// Set a writ with status 0 (pending)
			await CacheSetWrit(
				testWritType,
				testWriterId,
				testKnightId,
				testTargetId,
				0, // status: pending
				testWritMessage
			);

			// Get the writs for the knight to verify
			const knightWrits = await CacheGetKnightWrits(testKnightId);

			// Verify the writ was created correctly
			expect(knightWrits.length).toBe(1);
			expect(knightWrits[0].writType).toBe(testWritType);
			expect(knightWrits[0].writerId).toBe(testWriterId);
			expect(knightWrits[0].knightId).toBe(testKnightId);
			expect(knightWrits[0].targetId).toBe(testTargetId);
			expect(knightWrits[0].writStatus).toBe(0);
			expect(knightWrits[0].writMessage).toBe(testWritMessage);
		});

		test('CacheGetKnightWrits should return all writs for a knight', async () => {
			// Create a writ for the knight
			await CacheSetWrit(
				testWritType,
				testWriterId,
				testKnightId,
				testTargetId,
				0,
				testWritMessage
			);

			// Get the writs
			const knightWrits = await CacheGetKnightWrits(testKnightId);

			// Verify
			expect(knightWrits.length).toBe(1);
			expect(knightWrits[0].knightId).toBe(testKnightId);
		});

		test('CacheGetWriterWrits should return all writs created by a writer', async () => {
			// Create a writ
			await CacheSetWrit(
				testWritType,
				testWriterId,
				testKnightId,
				testTargetId,
				0,
				testWritMessage
			);

			// Get the writs
			const writerWrits = await CacheGetWriterWrits(testWriterId);

			// Verify
			expect(writerWrits.length).toBe(1);
			expect(writerWrits[0].writerId).toBe(testWriterId);
		});

		test('CacheUpdateWritStatus should update the status of a writ', async () => {
			// Create a writ with status 0 (pending)
			await CacheSetWrit(
				testWritType,
				testWriterId,
				testKnightId,
				testTargetId,
				0,
				testWritMessage
			);

			// Update the status to 1 (executed)
			await CacheUpdateWritStatus(
				testWritType,
				testWriterId,
				testKnightId,
				testTargetId,
				1 // status: executed
			);

			// Get the updated writ
			const writerWrits = await CacheGetWriterWrits(testWriterId);

			// Verify the status was updated
			expect(writerWrits[0].writStatus).toBe(1);
		});

		test('CacheDeleteWrit should remove a writ from the cache', async () => {
			// Create a writ
			await CacheSetWrit(
				testWritType,
				testWriterId,
				testKnightId,
				testTargetId,
				0,
				testWritMessage
			);

			// Delete the writ
			await CacheDeleteWrit(
				testWritType,
				testWriterId,
				testKnightId,
				testTargetId
			);

			// Verify it's gone
			const writerWrits = await CacheGetWriterWrits(testWriterId);
			expect(writerWrits.length).toBe(0);
		});

		test('CacheCheckActiveWrit should return true when active writ exists for knight and target', async () => {
			// Create an active writ
			await CacheSetWrit(
				testWritType,
				testWriterId,
				testKnightId,
				testTargetId,
				0, // status: pending (active)
				testWritMessage
			);

			// Check if active writ exists
			const hasActiveWrit = await CacheCheckActiveWrit(testKnightId, testTargetId);

			// Verify
			expect(hasActiveWrit).toBeTruthy();
		});

		test('CacheCheckActiveWrit should return false when no active writ exists', async () => {
			// Check non-existent writ
			const hasActiveWrit = await CacheCheckActiveWrit('nonexistent-knight', 'nonexistent-target');

			// Verify
			expect(hasActiveWrit).toBeFalsy();
		});

		test('CacheCheckActiveWrit should return false when writ exists but is not active', async () => {
			// Create a non-active writ (status 1: executed)
			await CacheSetWrit(
				testWritType,
				testWriterId,
				testKnightId,
				testTargetId,
				1, // status: executed (not active)
				testWritMessage
			);

			// Check if active writ exists
			const hasActiveWrit = await CacheCheckActiveWrit(testKnightId, testTargetId);

			// Verify
			expect(hasActiveWrit).toBeFalsy();
		});

		test('CacheCheckAndUpdateUserWrits should update writs involving a user', async () => {
			// Create a writ where the user is the writer
			await CacheSetWrit(
				testWritType,
				testWriterId,
				testKnightId,
				testTargetId,
				0, // status: pending
				testWritMessage
			);

			// Check and update writs for the writer
			const updated = await CacheCheckAndUpdateUserWrits(testWriterId);

			// Verify writs were updated
			expect(updated).toBeTruthy();

			// Check that the writ status was updated to 3 (annulled)
			const writerWrits = await CacheGetWriterWrits(testWriterId);
			expect(writerWrits[0].writStatus).toBe(3);
		});

		test('CacheCheckAndUpdateUserWrits should update writs where user is knight', async () => {
			// Create a writ where the user is the knight
			await CacheSetWrit(
				testWritType,
				testWriterId,
				testKnightId,
				testTargetId,
				0, // status: pending
				testWritMessage
			);

			// Check and update writs for the knight
			const updated = await CacheCheckAndUpdateUserWrits(testKnightId);

			// Verify writs were updated
			expect(updated).toBeTruthy();

			// Check that the writ status was updated to 3 (annulled)
			const knightWrits = await CacheGetKnightWrits(testKnightId);
			expect(knightWrits[0].writStatus).toBe(3);
		});

		test('CacheCheckAndUpdateUserWrits should update writs where user is target', async () => {
			// Create a writ where the user is the target
			await CacheSetWrit(
				testWritType,
				testWriterId,
				testKnightId,
				testTargetId,
				0, // status: pending
				testWritMessage
			);

			// Check and update writs for the target
			const updated = await CacheCheckAndUpdateUserWrits(testTargetId);

			// Verify writs were updated
			expect(updated).toBeTruthy();

			// Check that the writ status was updated to 3 (annulled)
			const writerWrits = await CacheGetWriterWrits(testWriterId);
			expect(writerWrits[0].writStatus).toBe(3);
		});

		test('CacheCheckAndUpdateUserWrits should return false when no writs exist for the user', async () => {
			// Check a user with no writs
			const updated = await CacheCheckAndUpdateUserWrits('nonexistent-user');

			// Verify
			expect(updated).toBeFalsy();
		});

		test('CacheCheckAndUpdateUserWrits should not update writs that are already annulled', async () => {
			// Create a writ that's already annulled
			await CacheSetWrit(
				testWritType,
				testWriterId,
				testKnightId,
				testTargetId,
				3, // status: already annulled
				testWritMessage
			);


			// Check and update writs
			const updated = await CacheCheckAndUpdateUserWrits(testWriterId);

			// This should return true because writs were found, even though none needed updating
			expect(updated).toBeTruthy();

			// Verify the writ status remains unchanged
			const updatedWrits = await CacheGetWriterWrits(testWriterId);
			expect(updatedWrits[0].writStatus).toBe(3);
		});

		test('Writ auto-expiration: should update status after timeout', async () => {
			jest.setTimeout(3000); // Increase timeout for this test

			// Create a writ
			await CacheSetWrit(
				testWritType,
				testWriterId,
				testKnightId,
				testTargetId,
				0, // status: pending
				testWritMessage
			);

			// Wait for the timeout (2s should be enough since we mocked HighWritTimeout to 1000)
			await new Promise(resolve => setTimeout(resolve, 2000));

			// Get the writ after timeout
			const writerWrits = await CacheGetWriterWrits(testWriterId);

			// Verify the status was auto-updated to 2 (failed)
			expect(writerWrits.length).toBe(1);
			expect(writerWrits[0].writStatus).toBe(2);
		});
	});
	describe('Endow Functions', () => {
		const testMerchantId = 'merchant-123';
		const testTargetId = 'target-456';
		const secondMerchantId = 'merchant-789';
		const secondTargetId = 'target-987';

		afterEach(async () => {
			// Clean up any endows
			await CacheClearEndow(testMerchantId, testTargetId);
			await CacheClearEndow(secondMerchantId, secondTargetId);
		});

		test('CacheSetEndow should create a valid endow relationship', async () => {
			const endTime = Date.now() + 5000; // 5 seconds from now

			await CacheSetEndow(testMerchantId, testTargetId, endTime);

			// Verify the endow relationship exists
			const exists = await CacheCheckEndowExists(testMerchantId, testTargetId);
			expect(exists).toBeTruthy();
		});

		test('CacheClearEndow should remove an endow relationship', async () => {
			const endTime = Date.now() + 5000;

			// Create the endow
			await CacheSetEndow(testMerchantId, testTargetId, endTime);

			// Clear the endow
			await CacheClearEndow(testMerchantId, testTargetId);

			// Verify it was removed
			const exists = await CacheCheckEndowExists(testMerchantId, testTargetId);
			expect(exists).toBeFalsy();
		});

		test('CacheGetEndows should return all merchants endowing a target', async () => {
			const endTime = Date.now() + 5000;

			// Create multiple endows for the same target
			await CacheSetEndow(testMerchantId, testTargetId, endTime);
			await CacheSetEndow(secondMerchantId, testTargetId, endTime);

			// Get all endowing merchants
			const endowers = await CacheGetEndows(testTargetId);

			expect(endowers).toContain(testMerchantId);
			expect(endowers).toContain(secondMerchantId);
			expect(endowers.length).toBe(2);
		});

		test('CacheGetMerchantEndows should return all targets endowed by a merchant', async () => {
			const endTime = Date.now() + 5000;

			// Create multiple endows from the same merchant
			await CacheSetEndow(testMerchantId, testTargetId, endTime);
			await CacheSetEndow(testMerchantId, secondTargetId, endTime);

			// Get all endowed targets
			const targets = await CacheGetMerchantEndows(testMerchantId);

			expect(targets).toContain(testTargetId);
			expect(targets).toContain(secondTargetId);
			expect(targets.length).toBe(2);
		});

		test('CacheClearMerchantEndows should remove all endows from a merchant', async () => {
			const endTime = Date.now() + 5000;

			// Create multiple endows from the same merchant
			await CacheSetEndow(testMerchantId, testTargetId, endTime);
			await CacheSetEndow(testMerchantId, secondTargetId, endTime);

			// Clear all the merchant's endows
			await CacheClearMerchantEndows(testMerchantId);

			// Verify all endows were removed
			const exists1 = await CacheCheckEndowExists(testMerchantId, testTargetId);
			const exists2 = await CacheCheckEndowExists(testMerchantId, secondTargetId);

			expect(exists1).toBeFalsy();
			expect(exists2).toBeFalsy();
		});

		test('CacheClearTargetEndows should remove all endows for a target', async () => {
			const endTime = Date.now() + 5000;

			// Create multiple endows for the same target
			await CacheSetEndow(testMerchantId, testTargetId, endTime);
			await CacheSetEndow(secondMerchantId, testTargetId, endTime);

			// Clear all the target's endows
			await CacheClearTargetEndows(testTargetId);

			// Verify all endows were removed
			const exists1 = await CacheCheckEndowExists(testMerchantId, testTargetId);
			const exists2 = await CacheCheckEndowExists(secondMerchantId, testTargetId);

			expect(exists1).toBeFalsy();
			expect(exists2).toBeFalsy();
		});

		test('Endows should automatically expire after their end time', async () => {
			// Set a short duration endow
			const endTime = Date.now() + 500; // 500ms

			await CacheSetEndow(testMerchantId, testTargetId, endTime);

			// Verify it exists immediately
			let exists = await CacheCheckEndowExists(testMerchantId, testTargetId);
			expect(exists).toBeTruthy();

			// Wait for the endow to expire
			await new Promise(resolve => setTimeout(resolve, 1000));

			// Verify it has been automatically cleared
			exists = await CacheCheckEndowExists(testMerchantId, testTargetId);
			expect(exists).toBeFalsy();
		});
	});
});
