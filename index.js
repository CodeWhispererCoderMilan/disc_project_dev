require('dotenv').config();
const { initializeRedis, closeRedisConnection } = require ('./apis/redis/redisCache.js');
const { CacheDataFromDB } = require ('./apis/firebase/querys.js');
const { initializeBots } = require ('./botSetup.js');
const { eventEmitter } = require ('./functions/eventEmitter.js');
let isShuttingDown = false;
let botClients = [];
// Initialize the Redis client,cache DB and initialize all bots at the start of your application
async function startApp() {
	try {
		await initializeRedis();
		await CacheDataFromDB();
		botClients= await initializeBots();
		console.log('Application startup sequence complete. redis cache initialized with DB values, bot setup complete');
	} catch (error) {
		console.error('Initialization error:', error);
		process.exit(1); 
	}
}
async function gracefulShutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log('Graceful shutdown initiated...');
    gameState.setServerDown(true);
    eventEmitter.emit('ServerStatusChange');
    await new Promise(resolve => setTimeout(resolve, 10000));
    // Destroy all bot clients
    for (const client of botClients) {
        if (client) {
            try {
                await client.destroy();
                console.log(`Bot ${client.user.tag} successfully disconnected`);
            } catch (err) {
                console.error(`Error disconnecting bot ${client?.user?.tag}:`, err);
            }
        }
    }

    // Close Redis connection
    try {
        await closeRedisConnection();
        console.log('Redis connection closed');
    } catch (err) {
        console.error('Error closing Redis connection:', err);
    }

    // Exit process
    process.exit(0);
}
startApp();

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    await gracefulShutdown();
});
process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    await gracefulShutdown();
});
