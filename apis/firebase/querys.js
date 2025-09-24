const { db } = require('./firebaseDb.js');
const { MinimumLordSize, MinimumNobleSize, MinimumKnightSize,
	MinimumKingSize,
	roleXpThresholds,
	FesteringDuration,
	XpBoostPoop,
	XpBoostMaggot,
	XpBoostCoockroach,
	XpBoostRat,
	XpBoostSubhuman,
	XpBoostPeasant,
	XpBoostScholar,
	XpBoostMerchant,
	XpBoostKnight,
	XpBoostNoble,
	XpBoostLord,
	XpBoostKing,
	XpBoostEmperor,
	EndowPenalty
} = require('../../game_config.json');
const { CacheRemoveUser, CacheAddUser, CacheSetUserXP, CacheSetFestering, CacheClearFestering, CacheIsPoopBeingFestered, CacheGetEndows, CacheGetUserXP, CacheClearEndow} = require('../redis/redisCache.js');
const { eventEmitter } = require('../../functions/eventEmitter.js');

const roleUpgradeAvailable = Array(13).fill(true); //array that opens or blocks leveling up between roles.

	function closeThreshold(thresholdnr) {
		roleUpgradeAvailable[thresholdnr] = false;

	}
async function openThreshold(thresholdnr, client) {
	roleUpgradeAvailable[thresholdnr] = true;
	await DBBoostXPForAllUsers(0, client);
}
function isThresholdOpen(thresholdnr) {
	return roleUpgradeAvailable[thresholdnr];
}
async function CacheDataFromDB() {
	try {
		await CacheAllUserXP();
		await CacheFesteringUsers();
	} catch (err) {
		console.log(`Cache: error caching DB data on startup error message: ${err}`);
	}
}

async function CacheAllUserXP() {
	try {
		const users = await DBGetUsers();
		for (const userId in users) {
			const xp = users[userId].XP || 0;
			await CacheSetUserXP(userId, xp);
		}
		console.log('Cache: succesfully cached all users XP');
	} catch (err) {
		console.error(`Cache: ${err}`);
		throw err;
	}
}

async function CacheFesteringUsers() {
	const festerings = await DBGetActiveFestering();
	if (!festerings) {
		throw new Error(`DB: couldn't get list of active festering on start-up`);
	}
	const now = Date.now();
	for (const maggotId in festerings) {
		const data = festerings[maggotId];
		console.log(`Cahing festering maggotId: ${maggotId}   poopId: ${data.poopId} endTime: ${data.endTime}`);
		try {
			if (data.endTime > now) {
				await CacheSetFestering(maggotId, data.poopId, data.endTime);
			} else {
				await DBClearFestering(maggotId);
			}
		} catch (err) {
			throw err;
		}
	}
}

async function DBGetUsers() {
	const snapshot = await db.ref('users').once('value');
	if (!snapshot) {
		console.error('DB: unable to fetch users');
		throw new Error(`DB: unable to fetch users`);
	}
	return snapshot.val(); // users
}

async function DBGetUserById(userId) {
	const userRef = db.ref(`users/${userId}`)
	const userDataSnapshot = await userRef.once('value');
	if (!userDataSnapshot) {
		console.error(`User ID: ${userId} not found`);
		return false;
	}
	return userDataSnapshot.val();
}

async function DBAddUser(member) {
	try {
		await db.ref('users/' + member.id).set({
			username: member.displayName,
			XP: 0,
			role: "Poop",
		});
		console.log(`DB: User ${member.displayName} added to DB. updating cache..`);
		await CacheAddUser(member.id);
	} catch (err) {
		console.error(err);
		throw err;
	}
}

async function DBRemoveUser(member) {
	try {
		await db.ref(`users/${member.id}`).remove();
		console.log(`DB: User ${member.displayName} removed from DB. updating cache..`);
		await CacheRemoveUser(member.id);
	} catch (err) {
		console.error(err);
		throw err;
	}
}

async function DBUpdateXP(userId, xpChange, client) {
	const userRef = db.ref(`users/${userId}`)
	const userXpRef = db.ref(`users/${userId}/XP`);
	const userDataSnapshot = await userRef.once('value');
	if (!userDataSnapshot) {
		throw new Error(`User ID: ${userId} not found`)
	}
	const userData = userDataSnapshot.val();
	if (!userData) {
		throw new Error(`User ID :${userId} not found`);
	}
	const endowingMerchants = await CacheGetEndows(userId);
	if (xpChange > 0) {
		let initXpChange = xpChange;
		try {
			if (endowingMerchants.length > 0) {
				// Target gets 1.5x XP
				xpChange = Math.floor(initXpChange + endowingMerchants.length*xpChange*0.5);
				const merchantShare = Math.floor(initXpChange / 2);
				for (const merchantId of endowingMerchants) {
					await DBUpdateXP(merchantId, merchantShare, client);
				}
			}
		} catch (err) {
			console.error('Error processing endows:', err);
		}
	}
	try {
		const festering = await CacheIsPoopBeingFestered(userId);
		if (festering && (xpChange > 0)) {
			const maggotXP = Math.floor(xpChange / 2);
			xpChange = maggotXP;
			await DBUpdateXP(festering, maggotXP, client);
		}
	} catch (err) {
		throw err;
	}
	if ((parseInt(userData.XP) + parseInt(xpChange)) < 0) {
		throw new Error(`User with id ${userId} does not have enough XP for xp change`);
	}
	let newXP = (userData.XP || 0)  + xpChange;
	let newRole = userData.role;
	let remainderXP = newXP;
	// Determine if a role upgrade is needed
	const roles = Object.keys(roleXpThresholds);
	for (let i = 0; i < roles.length; i++) {
		if (newRole === roles[i] && newXP >= roleXpThresholds[roles[i+1]]) {
			if (i + 1 < roles.length && roleUpgradeAvailable[i+1]) {
				newRole = roles[i + 1];
				remainderXP = newXP - roleXpThresholds[roles[i+1]]; // Calculate remainder XP
				newXP = remainderXP; // Reset XP to remainder
			} else break;
		}
	}
	if(newRole === "Emperor"){
		closeThreshold(12);
	}


	// Update user's XP and role
	try {
		await userXpRef.set(newXP);
		await CacheSetUserXP(userId, newXP);
	} catch (err) {
		console.error(`failed to update XP for user with id: ${userId} err : ${err.message}`)
		throw err;
	}

	// If role changed, you might want to do additional actions here, like announcing the role change
	if (newRole !== userData.role) {
		try{	
			console.log(`role update event triggerred for ${userId} with role ${newRole}`)
			const guild = await client.guilds.fetch(process.env.GUILDID);
			if (!guild) {
				console.error("Guild not found");
				return;
			}
			const member = await guild.members.fetch(userId);
			if (!member) {
				console.error("Member not found");
				return;
			}
			await changeRole(member, newRole, true);
			console.log(`Event emitted for role update for user with ID:${userId}`);
		}catch(err){
			console.error(`failed to emmit role update event for user with ID: ${userId}`);
			throw err;
		}	
	}
}

async function DBResetXP(userId) {
	const xpResetPath = `users/${userId}/XP`;
	try {
		let ref = db.ref(xpResetPath);
		await ref.set(0);
		console.log(`Database: XP reset to 0 for user ${userId}.`);
		await CacheSetUserXP(userId, 0);
	} catch (error) {
		console.error(`Error resetting XP for user ${userId}: ${error.message}`);
		throw error;
	}
}

function DBSetRole(member, newRole) {
	const userRoleRef = db.ref(`users/${member.id}/role`);

	userRoleRef.set(newRole)
		.then(() => console.log(`DB: Role ${newRole} set for user ${member.displayName}.`))
		.catch(err => console.error(err));
}

// Example function to get the last XP boost time from the database
async function DBGetLastXPBoostTime() {
	try {
		const ref_time_since_boost = db.ref('LastXpBoost');
		const time_since_boost = await ref_time_since_boost.once('value');
		console.log(`DB: checked time since last XP boost: ${time_since_boost.val()}`);
		if (!time_since_boost.val()) {
			return null;
		}
		return time_since_boost.val();
	} catch (err) {
		throw ({name: 'DBError', message: `Error getting last XP boost time: ${err.message}`})
	}
}

async function DBSetLastXPBoostTime(time) {
	try {
		let ref = db.ref('LastXpBoost')
		await ref.set(time);
		console.log(`DB: Last XP boost time set to ${time}`);

	} catch (err) {
		throw ({name: 'DBError', message: `Error setting last XP boost time: ${err.message}`})
	}
}

async function DBBoostXPForAllUsers(BoostCount, client) {
	let snapshot;
	try {
		const usersRef = db.ref('users');
		snapshot = await usersRef.once('value');
	} catch (err) {
		console.error(`Error fetching users: ${err.message}`);
		throw new Error(`Error fetching users: ${err.message}`);
	}

	const users = snapshot.val();
	if (!users) {
		console.error('No users found for XP boost.');
		return; // Exit if no uers found
	}

	let usersToUpdate = Object.keys(users); // List of user IDs to update
	console.log(`User list : ${usersToUpdate}`)
	let retryCount = 0;
	while (usersToUpdate.length > 0 && retryCount < 3) {
		console.log(`Attempt ${retryCount + 1}: Boosting XP for ${usersToUpdate.length} users.`);
		let retryUsers = [];

		for (const userId of usersToUpdate) {
			try {
				switch(users[userId].role){
					case("Poop"):
						await DBUpdateXP(userId, BoostCount*XpBoostPoop, client);
						break;

					case("Maggot"):
						await DBUpdateXP(userId, BoostCount*XpBoostMaggot, client);
						break;

					case("Fly"):
						await DBUpdateXP(userId, BoostCount*XpBoostCoockroach, client);
						break;

					case("Rat"):
						await DBUpdateXP(userId, BoostCount*XpBoostRat, client);
						break;

					case("Sub-human"):
						await DBUpdateXP(userId, BoostCount*XpBoostSubhuman, client);
						break;	

					case("Peasant"):
						await DBUpdateXP(userId, BoostCount*XpBoostPeasant, client);
						break;	

					case("Scholar"):
						await DBUpdateXP(userId, BoostCount*XpBoostScholar, client);
						break;	

					case("Merchant"):
						await DBUpdateXP(userId, BoostCount*XpBoostMerchant, client);
						break;	

					case("Knight"):
						await DBUpdateXP(userId, BoostCount*XpBoostKnight, client);
						break;	

					case("Noble"):
						await DBUpdateXP(userId, BoostCount*XpBoostNoble, client);
						break;	

					case("Lord"):
						await DBUpdateXP(userId, BoostCount*XpBoostLord, client);
						break;	

					case("King"):
						await DBUpdateXP(userId, BoostCount*XpBoostKing, client);
						break;	

					case("Emperor"):
						await DBUpdateXP(userId, BoostCount*XpBoostEmperor, client);
						break;
				}
				console.log(`XP boosted for user ${userId}.`);
			} catch (err) {
				console.error(`Failed to boost XP for user ${userId}: ${err.message}`);
				retryUsers.push(userId); // Add user ID to retry list
			}
		}

		// Prepare for the next retry iteration with users that failed to update
		usersToUpdate = retryUsers;
		retryCount++;
	}

	if (usersToUpdate.length > 0) {
		console.error(`Failed to boost XP for ${usersToUpdate.length} users after 3 attempts, all others updated.`);
	} else {
		console.log('XP boosted for all users successfully.');
		await DBSetLastXPBoostTime(Date.now());
	}
}

async function DBSetFestering(maggotId, poopId) {
	const now = Date.now();
	const endTime = now + FesteringDuration;
	console.log(`Setting fester for maggot ${maggotId} and poop ${poopId}...`);
	try {
		await db.ref(`festering/${maggotId}`).set({
			poopId: poopId,
			startTime: now,
			endTime: endTime,  // FESTERING_DURATION should be defined based on your game rules
		});
	} catch (err) {
		console.error(`DB: Failed to set festering for maggot ${maggotId} and poop ${poopId}: ${err.message}`);
		// throw err;
	}
	try {
		await CacheSetFestering(maggotId, poopId, endTime);
	} catch (err) {
		console.error(`Cache: Failed to set festering for maggot ${maggotId} and poop ${poopId} :${err.message}`);
		// throw err;
	}
	const timeLeft = endTime - Date.now();
	setTimeout(async () => {
		try {
			console.log(`deleting festering between maggot : ${maggotId} and poop : ${poopId} ...`)
			await DBClearFestering(maggotId);
			await CacheClearFestering(maggotId);
		} catch (err) {
			throw err;
		}
	}, timeLeft);
}

async function DBClearFestering(maggotId) {
	try {
		await db.ref(`festering/${maggotId}`).remove();
	} catch (err) {
		console.error(`DB: Failed to clear festering for maggot ${maggotId} ${err.message}`);
		throw err;
	}
	try {
		await CacheClearFestering(maggotId);
	} catch (err) {
		console.error(`Cache: Failed to set festering for maggot ${maggotId} ${err.message}`);
		throw err;
	}
	eventEmitter.emit('festeringStatusChanged');
}

async function DBGetFestering(maggotId) {
	const snapshot = await db.ref(`festering/${maggotId}`).once('value');
	return snapshot.val();
}

async function DBGetActiveFestering() {
	const snapshot = await db.ref(`festering`).once('value');
	return snapshot.val() || {};
}
async function changeRole(member, roleName, keepXP) {

	console.log(`Change Role called for ${member.id} with role ${roleName}`);
	const memberRoleArr = member.roles.cache.filter(
		(r) => r.name !== "@everyone"
	);

	if (!(memberRoleArr.size === 1)) {
		console.error(`user "${member.displayName}" has multiple roles`);
	}
	const role = member.guild.roles.cache.find((r) => r.name === roleName);
	if (!role) {
		console.error(`Role "${roleName}" not found`);
	}
	const memberRole = memberRoleArr.first();
	try {
		DBSetRole(member, roleName);
	} catch (err) {
		throw {
			name: "unable to write role to DB",
			message: `error settig new role to ${member.id}`,
		};
	};
	if(!keepXP){
		try {
			await DBResetXP(member.id);
		} catch (err) {
			console.error(`Error resetting XP for user ${member.displayName}: ${err.message}`);
		}
		try{
			const endowingMerchants = await CacheGetEndows(member.id);
			if (endowingMerchants.length > 0) {
				for (const merchantId of endowingMerchants) {
					const currentXP = await CacheGetUserXP(merchantId);
					await DBUpdateXP(merchantId, - EndowPenalty*currentXP, member.guild.client);
					await CacheClearEndow(merchantId, member.id);
					const merchantMember = await member.guild.members.cache.get(merchantId);
					eventEmitter.emit("NotifyMerchantChannel", `The endow by to ${member.displayName} has vaporized, they failed. The stream has given ${merchantMember.displayName} a penalty of ${EndowPenalty*currentXP} drops.`);
				}
			}
		}catch(err) {
			console.error(`Error getting endowing merchants for user ${member.displayName}: ${err.message}`);
		}
	};
	try {
		await member.roles.remove(memberRole);
	} catch (err) {
		throw {
			name: "RoleChangeError",
			message: `Error removing ${memberRole.name} role for user ${member.displayName}: ${err.message}`,
		};
	}
	try {
		await member.roles.add(role);
	} catch (err) {
		throw {
			name: "RoleChangeError",
			message: `Error adding ${roleName} role for user ${member.displayName}: ${err.message}`,
		};
	}
	if(roleName === "Emperor" || roleName === "King" || roleName === "Lord" || roleName === "Noble" || roleName === "Knight") {
		try{
			await evaluateThresholds(member.client);
		}catch(err) {
			console.error(`Error evaluating thresholds after role change: ${err.message}`);
		}
	}

	console.log(`Assigned "${roleName}" role to ${member.displayName}`);
}
async function startupOpenEmperorThreshold(client) {
	const guild = await client.guilds.fetch(process.env.GUILDID);
	await guild.members.fetch();

	const emperorCount = guild.members.cache.filter((m) =>
		m.roles.cache.has(process.env.ROLEID_EMPEROR)
	).size;


	if (emperorCount === 0 && !isThresholdOpen(12)) {
		await openThreshold(12, client);

	}
}
async function evaluateThresholds(client) {
	const guild = await client.guilds.fetch(process.env.GUILDID);
	await guild.members.fetch();

	const emperorMembers = await guild.members.cache.filter((m) =>
		m.roles.cache.has(process.env.ROLEID_EMPEROR)
	);

	const shouldOpen = emperorMembers.size === 0;


	if(!shouldOpen && isThresholdOpen(12)) {
		closeThreshold(12);

		eventEmitter.emit("FirstEnthronement", emperorMembers.first().displayName);

	}	
	const kingCount = guild.members.cache.filter((m) =>
		m.roles.cache.has(process.env.ROLEID_KING)
	).size;


	if (kingCount < MinimumKingSize && !isThresholdOpen(11)) {
		await openThreshold(11, client);

	} else if (kingCount >= MinimumKingSize && isThresholdOpen(11)) {
		closeThreshold(11);
	}	
	const lordCount = guild.members.cache.filter((m) =>
		m.roles.cache.has(process.env.ROLEID_LORD)
	).size;


	if (lordCount < MinimumLordSize && !isThresholdOpen(10)) {
		await openThreshold(10, client);

	} else if (lordCount >= MinimumLordSize && isThresholdOpen(10)) {
		closeThreshold(10);
	}	
	const nobleCount = guild.members.cache.filter((m) =>
		m.roles.cache.has(process.env.ROLEID_NOBLE)
	).size;


	if (nobleCount < MinimumNobleSize && !isThresholdOpen(9)) {
		await openThreshold(9, client);

	} else if (nobleCount >= MinimumNobleSize && isThresholdOpen(9)) {
		closeThreshold(9);
	}	

	const knightCount = guild.members.cache.filter((m) =>
		m.roles.cache.has(process.env.ROLEID_KNIGHT)
	).size;


	if (knightCount < MinimumKnightSize && !isThresholdOpen(8)) {
		await openThreshold(8, client);

	} else if (knightCount >= MinimumKnightSize && isThresholdOpen(8)) {
		closeThreshold(8);
	}	

}
module.exports = { CacheDataFromDB, CacheAllUserXP, CacheFesteringUsers , DBGetUsers, DBGetUserById, DBAddUser, DBRemoveUser, DBUpdateXP, DBSetRole, DBGetLastXPBoostTime, DBSetLastXPBoostTime, DBBoostXPForAllUsers, DBResetXP, DBSetFestering, DBGetActiveFestering, DBClearFestering, DBGetFestering, isThresholdOpen,changeRole, startupOpenEmperorThreshold, evaluateThresholds, openThreshold, closeThreshold }
