const { StringSelectMenuBuilder } = require("discord.js");
const { XpBoostInterval, XpBoostValue, AstralRealmAccessDuration } = require("../game_config.json");
const {
	DBGetLastXPBoostTime,
	DBBoostXPForAllUsers,
} = require("../apis/firebase/querys.js");

function wait(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

//XP handling

let keepBoosting = true;

function stopBoosting() {
	keepBoosting = false;
}

async function scheduledXpBoost(timeUntilNextBoost, client) {
	console.log(`waiting ${timeUntilNextBoost / 1000} sec to sync XP boost`);
	await wait(timeUntilNextBoost);
	while (keepBoosting) {
		console.log("Synced! Applying XP boost to all users...");
		try {
			await DBBoostXPForAllUsers(XpBoostValue, client);
		} catch (err) {
			console.error(`error boosting XP for all users ${err.message}`);
			// throw err;
		}
		await wait(XpBoostInterval);
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
				await DBBoostXPForAllUsers(boostsMissed * XpBoostValue, client);
			} catch (err) {
				console.error("DB: XPboost failed");
			}
			console.log(
				`updated with ${
					boostsMissed * XpBoostValue
				} XP for ${boostsMissed} minutes missed`
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
	await guild.members.fetch();
	let roleIds = roleNames.map(
		(roleName) => process.env[`ROLEID_${roleName.toUpperCase()}`]
	);
	let textChooseMember = `Choose a ${roleNames.join(" | ")}`;
	if (chooseText) textChooseMember = chooseText.toString();
	let textNoMembers = `No ${roleNames.join(" | ")}`;
	let disabledValue = "no_data";

	let members = [];
	for (let roleId of roleIds) {
		let roleMembers = guild.members.cache
			.filter((member) => member.roles.cache.has(roleId))
			.map((member) => ({ label: member.user.username, value: member.id }));
		members = members.concat(roleMembers);
	}
	console.log(`-----Fetched ${roleNames.join("|")}`, members);
	return new StringSelectMenuBuilder()
		.setCustomId(customId)
		.setPlaceholder(members.length > 0 ? textChooseMember : textNoMembers)
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
async function grantAstralRealmAccess(member, client) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDASTRALREALM);
		await channel.permissionOverwrites.create(member, {
			ViewChannel: true,
			SendMessages: true,
		});

		// Schedule permission removal
		setTimeout(async () => {
			try {
				await revokeAstralRealmAccess(member, client);
				const scholarChannel = await client.channels.fetch(process.env.CHANNELIDSCHOLAR);
				await scholarChannel.send({
					content: `${member.user.username}, your access to the astral realm has expired.`,
					ephemeral: true
				});
			} catch (err) {
				console.error('Error revoking astral realm access:', err);
			}
		}, AstralRealmAccessDuration);

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
	scheduledXpBoost,
	stopBoosting,
	checkAndApplyMissedXPBoost,
	buildSelectMenu,
	sendInteractionReply,
	grantAstralRealmAccess,
};
