require('dotenv').config();
const { initializeRedis, closeRedisConnection } = require ('./apis/redis/redisCache.js');
const { CacheDataFromDB } = require ('./apis/firebase/querys.js');
const { initializeBots } = require ('./botSetup.js');

// Initialize the Redis client,cache DB and initialize all bots at the start of your application
(async () => {
	try {
		await initializeRedis();
		await CacheDataFromDB();
		initializeBots();
		console.log('Application startup sequence complete. redis cache initialized with DB values, bot setup complete');
	} catch (error) {
		console.error('Initialization error:', error);
		process.exit(1); 
	}
})();
// node proccesses
// Listening for app termination/restart events
process.on('SIGINT', async ()=>{ await closeRedisConnection(); }); // Handles Ctrl+C
process.on('SIGTERM',async ()=>{ await closeRedisConnection(); }); // Handles "terminate" signal
