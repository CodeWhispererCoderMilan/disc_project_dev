const { StringSelectMenuBuilder } = require("discord.js");
const { XpBoostInterval, ScholarAstralRealmAccessDuration, EmperorAstralRealmAccessDuration} = require("../game_config.json");
const {
	DBGetLastXPBoostTime,
	DBBoostXPForAllUsers,
	startupOpenEmperorThreshold,
	evaluateThresholds
} = require("../apis/firebase/querys.js");
const{
	CacheGetUsersByRoles
} = require("../apis/redis/redisCache.js");
function wait(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}



async function scheduledXpBoost(timeUntilNextBoost, client, iterations = Infinity) {
	
	console.log(`waiting ${timeUntilNextBoost / 1000} sec to sync XP boost`);
	await wait(timeUntilNextBoost);
	let i = 0;
	while (i<iterations) {
		console.log("Synced! Applying XP boost to all users...");
		try {
			await DBBoostXPForAllUsers(1, client);
			await wait(XpBoostInterval);
			i++;
		} catch (err) {
			console.error(`error boosting XP for all users ${err.message}`);
		}
	}
}

async function checkAndApplyMissedXPBoost(client) {
	const now = Date.now();
	try {
		let lastXpBoostTime = await DBGetLastXPBoostTime();
		if (!lastXpBoostTime) {
			console.error("No XP boost time found, assuming first run.");
			return;
		}
		// Assuming 1-hour intervals for XP boost as per your comment
		let missedTime = now - lastXpBoostTime;
		let timeUntilNextBoost = XpBoostInterval - (missedTime % XpBoostInterval);
		if (missedTime >= XpBoostInterval) {
			console.log("Missed XP boost window detected, applying boost...");
			let boostsMissed = Math.trunc(missedTime / XpBoostInterval);
			try {
				await startupOpenEmperorThreshold(client);
			}catch (err) {
				console.error("Error during startupOpenEmperorThreshold:", err.message);
			}
			try{
				await evaluateThresholds(client);
			} catch (err) {
				console.error("Error during evaluateThresholds:", err.message);
			}
			try{
				await DBBoostXPForAllUsers(boostsMissed, client);
			} catch (err) {
				console.error("DB: XPboost failed", err.message);
			}
			console.log(
				`updated XP for ${boostsMissed} boosts missed`
			);
			return timeUntilNextBoost;
		} else {
			console.log("XP boost window not missed.");
			return timeUntilNextBoost;
		}
	} catch (err) {
		console.error(`Error during missed XP boost check: ${err.message}`);
	}
}

async function buildSelectMenu(client, roleNames, customId, chooseText) {
	const guild = await client.guilds.fetch(process.env.GUILDID);
	const usersWithRoles = await CacheGetUsersByRoles(roleNames);
	let textChooseMember = `Choose a ${roleNames.join(" | ")}`;
	if (chooseText) textChooseMember = chooseText.toString();
	let textNoMembers = `No ${roleNames.join(" | ")}`;
	let disabledValue = "no_data";

	const members = usersWithRoles
			.map((member) => ({ label: String(member.username), value: member.id }));
	return new StringSelectMenuBuilder()
		.setCustomId(customId)
		.setPlaceholder(textChooseMember)
		.setDisabled(members.length === 0)
		.addOptions(
			members.length > 0
			? members
			: [
				{
					label: textNoMembers,
					value: disabledValue,
					disabled: true,
				},
			]
		);
}

async function sendInteractionReply(interaction, msg) {
	try {
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp(msg);
		} else {
			await interaction.reply({
				content: msg,
				ephemeral: true,
			});
		}
	} catch (error) {
		console.error("Error sending interaction reply:", error);
	}
}
async function grantAstralRealmAccess(member, client, type) {
	try {
		let writePermission;
		let accessDuration;
		if(type === "scholar"){
			accessDuration = ScholarAstralRealmAccessDuration;
			writePermission = false;
		}else{
			accessDuration = EmperorAstralRealmAccessDuration;
			writePermission = true;
		}
		const channel = await client.channels.fetch(process.env.CHANNELIDASTRALREALM);
		await channel.permissionOverwrites.create(member, {
			ViewChannel: true,
			SendMessages: writePermission,
		});

		// Schedule permission removal
		setTimeout(async () => {
			try {
				await revokeAstralRealmAccess(member, client);
			} catch (err) {
				console.error('Error revoking astral realm access:', err);
			}
		}, accessDuration);

		return true;
	} catch (err) {
		console.error('Error granting astral realm access:', err);
		return false;
	}
}

async function revokeAstralRealmAccess(member, client) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDASTRALREALM);
		await channel.permissionOverwrites.delete(member);
		return true;
	} catch (err) {
		console.error('Error revoking astral realm access:', err);
		return false;
	}
}

// Call this function at the end of your bot initialization process
module.exports = {
	wait,
	scheduledXpBoost,
	buildSelectMenu,
	sendInteractionReply,
	grantAstralRealmAccess,
	revokeAstralRealmAccess,
	checkAndApplyMissedXPBoost,
};
