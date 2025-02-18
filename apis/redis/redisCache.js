const {eventEmitter} = require("../../functions/eventEmitter.js");
// Import the Redis client
const redis = require("redis");
// Client will be set in the initializeRedis function
let client;
let isInitialConnection = true;
const {
  FesterCooldown,
  FesteringDuration,
  SwarmCooldown,
  HighWritTimeout,
  EminentWritTimeout,
  RoyalWritTimeout,
  ImperialWritTimeout,
  WritDeleteTimeout
} = require("../../game_config.json");
// Initialize Redis connection

function showErrorMsg(err) {
  console.error("ERROR: redisCache.js", err);
}

async function initializeRedis() {
const url = process.env.REDIS_URL || 'redis://localhost:6379';
  client = redis.createClient({
	  url: url
  });
  client.on("connect", async () => {
    if (!isInitialConnection) {
      console.log("Redis reconnected, synchronizing cache...");
      try {
        await CacheAllUserXP();
        console.log("Redis cache re-synchronized successfully.");
      } catch (error) {
        console.error("Failed to synchronize Redis cache on reconnect:", error);
      }
    }
    isInitialConnection = false;
  });
  client.on("reconnecting", () => console.log("Redis Client Reconnecting"));
  client.on("error", (err) => {
    console.error("Redis Client Error", err);
    throw err;
  });
  try {
    await client.connect();
    await client.flushDb();
    console.log("Redis client connected, flushed cache");
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function CacheAddUser(userId) {
  try {
    await CacheSetUserXP(userId, 0);
    console.log(`Cache: succesfully cached new user ID: ${userId}`);
  } catch (err) {
    console.error(
      `Cache: error caching new user ID: ${userId} with error : ${err}`
    );
    throw err;
  }
}

async function CacheRemoveUser(userId) {
  try {
    await client.del(`user:${userId}:xp`);
    console.log(`Cache: succesfully remved user from cache ID: ${userId}`);
  } catch (err) {
    console.error(
      `Cache: Error removing user from cache ID: ${userId} with error : ${err}`
    );
    throw err;
  }
}

// Setting a user's XP
async function CacheSetUserXP(userId, xp) {
  try {
    await client.set(`user:${userId}:xp`, xp.toString());
  } catch (err) {
    throw err;
  }
  console.log(`Cache: succesfully cached XP: ${xp} for user ID : ${userId}`);
}

// Getting a user's XP
async function CacheGetUserXP(userId) {
  const xp = await client.get(`user:${userId}:xp`);
  if (!xp) {
    throw new Error(`no user with id: ${userId} in cache`);
  }
  return xp;
}

async function CacheSetFestering(maggotId, poopId, endTime) {
  try {
    await client.set(`festering:${maggotId}`, poopId);
    const startTime = endTime - FesteringDuration;
    await CacheSetFesterCooldown(maggotId, startTime);
  } catch (err) {
    throw err;
  }
}

async function CacheClearFestering(maggotId) {
  try {
    await client.del(`festering:${maggotId}`);
  } catch (err) {
    throw err;
  }
}

async function CacheGetFesteringTarget(maggotId) {
  try {
    const festeringData = await client.get(`festering:${maggotId}`);
    return festeringData ? festeringData : null;
  } catch (err) {
    throw err;
  }
}

// Function to close the Redis connection
async function closeRedisConnection() {
  if (client) {
    try {
      await client.flushDb();
      await client.quit();
    } catch (err) {
      console.error(`Cache: couldn't close redis connection error: ${err}`);
      throw err;
    }
  } else {
    console.error("Cache: no redis client connection to close");
  }
}

async function CacheSetSwarmCooldown(startTime) {
  const cooldownEndTime = startTime + SwarmCooldown;
  const cooldownTimeLeft = cooldownEndTime - Date.now();
  if (cooldownTimeLeft > 0) {
    try {
      await client.set(`swarmCooldown`, cooldownEndTime);
    } catch (err) {
      throw err;
    }
  }
  setTimeout(async () => {
    await CacheClearSwarmCooldown();
  }, cooldownTimeLeft);
}

async function CacheClearSwarmCooldown() {
  try {
    await client.del(`swarmCooldown`);
  } catch (err) {
    throw err;
  }
}

async function CacheGetSwarmCooldown() {
  try {
    const cooldown = await client.get(`swarmCooldown`);
    return cooldown ? cooldown : false;
  } catch (err) {
    throw err;
  }
}

// I will remove _(underline) after you check.
async function CacheSetCooldown(cacheKey, userId, cooldownTime) {
  const cooldownEndTime = Date.now() + cooldownTime;
  const cooldownTimeLeft = cooldownEndTime - Date.now();
  console.log("cooldownTimeLeft---------->", cooldownTimeLeft);
  if (userId) {
    try {
      if (cooldownTimeLeft > 0) {
        await client.set(`${cacheKey}Cooldown:${userId}`, cooldownTimeLeft);
      }
      setTimeout(async () => {
        await CacheClearCooldown(cacheKey, userId);
      }, cooldownTimeLeft);
    } catch (err) {
      showErrorMsg(err);
    }
  } else {
    try {
      if (cooldownTimeLeft > 0) {
        await client.set(`${cacheKey}Cooldown`, cooldownTimeLeft);
      }
      setTimeout(async () => {
        await CacheClearCooldown(cacheKey);
      }, cooldownTimeLeft);
    } catch (err) {
      showErrorMsg(err);
    }
  }
}

async function CacheClearCooldown(cacheKey, userId) {
  if (userId) {
    try {
      await client.del(`${cacheKey}Cooldown:${userId}`);
    } catch (err) {
      showErrorMsg(err);
    }
  } else {
    try {
      await client.del(`${cacheKey}Cooldown`);
    } catch (err) {
      showErrorMsg(err);
    }
  }
}

async function CacheGetCooldown(cacheKey, userId) {
  if (userId) {
    try {
      const cooldown = await client.get(`${cacheKey}Cooldown:${userId}`);
      if (cooldown) {
        return cooldown;
      } else {
        return false;
      }
    } catch (err) {
      showErrorMsg(err);
    }
  } else {
    try {
      const cooldown = await client.get(`${cacheKey}Cooldown`);
      if (cooldown) {
        return cooldown;
      } else {
        return false;
      }
    } catch (err) {
      showErrorMsg(err);
    }
  }
}

async function CacheSetFesterCooldown(maggotId, startTime) {
  const cooldownEndTime = startTime + FesterCooldown;
  const cooldownTimeLeft = cooldownEndTime - Date.now();
  if (cooldownTimeLeft > 0) {
    try {
      await client.set(`festerCooldown:${maggotId}`, cooldownEndTime);
    } catch (err) {
      throw err;
    }
  }
  setTimeout(async () => {
    await CacheClearFesterCooldown(maggotId);
  }, cooldownTimeLeft);
}

async function CacheClearFesterCooldown(maggotId) {
  try {
    await client.del(`festerCooldown:${maggotId}`);
  } catch (err) {
    throw err;
  }
}

async function CacheGetFesterCooldown(maggotId) {
  try {
    const cooldown = await client.get(`festerCooldown:${maggotId}`);
    if (cooldown) {
      return cooldown;
    } else {
      return false;
    }
  } catch (err) {
    throw err;
  }
}

async function CacheIsPoopBeingFestered(poopId) {
  try {
    const keys = await client.keys("festering:*");
    for (let key of keys) {
      const festeringData = await client.get(key);
      if (festeringData === poopId) {
        const maggotId = key.split(":")[1];
        console.log(`maggot targeting poop is ${maggotId}`);
        return maggotId;
      }
    }
    return false;
  } catch (err) {
    showErrorMsg(err);
    return true;
  }
}

// Helper function to get the correct timeout based on writ type
function getWritTimeout(writType) {
  switch (writType) {
    case 1:
      return parseInt(HighWritTimeout);
    case 2:
      return parseInt(EminentWritTimeout);
    case 3:
      return parseInt(RoyalWritTimeout);
    case 4:
      return parseInt(ImperialWritTimeout);
    default:
      throw new Error("Invalid writ type");
  }
}

// Function to set a writ in the cache
async function CacheSetWrit(
  writType,
  writerId,
  knightId,
  targetId,
  writStatus,
  writMessage
) {
  const writKey = `writ:${writType}:${writerId}:${knightId}:${targetId}`;
  const writData = JSON.stringify({
    writType,
    writerId,
    knightId,
    targetId,
    writStatus,
    writMessage,
  });

  try {
    await client.set(writKey, writData);

    // Set the first timer
    const timeout = getWritTimeout(writType);
    setTimeout(async () => {
      const currentData = JSON.parse(await client.get(writKey));
      if (currentData.writStatus === 0) {
        currentData.writStatus = 2;
        await client.set(writKey, JSON.stringify(currentData));
      }

      // Set the second timer for deletion
      setTimeout(async () => {
        await client.del(writKey);
      }, parseInt(WritDeleteTimeout));
    }, timeout);
  } catch (err) {
    console.error("Error setting writ:", err);
    throw err;
  }
}

async function CacheUpdateWritStatus(
  writType,
  writerId,
  knightId,
  targetId,
  newStatus
) {
  const writKey = `writ:${writType}:${writerId}:${knightId}:${targetId}`;
  try {
    const writData = await client.get(writKey);
    if (writData) {
      const updatedData = JSON.parse(writData);
      updatedData.writStatus = newStatus;
      await client.set(writKey, JSON.stringify(updatedData));
    }
  } catch (err) {
    console.error("Error updating writ status:", err);
    throw err;
  }
}

async function CacheDeleteWrit(writType, writerId, knightId, targetId) {
  const writKey = `writ:${writType}:${writerId}:${knightId}:${targetId}`;
  try {
    await client.del(writKey);
  } catch (err) {
    console.error("Error deleting writ:", err);
    throw err;
  }
}

async function CacheGetKnightWrits(knightId) {
  return CacheGetWrits(`writ:*:*:${knightId}:*`);
}

async function CacheGetWriterWrits(writerId) {
  return CacheGetWrits(`writ:*:${writerId}:*:*`);
}

async function CacheGetWrits(pattern) {
  try {
    const keys = await client.keys(pattern);
    const multi = client.multi();
    keys.forEach((key) => multi.get(key));
    const results = await multi.exec();
    return results.map(JSON.parse);
  } catch (err) {
    console.error("Error getting writs:", err);
    throw err;
  }
}

async function CacheCheckActiveWrit(knightId, targetId) {
  try {
    const keys = await client.keys(`writ:*:*:${knightId}:${targetId}`);
    for (let key of keys) {
      const writData = JSON.parse(await client.get(key));
      if (writData.writStatus === 0) {
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error("Error checking active writ:", err);
    throw err;
  }
}

async function CacheCheckAndUpdateUserWrits(userId) {
  try {
    console.log(`Checking writs for userId: ${userId}`);
    const writerKeys = await client.keys(`writ:*:${userId}:*:*`);
    const knightKeys = await client.keys(`writ:*:*:${userId}:*`);
    const targetKeys = await client.keys(`writ:*:*:*:${userId}`);

    console.log(
      `Found keys - Writer: ${writerKeys.length}, Knight: ${knightKeys.length}, Target: ${targetKeys.length}`
    );

    const allKeys = [...new Set([...writerKeys, ...knightKeys, ...targetKeys])];

    if (allKeys.length === 0) {
      console.log(`No writs found for userId: ${userId}`);
      return false;
    }

    console.log(`Total unique keys found: ${allKeys.length}`);

    const multi = client.multi();

    for (const key of allKeys) {
      multi.get(key);
    }

    const results = await multi.exec();
    const updatedMulti = client.multi();
    let updatedCount = 0;

    results.forEach((result, index) => {
      if (result) {
        const writData = JSON.parse(result);
        console.log(`Checking writ: ${JSON.stringify(writData)}`);
        if (
          (writData.writerId === userId ||
            writData.knightId === userId ||
            writData.targetId === userId) &&
          writData.writStatus !== 3
        ) {
          writData.writStatus = 3;
          updatedMulti.set(allKeys[index], JSON.stringify(writData));
          updatedCount++;
          console.log(`Updated writ: ${allKeys[index]}`);
        }
      } else {
        console.log(`No data found for key: ${allKeys[index]}`);
      }
    });

    if (updatedCount > 0) {
      await updatedMulti.exec();
      console.log(`Updated ${updatedCount} writs for userId: ${userId}`);
      return true;
    } else {
      console.log(`No writs needed updating for userId: ${userId}`);
      return false;
    }
  } catch (err) {
    console.error("Error checking and updating user writs:", err);
    throw err;
  }
}



async function CacheSetEndow(merchantId, targetId, endTime) {
  try {
    await client.set(`endow:${targetId}:${merchantId}`, endTime.toString());
    console.log(`Cache: successfully set endow from merchant ${merchantId} to target ${targetId}`);
    
    // Set up timeout to clear the endow when it expires
    const timeLeft = endTime - Date.now();
    setTimeout(async () => {
      try {
        await CacheClearEndow(merchantId, targetId);
        console.log(`Cache: endow expired and cleared for merchant ${merchantId} and target ${targetId}`);
        eventEmitter.emit('endowExpired', merchantId, targetId);
      } catch (err) {
        console.error(`Error clearing expired endow: ${err}`);
      }
    }, timeLeft);
    
  } catch (err) {
    console.error(`Cache: Failed to set endow for merchant ${merchantId} and target ${targetId}`, err);
    throw err;
  }
}

async function CacheClearEndow(merchantId, targetId) {
  try {
    await client.del(`endow:${targetId}:${merchantId}`);
    console.log(`Cache: successfully cleared endow from merchant ${merchantId} to target ${targetId}`);
  } catch (err) {
    console.error(`Cache: Failed to clear endow for merchant ${merchantId} and target ${targetId}`, err);
    throw err;
  }
}

async function CacheGetEndows(targetId) {
  try {
    const keys = await client.keys(`endow:${targetId}:*`);
    const endows = [];
    
    for (const key of keys) {
      const merchantId = key.split(':')[2];
      const endTime = await client.get(key);
      if (parseInt(endTime) > Date.now()) {
        endows.push(merchantId);
      }
    }
    
    return endows;
  } catch (err) {
    console.error(`Cache: Failed to get endows for target ${targetId}`, err);
    throw err;
  }
}

async function CacheCheckEndowExists(merchantId, targetId) {
  try {
    const endTime = await client.get(`endow:${targetId}:${merchantId}`);
    return endTime ? parseInt(endTime) > Date.now() : false;
  } catch (err) {
    console.error(`Cache: Failed to check endow existence for merchant ${merchantId} and target ${targetId}`, err);
    throw err;
  }
}

async function CacheClearMerchantEndows(merchantId) {
  try {
    // Find all keys that have this merchant as the endower
    const keys = await client.keys(`endow:*:${merchantId}`);
    
    if (keys.length === 0) {
      console.log(`Cache: No endows found for merchant ${merchantId}`);
      return;
    }

    // Create a multi command to delete all keys
    const multi = client.multi();
    for (const key of keys) {
      multi.del(key);
      // Extract targetId from key format "endow:targetId:merchantId"
      const targetId = key.split(':')[1];
      console.log(`Cache: clearing endow from merchant ${merchantId} to target ${targetId}`);
    }
    
    await multi.exec();
    console.log(`Cache: successfully cleared all endows for merchant ${merchantId}`);
  } catch (err) {
    console.error(`Cache: Failed to clear all endows for merchant ${merchantId}`, err);
    throw err;
  }
}

async function CacheClearTargetEndows(targetId) {
  try {
    // Find all keys for this target
    const keys = await client.keys(`endow:${targetId}:*`);
    
    if (keys.length === 0) {
      console.log(`Cache: No endows found for target ${targetId}`);
      return;
    }

    // Create a multi command to delete all keys
    const multi = client.multi();
    for (const key of keys) {
      multi.del(key);
      // Extract merchantId from key format "endow:targetId:merchantId"
      const merchantId = key.split(':')[2];
      console.log(`Cache: clearing endow from merchant ${merchantId} to target ${targetId}`);
    }
    
    await multi.exec();
    console.log(`Cache: successfully cleared all endows for target ${targetId}`);
  } catch (err) {
    console.error(`Cache: Failed to clear all endows for target ${targetId}`, err);
    throw err;
  }
}

async function CacheGetMerchantEndows(merchantId) {
  try {
    const keys = await client.keys(`endow:*:${merchantId}`);
    const endows = [];
    
    for (const key of keys) {
      const targetId = key.split(':')[1];
      const endTime = await client.get(key);
      if (parseInt(endTime) > Date.now()) {
        endows.push(targetId);
      }
    }
    
    return endows;
  } catch (err) {
    console.error(`Cache: Failed to get endows for merchant ${merchantId}`, err);
    throw err;
  }
}
module.exports = {
  CacheSetEndow,
  CacheClearEndow,
  CacheGetEndows,
  CacheCheckEndowExists,
  CacheClearMerchantEndows,
  CacheClearTargetEndows,
  CacheGetMerchantEndows,
  initializeRedis,
  CacheRemoveUser,
  CacheAddUser,
  CacheGetUserXP,
  CacheSetUserXP,
  CacheSetFestering,
  CacheClearFestering,
  CacheGetFesteringTarget,
  CacheIsPoopBeingFestered,
  CacheSetFesterCooldown,
  CacheGetFesterCooldown,
  CacheClearFesterCooldown,
  closeRedisConnection,
  CacheSetCooldown,
  CacheGetCooldown,
  CacheClearCooldown,
  CacheGetSwarmCooldown,
  CacheSetSwarmCooldown,
  CacheClearSwarmCooldown,
  CacheSetWrit,
  CacheUpdateWritStatus,
  CacheDeleteWrit,
  CacheGetKnightWrits,
  CacheGetWriterWrits,
  CacheCheckActiveWrit,
  CacheCheckAndUpdateUserWrits,
};
