const { eventEmitter } = require("../functions/eventEmitter.js");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const {
	checkAndApplyMissedXPBoost,
	scheduledXpBoost,
	grantAstralRealmAccess,
	sendInteractionReply
} = require("../functions/botActions");
const {
	DBAddUser,
	DBRemoveUser,
	DBClearFestering,
	DBSetRole,
	DBResetXP,
} = require("../apis/firebase/querys.js");
const {
	CacheIsPoopBeingFestered,
	CacheGetFesteringTarget,
	CacheGetCooldown,
	CacheSetCooldown,
	CacheGetUserXP
} = require("../apis/redis/redisCache.js");
const {
	RevolutionFirstPhaseTime,
	RevolutionSecondPhaseTime,
	RevolutionKillKnight,
	RevolutionKillNoble,
	RevolutionKillLord,
	RevolutionKillKing,
	RevolutionKillEmperor,
	RevolutionEmperorElectionTime,
	RevolutionKnightWeight,
	CoupKillNoble,
	CoupKillLord,
	CoupKillKing,
	CoupKillEmperor,
	CoupFirstPhaseTime,
	CoupSecondPhaseTime,
	ScholarAstralRealmCooldown,
	EmperorAstralRealmCooldown,
	CheckXpCooldown,
	TextConsoleMessageContent,
	ButtonLabelCheckXP,
	ButtonLabelDivination
} = require("../game_config.json");

let revolutionarySize = 0;
let peopleSize = 0;
let peasantSize = 0;
let scholarSize = 0;
let merchantSize = 0;
let knightSize = 0;
let peasantParticipants = 0;
let scholarParticipants = 0;
let merchantParticipants = 0;
let knightParticipants = 0;
let revolutionTimeout;
let revolutionSecondPhase = false;
let emperorElectionActive = false;
let botCallCounts = 0;
let coupActive = false;

let struggleMethod = "Revolution";

const REVOLUTIONTHREADSHOLD = 0.6;
const REVOLUTIONTHREADSHOLD2 = 0.4;
const COUPTHREADSHOLD = 0.5;


const content = TextConsoleMessageContent;

function showErrorMsg(err) {
	console.error("ERROR: console_commands.js", err);
}

async function setupConsoleBotEvents(client) {
	eventEmitter.on("startXpBoost", async () => {
		console.log(
			`Proceeding to update XP missed in downtime`
		);
		let timeUntilNextBoost = 0;
		try {
			timeUntilNextBoost = await checkAndApplyMissedXPBoost(client);
		} catch (err) {
			console.error(`DB: An error occured: ${err.message}`);
			throw err;
		}
		try {
			await scheduledXpBoost(timeUntilNextBoost, client);
		} catch (error) {
			console.error(`DB: An error occurred: ${err.message}`);
			throw err;
		}
	});

	client.on("guildMemberRemove", async (member) => {
		const isFesteredByMaggot = await CacheIsPoopBeingFestered(member.id);
		if (isFesteredByMaggot) {
			await DBClearFestering(isFesteredByMaggot.maggotId);
			console.log(
				`Succesfully removed festering data removed member poop with id ${member.id}`
			);
		}
		const isFesterMaggot = await CacheGetFesteringTarget(member.id);
		if (isFesterMaggot) {
			await DBClearFestering(member.id);
			console.log(
				`Succesfully removed festering data removed member maggot with id ${member.id}`
			);
		}
		try {
			await DBRemoveUser(member);
		} catch (error) {
			console.error(
				`An error occurred: ${error.message}, couldn't remove ${member.user.username} from the DB`
			);
		}
	});
	client.on("guildMemberAdd", async (member) => {
		try {
			await member.roles.add(
				member.guild.roles.cache.find((r) => r.name === "Poop")
			);
			await DBAddUser(member);
			const channel = await client.channels.fetch(process.env.CHANNELIDSEWERS);
			if (!channel) {
				throw {
					name: "ChannelNotFound",
					message: `Channel with ID "${process.env.CHANNELIDSEWERS}" not found`,
				};
			}
			await channel.send(`welcome to the sewers, ${member.user.username}!`);
		} catch (error) {
			console.error(`An error occurred: ${error.message}`);
		}
	});
	client.on("messageCreate", async (message) => {
		// Ignore messages from bots
		if (message.author.bot) return;
		// Check if the message starts with the command prefix
		if (message.content.startsWith("!changerole")) {
			const args = message.content.split(" ").slice(1);
			await handleAdminRoleChange(client, message, args);
		}
	});
	eventEmitter.on("changeRole", async (memberId, roleName, keepXP) => {
		try {
			const guild = await client.guilds.fetch(process.env.GUILDID);
			if (!guild) {
				console.error("Guild not found");
				return;
			}
			const member = await guild.members.fetch(memberId);
			if (!member) {
				console.error("Member not found");
				return;
			}
			await changeRole(member, roleName, keepXP);
		} catch (err) {
			throw err;
		}
	});
	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isButton()) return;
		if(interaction.customId === "CheckXP"){
			try{
				const userId = interaction.user.id;
				const cooldown = await CacheGetCooldown("CheckXP", userId);
				if(cooldown){
					await sendInteractionReply(
						interaction,
						"You can only check your XP so often..."
					);
					return;

				}
				const userXP = await CacheGetUserXP(userId);
				await CacheSetCooldown("CheckXP", userId, CheckXpCooldown);
				await sendInteractionReply(interaction, `You currently have ${userXP} XP`);
			}catch(err){
				showErrorMsg(err);
			}
		}
		if(interaction.customId == "Divination"){
			try{
				const userId = interaction.user.id;
				const hasRoleScholar = await interaction.member.roles.cache.has(process.env.ROLEID_SCHOLAR);
				const hasRoleEmperor = await interaction.member.roles.cache.has(process.env.ROLEID_EMPEROR);
				if(!hasRoleScholar && !hasRoleEmperor){
					await sendInteractionReply(
						interaction,
						"Only Emperors and Scholars can enter the Astral Realm"
					);
					return;
				}
				let divinationType;
				if(hasRoleEmperor){
					divinationType = "emperor"
				}else{
					divinationType = "scholar"	
				}
				const cooldown = await CacheGetCooldown("AstralRealm", userId);
				if (cooldown) {
					await sendInteractionReply(
						interaction,
						"Your spirit is not yet ready to reenter the astral realm."
					);
					return;
				}
				const success = await grantAstralRealmAccess(interaction.member, client, divinationType);
				if (success) {
					if(divinationType = "scholar"){
						await CacheSetCooldown("AstralRealm", userId, ScholarAstralRealmCooldown);
						await sendInteractionReply(
							interaction,
							"You have been granted temporary access to the astral realm. As a scholar you can only listen."
						);
					}else{
						await CacheSetCooldown("AstralRealm", userId, EmperorAstralRealmCooldown);
						await sendInteractionReply(
							interaction,
							"You have been granted temporary access to the astral realm. As devine emperor, you can speak to the gods."
						);
					}
				} else {
					await sendInteractionReply(
						interaction,
						"Failed to grant access to the astral realm."
					);
				}
			}catch(err){
				showErrorMsg(err);
			}
		}
	});

	// Send message to the royal castle
	eventEmitter.on("sendMessageToRoyalCastle", async (memberId, message) => {
		try {
			const guild = await client.guilds.fetch(process.env.GUILDID);
			if (!guild) {
				console.error("Guild not found");
				return;
			}
			const member = await guild.members.fetch(memberId);
			if (!member) {
				console.error("Member not found");
				return;
			}
			const roaylCastleChannel = await client.channels.fetch(
				process.env.CHANNELIDROYALCASTLE
			);
			roaylCastleChannel.send(`${member.user.username}: ${message}`);
		} catch (err) {
			throw err;
		}
	});

	eventEmitter.on("StartRevolution", async () => {
		try {
			eventEmitter.emit("RevolutionStarted");
			setTimeout(async () => {
				await handleFirstPhaseRevolutionEnd();
			}, RevolutionFirstPhaseTime);
		} catch (err) {
			throw err;
		}
	});

	eventEmitter.on("StartCoup", async () => {
		try {
			coupActive = true;
			struggleMethod = "Coup";
			eventEmitter.emit("CoupStarted");
			setTimeout(async () => {
				await handleFirstPhaseRevolutionEnd();
			}, CoupFirstPhaseTime);
		} catch (err) {
			throw err;
		}
	});

	eventEmitter.on(
		"SendRevolutionStatus",
		async (hierachy, participants, groupSize) => {
			try {
				switch (hierachy) {
					case "Peasant":
						peasantParticipants = participants;
						peasantSize = groupSize;
						botCallCounts++;
						break;
					case "Merchant":
						merchantParticipants = participants;
						merchantSize = groupSize;
						botCallCounts++;
						break;
					case "Scholar":
						scholarParticipants = participants;
						scholarSize = groupSize;
						botCallCounts++;
						break;
					case "Knight":
						knightParticipants = participants;
						knightSize = groupSize;
						botCallCounts++;
						break;
				}

				revolutionarySize =
					Object.keys(peasantParticipants).length +
					Object.keys(scholarParticipants).length +
					Object.keys(merchantParticipants).length +
					Object.keys(knightParticipants).length;
				peopleSize = peasantSize + merchantSize + scholarSize + knightSize;
				if (revolutionSecondPhase && !emperorElectionActive) {
					let success = revolutionarySize / peopleSize > REVOLUTIONTHREADSHOLD2;
					if (coupActive)
						success = revolutionarySize / peopleSize > COUPTHREADSHOLD;

					if (!success) {
						clearTimeout(revolutionTimeout);
						notifyRevolutionResult(
							`${struggleMethod} failed because of insufficient number of participants.`
						);
						await resetRevolution();
						eventEmitter.emit(`${struggleMethod}Finished`);
						return;
					}
				}

				if (coupActive || botCallCounts >= 4) {
					eventEmitter.emit(
						"UpdateRevolutionStatus",
						revolutionarySize,
						peopleSize
					);
				}
			} catch (err) {
				throw err;
			}
		}
	);


}

async function handleFirstPhaseRevolutionEnd() {
	let success = revolutionarySize / peopleSize > REVOLUTIONTHREADSHOLD;
	if (coupActive) success = revolutionarySize / peopleSize > COUPTHREADSHOLD;
	if (success) {
		notifyRevolutionResult(`${struggleMethod} moved in the second phase.`);
		revolutionSecondPhase = true;
		eventEmitter.emit("RevolutionMovedInSecondPhase");
		if (coupActive) {
			revolutionTimeout = setTimeout(async () => {
				await handleSecondPhaseRevolutionEnd();
			}, CoupSecondPhaseTime);
		} else {
			revolutionTimeout = setTimeout(async () => {
				await handleSecondPhaseRevolutionEnd();
			}, RevolutionSecondPhaseTime);
		}
	} else {
		notifyRevolutionResult(`${struggleMethod} Failed.`);
		eventEmitter.emit(`${struggleMethod}Finished`);
		resetRevolution();
	}
}

async function resetRevolution() {
	revolutionarySize = 0;
	peopleSize = 0;
	peasantSize = 0;
	scholarSize = 0;
	merchantSize = 0;
	knightSize = 0;
	peasantParticipants = 0;
	scholarParticipants = 0;
	merchantParticipants = 0;
	knightParticipants = 0;
	revolutionSecondPhase = false;
	emperorElectionActive = false;
	botCallCounts = 0;
	coupActive = false;
	struggleMethod = "Revolution";
}

async function handleSecondPhaseRevolutionEnd() {
	const refinedTargets = {};
	const revolutionParticipants = {
		...peasantParticipants,
		...knightParticipants,
		...scholarParticipants,
		...merchantParticipants,
	};
	const civilParticipants = {
		...peasantParticipants,
		...scholarParticipants,
		...merchantParticipants,
	};
	Object.keys(revolutionParticipants).forEach((userId) => {
		const targetId = revolutionParticipants[userId].user.id;
		let targetedNumber = 0;
		Object.keys(civilParticipants).forEach((otherUserId) => {
			const otherTargetId = civilParticipants[otherUserId].user.id;
			if (targetId === otherTargetId) targetedNumber++;
		});
		Object.keys(knightParticipants).forEach((otherUserId) => {
			const otherTargetId = knightParticipants[otherUserId].user.id;
			if (targetId === otherTargetId) {
				if (coupActive) targetedNumber++;
				else targetedNumber += RevolutionKnightWeight;
			}
		});

		if (!refinedTargets[targetId]) {
			refinedTargets[targetId] = {
				targetedNumber,
				target: revolutionParticipants[userId],
			};
		}
	});

	let isEmperorDead = false;
	Object.keys(refinedTargets).forEach(async (targetId) => {
		let killTarget = false;
		if (coupActive) {
			if (
				refinedTargets[targetId].target.roles.cache.has(
					process.env.ROLEID_NOBLE
				) &&
				refinedTargets[targetId].targetedNumber > CoupKillNoble
			)
				killTarget = true;
			if (
				refinedTargets[targetId].target.roles.cache.has(
					process.env.ROLEID_LORD
				) &&
				refinedTargets[targetId].targetedNumber > CoupKillLord
			)
				killTarget = true;
			if (
				refinedTargets[targetId].target.roles.cache.has(
					process.env.ROLEID_KING
				) &&
				refinedTargets[targetId].targetedNumber > CoupKillKing
			)
				killTarget = true;
			if (
				refinedTargets[targetId].target.roles.cache.has(
					process.env.ROLEID_EMPEROR
				) &&
				refinedTargets[targetId].targetedNumber > CoupKillEmperor
			) {
				killTarget = true;
				isEmperorDead = true;
			}
		} else {
			if (
				refinedTargets[targetId].target.roles.cache.has(
					process.env.ROLEID_KNIGHT
				) &&
				refinedTargets[targetId].targetedNumber > RevolutionKillKnight
			)
				killTarget = true;
			if (
				refinedTargets[targetId].target.roles.cache.has(
					process.env.ROLEID_NOBLE
				) &&
				refinedTargets[targetId].targetedNumber > RevolutionKillNoble
			)
				killTarget = true;
			if (
				refinedTargets[targetId].target.roles.cache.has(
					process.env.ROLEID_LORD
				) &&
				refinedTargets[targetId].targetedNumber > RevolutionKillLord
			)
				killTarget = true;
			if (
				refinedTargets[targetId].target.roles.cache.has(
					process.env.ROLEID_KING
				) &&
				refinedTargets[targetId].targetedNumber > RevolutionKillKing
			)
				killTarget = true;
			if (
				refinedTargets[targetId].target.roles.cache.has(
					process.env.ROLEID_EMPEROR
				) &&
				refinedTargets[targetId].targetedNumber > RevolutionKillEmperor
			) {
				killTarget = true;
				isEmperorDead = true;
			}
		}

		if (killTarget) {
			const target = refinedTargets[targetId].target;
			eventEmitter.emit("changeRole", target, "Poop");
			await notifyRevolutionResult(
				`@${target.user.username} has been killed by ${struggleMethod}.`
			);
		}
	});

	if (isEmperorDead) {
		notifyRevolutionResult("The emperor is dead. Let's vote for new emperor.");
		emperorElectionActive = true;
		peasantParticipants = {};
		scholarParticipants = {};
		merchantParticipants = {};
		knightParticipants = {};
		revolutionarySize = 0;
		peopleSize = 0;
		peasantSize = 0;
		scholarSize = 0;
		merchantSize = 0;
		knightSize = 0;
		eventEmitter.emit("RevolutionMovedInEmperorElection");
		setTimeout(async () => {
			await handleEmperorElectionEnd();
		}, RevolutionEmperorElectionTime);
	} else {
		eventEmitter.emit(`${struggleMethod}Finished`);
		notifyRevolutionResult(`${struggleMethod} Finished.`);
		resetRevolution();
	}
}

async function handleEmperorElectionEnd() {
	const emperorElectionParticipants = {
		...peasantParticipants,
		...scholarParticipants,
		...merchantParticipants,
		...knightParticipants,
	};
	const civilParticipants = {
		...peasantParticipants,
		...scholarParticipants,
		...merchantParticipants,
	};
	const refinedCandidates = {};
	let maximumVotes = 0;
	Object.keys(emperorElectionParticipants).forEach((userId) => {
		const candidateId = emperorElectionParticipants[userId].user.id;
		let votes = 0;
		Object.keys(civilParticipants).forEach((otherUserId) => {
			const otherCandidateId = civilParticipants[otherUserId].user.id;
			if (candidateId === otherCandidateId) votes++;
		});
		Object.keys(knightParticipants).forEach((otherUserId) => {
			const otherCandidateId = knightParticipants[otherUserId].user.id;
			if (candidateId === otherCandidateId) votes += RevolutionKnightWeight;
		});

		refinedCandidates[candidateId] = {
			votes,
			candidate: emperorElectionParticipants[userId],
		};
		if (votes > maximumVotes) maximumVotes = votes;
	});

	let maxCandidates = [];
	Object.keys(refinedCandidates).forEach(async (candidateId) => {
		if (refinedCandidates[candidateId].votes === maximumVotes)
			maxCandidates.push(refinedCandidates[candidateId].candidate);
	});

	if (maxCandidates.length === 1) {
		const target = maxCandidates[0];
		eventEmitter.emit("changeRole", target, "Emperor");
		notifyRevolutionResult(
			`Congrats! @${target.user.username} has been elected as a new emperor.`
		);
		eventEmitter.emit(`${struggleMethod}Finished`);
		await resetRevolution();
	} else if (maxCandidates.length > 1) {
		notifyRevolutionResult(
			`${maxCandidates.length} candidates have same votes. Starting reelection...`
		);
		const candidates = maxCandidates.map((candidate) => ({
			label: candidate.user.username,
			value: candidate.id,
		}));
		peasantParticipants = {};
		scholarParticipants = {};
		merchantParticipants = {};
		knightParticipants = {};
		revolutionarySize = 0;
		peopleSize = 0;
		peasantSize = 0;
		scholarSize = 0;
		merchantSize = 0;
		knightSize = 0;
		eventEmitter.emit("RevolutionMovedInEmperorReelection", candidates);

		setTimeout(async () => {
			await handleEmperorElectionEnd();
		}, RevolutionEmperorElectionTime);
	} else {
		notifyRevolutionResult(
			`No one participated in election! Let's vote a new emperor.`
		);
		peasantParticipants = {};
		scholarParticipants = {};
		merchantParticipants = {};
		knightParticipants = {};
		revolutionarySize = 0;
		peopleSize = 0;
		peasantSize = 0;
		scholarSize = 0;
		merchantSize = 0;
		knightSize = 0;
		eventEmitter.emit("RevolutionMovedInEmperorElection");
		setTimeout(async () => {
			await handleEmperorElectionEnd();
		}, RevolutionEmperorElectionTime);
	}
}

async function notifyRevolutionResult(message) {
	eventEmitter.emit("NotifyPeasantChannel", message);
	eventEmitter.emit("NotifyKnightChannel", message);
	eventEmitter.emit("NotifyMerchantChannel", message);
	eventEmitter.emit("NotifyScholarChannel", message);
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
			throw {
				name: "RoleChangeError",
				message: `Couldn't reset XP for user ${member.displayName}:${err.message}`,
			};
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

	console.log(`Assigned "${roleName}" role to ${member.displayName}`);
}

async function handleAdminRoleChange(client, message, args) {
	// Check if the user has admin privileges
	if (!message.member.permissions.has("ADMINISTRATOR")) {
		return message.reply("You do not have permission to use this command.");
	}

	// Check if the command has the correct number of arguments
	if (args.length !== 2) {
		return message.reply("Usage: !changerole <user_id> <new_role_name>");
	}

	const [userId, newRoleName] = args;

	try {
		const guild = await client.guilds.fetch(process.env.GUILDID);
		if (!guild) {
			console.error("Guild not found");
			return;
		}
		const member = await guild.members.fetch(userId);
		const role = await guild.roles.cache.some(
			(role) => role.name === newRoleName
		);
		if (!role && !member) {
			message.reply("role or member ID does not exist");
			return;
		}
		eventEmitter.emit("changeRole", userId, newRoleName);
		message.reply(`changing role for user ${userId} to ${newRoleName}...`);
	} catch (error) {
		console.error("Error in handleAdminRoleChange:", error);
		message.reply("An error occurred while processing the command.");
	}
} 
async function messageConsoleCommands(client) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDCONSOLE);

		const buttonRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("CheckXP")
			.setLabel(ButtonLabelCheckXP)
			.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
			.setCustomId("Divination")
			.setLabel(ButtonLabelDivination)
			.setStyle(ButtonStyle.Primary)
		);

		const message = await channel.send({
			content: content,
			components: [buttonRow],
		});
		return message;	

	} catch (err) {
		showErrorMsg(err);
	}
}



module.exports = { setupConsoleBotEvents, messageConsoleCommands };
