const {
	StringSelectMenuBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require("discord.js");
const {
	buildSelectMenu,
	sendInteractionReply,
} = require("../functions/botActions");
const {
	CacheGetUserXP,
	CacheSetCooldown,
	CacheGetCooldown,
	CacheGetKnightWrits,
	CacheCheckActiveWrit,
	CacheUpdateWritStatus,
	CacheCheckAndUpdateUserWrits,
} = require("../apis/redis/redisCache");
const {
	CutDownCost,
	CutDownCooldown,
	
	RoleChangeMessageDisplayTime,
	MinimumKnightSize,
	TextKnightMessageContent,
	TextCutDownSelectMenu,
	TextRevolutionTargetSelectMenu,
	TextCoupTargetSelectMenu,
	TextEmperorCandidateSelectMenu,
	ButtonLabelCoup,
	ButtonLabelRevolution,
	ButtonLabelCutDown,
	ButtonLabelVoteEmperor,
	ButtonLabelWithdrawRevolution,
	ButtonLabelJoinCoup,
	ButtonLabelJoinSiege,
	ButtonLabelJoinRevolution,
	ButtonLabelShowWrits,
} = require("../game_config.json");
const { DBUpdateXP, isThresholdOpen, changeRole, openThreshold, closeThreshold } = require("../apis/firebase/querys.js");
const { eventEmitter } = require("../functions/eventEmitter.js");
const gameState = require("../game_state.js");

let selectedTargets = {};
let knights = [];
let knightsSize = 0;
let kingsSize = 0;
let siegeInitiator = null;
let siegeTarget = null;
let siegeActive = false;
let siegeParticipants = new Set();
let siegeTimeout;
let selectedRevolutionTargets = {};
let selectedCoupTargets = {};
const initContent = TextKnightMessageContent;
let siegeStatusMsg = "";
let revolutionStatusMsg = "";

function showErrorMsg(err) {
	console.error("ERROR: knight_commands.js", err);
}

async function setupKnightBotEvents(client, lastMessageId) {
	eventEmitter.on("DisableRevolution", async () => {
		if(!gameState.isRevolutionActive() && !gameState.isCoupActive()) await updateMessage(client, lastMessageId);
	});
	eventEmitter.on("EnableRevolution", async () => {
		if(!gameState.isRevolutionActive() && !gameState.isCoupActive()) await updateMessage(client, lastMessageId);
	});	
	eventEmitter.on("DisableCoup", async () => {
		if(!gameState.isRevolutionActive() && !gameState.isCoupActive()) await updateMessage(client, lastMessageId);
	});
	eventEmitter.on("EnableCoup", async () => {
		if(!gameState.isRevolutionActive() && !gameState.isCoupActive()) await updateMessage(client, lastMessageId);
	});
	client.on("guildMemberRemove", async (member) => {
		const hadRoleBeforePeasant = member.roles.cache.has(
			process.env.ROLEID_PEASANT
		);
		const hadRoleBeforeScholar = member.roles.cache.has(
			process.env.ROLEID_SCHOLAR
		);
		const hadRoleBeforeMerchant = member.roles.cache.has(
			process.env.ROLEID_MERCHANT
		);
		const hadRoleBeforeKnight = member.roles.cache.has(
			process.env.ROLEID_KNIGHT
		);
		const hadRoleBeforeKing = member.roles.cache.has(
			process.env.ROLEID_KING
		);
		const hadRoleBeforeNoble = member.roles.cache.has(
			process.env.ROLEID_NOBLE
		);
		const hadRoleBeforeLord = member.roles.cache.has(
			process.env.ROLEID_LORD
		);
		const hadRoleBeforeEmperor = member.roles.cache.has(
			process.env.ROLEID_EMPEROR
		);

		if( hadRoleBeforeKnight){
			const guild = await client.guilds.fetch(process.env.GUILDID);
			knights = guild.members.cache.filter((member) =>
				member.roles.cache.has(process.env.ROLEID_KNIGHT)
			);
			knightsSize = knights.size;
			if(knightsSize < MinimumKnightSize && !isThresholdOpen(8)){
				await openThreshold(8, client);
			}
			await CacheCheckAndUpdateUserWrits(oldMember.id);


		}
		if (
			hadRoleBeforePeasant ||
			hadRoleBeforeScholar ||
			hadRoleBeforeMerchant ||
			hadRoleBeforeNoble ||
			hadRoleBeforeLord ||
			hadRoleBeforeKing ||
			hadRoleBeforeKnight
		) {
			if(!hadRoleBeforeKnight)await CacheCheckAndUpdateUserWrits(member.id);
			for (let userId in selectedTargets) {
				if (
					selectedTargets[userId] &&
					selectedTargets[userId].id === member.id
				) {
					delete selectedTargets[userId];
					console.log(
						`Removed ${member.user.username} from Cut Dowm targets`
					);
				}
			}
		}
		if (
			hadRoleBeforePeasant ||
			hadRoleBeforeScholar ||
			hadRoleBeforeMerchant ||
			hadRoleBeforeNoble ||
			hadRoleBeforeLord ||
			hadRoleBeforeEmperor ||
			hadRoleBeforeKnight
		) {
			await updateMessage(client, lastMessageId);
		}


	});
	client.on("guildMemberUpdate", async (oldMember, newMember) => {
		const hadRoleBeforePeasant = oldMember.roles.cache.has(
			process.env.ROLEID_PEASANT
		);
		const hasRoleNowPeasant = newMember.roles.cache.has(
			process.env.ROLEID_PEASANT
		);
		const hadRoleBeforeScholar = oldMember.roles.cache.has(
			process.env.ROLEID_SCHOLAR
		);
		const hasRoleNowScholar = newMember.roles.cache.has(
			process.env.ROLEID_SCHOLAR
		);
		const hadRoleBeforeMerchant = oldMember.roles.cache.has(
			process.env.ROLEID_MERCHANT
		);
		const hasRoleNowMerchant = newMember.roles.cache.has(
			process.env.ROLEID_MERCHANT
		);
		const hadRoleBeforeKnight = oldMember.roles.cache.has(
			process.env.ROLEID_KNIGHT
		);
		const hasRoleNowKnight = newMember.roles.cache.has(
			process.env.ROLEID_KNIGHT
		);
		const hadRoleBeforeKing = oldMember.roles.cache.has(
			process.env.ROLEID_KING
		);
		const hasRoleNowKing = newMember.roles.cache.has(process.env.ROLEID_KING);
		const hadRoleBeforeNoble = oldMember.roles.cache.has(
			process.env.ROLEID_NOBLE
		);
		const hasRoleNowNoble = newMember.roles.cache.has(process.env.ROLEID_NOBLE);
		const hadRoleBeforeLord = oldMember.roles.cache.has(
			process.env.ROLEID_LORD
		);	
		const hasRoleNowLord = newMember.roles.cache.has(process.env.ROLEID_LORD);
		const hadRoleBeforeEmperor = oldMember.roles.cache.has(
			process.env.ROLEID_EMPEROR
		);
		const hasRoleNowEmperor = newMember.roles.cache.has(
			process.env.ROLEID_EMPEROR
		);

		if( hadRoleBeforeKnight || hasRoleNowKnight){
			const guild = await client.guilds.fetch(process.env.GUILDID);
			knights = guild.members.cache.filter((member) =>
				member.roles.cache.has(process.env.ROLEID_KNIGHT)
			);
			const knightsSize = knights.size;
			if(knightsSize < MinimumKnightSize && !isThresholdOpen(8)){
				await openThreshold(8, client);
			}
			if(knightsSize >= MinimumKnightSize && isThresholdOpen(8)){
				closeThreshold(8);
			}
			await CacheCheckAndUpdateUserWrits(oldMember.id);

		}
		if (
			hadRoleBeforePeasant ||
			hadRoleBeforeScholar ||
			hadRoleBeforeMerchant ||
			hadRoleBeforeNoble ||
			hadRoleBeforeLord ||
			hadRoleBeforeKing ||
			hadRoleBeforeKnight
		) {
			if(!hadRoleBeforeKnight)await CacheCheckAndUpdateUserWrits(oldMember.id);
			for (let userId in selectedTargets) {
				if (
					selectedTargets[userId] &&
					selectedTargets[userId].id === oldMember.id
				) {
					delete selectedTargets[userId];
					console.log(
						`Removed ${oldMember.user.username} from Cut Dowm targets`
					);
				}
			}
		}
		if (
			hadRoleBeforePeasant ||
			hadRoleBeforeScholar ||
			hadRoleBeforeMerchant ||
			hadRoleBeforeNoble ||
			hadRoleBeforeLord ||
			hadRoleBeforeEmperor ||
			hasRoleNowPeasant ||
			hasRoleNowScholar ||
			hasRoleNowMerchant ||
			hasRoleNowNoble ||
			hasRoleNowLord ||
			hasRoleNowEmperor ||
			hadRoleBeforeKnight ||
			hasRoleNowKnight
		) {
			await updateMessage(client, lastMessageId);
		}


	});
	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

		if (interaction.customId === "SelectCutDown") {
			const userId = interaction.user.id;
			let selectedTargetId = interaction.values[0];
			try {
				selectedTargets[userId] = await interaction.guild.members.cache.get(
					selectedTargetId
				);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "SelectRevolutionTarget") {
			const userId = interaction.user.id;
			let targetId = interaction.values[0];
			try {
				selectedRevolutionTargets[userId] =
					await interaction.guild.members.cache.get(targetId);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "SelectCoupTarget") {
			const userId = interaction.user.id;
			let targetId = interaction.values[0];
			try {
				selectedCoupTargets[userId] = await interaction.guild.members.cache.get(
					targetId
				);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "SelectEmperorCandidate") {
			const userId = interaction.user.id;
			let selectedCandidateId = interaction.values[0];
			try {
				selectedRevolutionTargets[userId] =
					await interaction.guild.members.cache.get(selectedCandidateId);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "CutDown") {
			const userId = interaction.user.id;

			try {
				if (!selectedTargets[userId]) {
					await sendInteractionReply(interaction, `No scoundrel selected...`);
					return;
				}

				const targetId = selectedTargets[userId].id;
				const targetRoles = selectedTargets[userId].roles.cache;
				const userXP = await CacheGetUserXP(userId);

				// Check if target has a role that requires a writ
				const requiresWrit =
					targetRoles.has(process.env.ROLEID_KNIGHT) ||
					targetRoles.has(process.env.ROLEID_NOBLE) ||
					targetRoles.has(process.env.ROLEID_LORD) ||
					targetRoles.has(process.env.ROLEID_KING);

				if (requiresWrit) {
					// Check for active writs
					const hasWrit2 = await CacheCheckActiveWrit(userId, targetId, 2);
					const hasWrit3 = await CacheCheckActiveWrit(userId, targetId, 3);
					const hasWrit4 = await CacheCheckActiveWrit(userId, targetId, 4);

					let validWrit = null;
					if (hasWrit4) validWrit = 4;
					else if (hasWrit3 && !targetRoles.has(process.env.ROLEID_KING))
						validWrit = 3;
					else if (
						hasWrit2 &&
						!targetRoles.has(process.env.ROLEID_LORD) &&
						!targetRoles.has(process.env.ROLEID_KING) &&
						!targetRoles.has(process.env.ROLEID_KNIGHT)
					)
						validWrit = 2;

					if (!validWrit) {
						await sendInteractionReply(
							interaction,
							"Target only available with appropriate writ"
						);
						return;
					}

					// Execute writ
					await interaction.deferReply({ ephemeral: true });
					await executeCutDown(
						interaction,
						userId,
						targetId,
						client
					);
				} else {
					// No writ required
					const activeWrit = await CacheCheckActiveWrit(userId, targetId);
					if (activeWrit) {
						await interaction.deferReply({ ephemeral: true });	
						await executeCutDown(
							interaction,
							userId,
							targetId,
							client
						);
					} else {
						if (userXP < CutDownCost) {
							await sendInteractionReply(
								interaction,
								`Not enough XP (current XP: ${userXP})`
							);
							return;
						}
						await DBUpdateXP(userId, -CutDownCost, client);
						await performCutDown(interaction, targetId);
						await sendInteractionReply(
							interaction,
							`(${
								userXP - CutDownCost
							} XP left) Cut Down successful with no writ`
						);
					}
				}

				selectedTargets[userId] = null;
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "ShowWrits") {
			await handleShowWrits(interaction);
		}

		if (interaction.customId === "JoinSiege") {
			try {
				if (!gameState.isSiegeActive()) {
					await sendInteractionReply(
						interaction,
						"There is no active siege. The message will sync soon."
					);
					return;
				}

				const userId = interaction.user.id;
				if (gameState.isSiegeParticipant(userId)) {
					await sendInteractionReply(
						interaction,
						"You've already joined this siege."
					);
					return;
				}
				eventEmitter.emit("KnightParticipatedOnSiege", userId);
				await sendInteractionReply(interaction, "You have joind the siege.");
			} catch (err) {
				throw err;
			}
		}

		if (interaction.customId === "Revolution") {
			const userId = interaction.user.id;
			const target = selectedRevolutionTargets[userId];
			if(gameState.isRevolutionActive()){
				await sendInteractionReply(interaction, "Revolution is already active");
				return;
			}
			if (!target) {
				await sendInteractionReply(interaction, "No member selected");
				return;
			}

			let cooldown;
			try {
				cooldown = await CacheGetCooldown("Revolution", "Global");
			} catch (err) {
				showErrorMsg(err);
			}
			if (cooldown) {
				await sendInteractionReply(interaction, "Revolution is on cooldown");
				return;
			}

			if (target.user.id === userId) {
				await sendInteractionReply(interaction, "You cannot target yourself.");
				return;
			}


			try {

				eventEmitter.emit("StartRevolution", userId, target.user.id, "Knight");
				await sendInteractionReply(
					interaction,
					"Revolution started, waiting for others to join."
				);
			} catch (err) {
				showErrorMsg(err);
			}
		}	
		if (interaction.customId === "Coup") {
			const userId = interaction.user.id;
			const target = selectedCoupTargets[userId];
			if(gameState.isCoupActive()){
				await sendInteractionReply(interaction, "Coup is already active");
				return;
			}
			if (!target) {
				await sendInteractionReply(interaction, "No member selected");
				return;
			}

			let cooldown;
			try {
				cooldown = await CacheGetCooldown("Coup", "Global");
			} catch (err) {
				showErrorMsg(err);
			}
			if (cooldown) {
				await sendInteractionReply(interaction, "Coup is on cooldown");
				return;
			}
			try {
				eventEmitter.emit("StartCoup", userId, target.user.id);
				await sendInteractionReply(
					interaction,
					"Coup started, waiting for others to join."
				);
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "JoinRevolution") {
			if(!gameState.isRevolutionActive()){
				await sendInteractionReply(interaction, "No revolution ongoing, messages will sync soon.");
				return;
			}
			const userId = interaction.user.id;
			if (!selectedRevolutionTargets[userId]) {
				await sendInteractionReply(interaction, "No member selected");
				return;
			}

			if (gameState.isRevolutionParticipant(userId)) {
				await sendInteractionReply(
					interaction,
					"You've already joined revolution."
				);
				return;
			}

			const target = selectedRevolutionTargets[userId];

			eventEmitter.emit(
				"AddRevolutionParticipant",
				"Knight",
				userId,
				target.user.id
			);

			await sendInteractionReply(
				interaction,
				`You have joined the revolution with target @${target.user.username}.`
			);
		}
		if (interaction.customId === "JoinCoup") {
			if(!gameState.isCoupActive()){
				await sendInteractionReply(interaction, "No coup ongoing, messages will sync soon.");
				return;
			}
			const userId = interaction.user.id;
			if (!selectedCoupTargets[userId]) {
				await sendInteractionReply(interaction, "No member selected");
				return;
			}

			if (gameState.isRevolutionParticipant(userId) && gameState.isCoupActive()) {
				await sendInteractionReply(interaction, "You've already joined coup.");
				return;
			}

			const target = selectedCoupTargets[userId];

			eventEmitter.emit(
				"AddRevolutionParticipant",
				"Knight",
				userId,
				target.user.id
			);

			await sendInteractionReply(
				interaction,
				`You have joined the coup with target @${target.user.username}.`
			);
		}
		if (interaction.customId === "WithdrawRevolution") {
			if (!gameState.isRevolutionActive()) {
				await sendInteractionReply(
					interaction,
					"No revolution ongoing, messages will sync soon."
				);
				return;
			}
			const userId = interaction.user.id;
			const isRevolutionParticipant = gameState.isRevolutionParticipant(userId);
			if (!isRevolutionParticipant) {
				await sendInteractionReply(
					interaction,
					"You've not joined revolution."
				);
				return;
			}


			eventEmitter.emit(
				"RemoveRevolutionParticipant",
				userId
			);

			await sendInteractionReply(
				interaction,
				`You have withdrawn the revolution`
			);
		}		
		if (interaction.customId === "VoteEmperor") {
			try {
				if (!gameState.isEmperorElectionActive()) {
					await sendInteractionReply(
						interaction,
						"There is no active election to vote."
					);
					return;
				}

				const userId = interaction.user.id;
				if (!selectedRevolutionTargets[userId]) {
					await sendInteractionReply(interaction, "No member selected");
					return;
				}

				if (
					gameState.isRevolutionParticipant(userId)
				) {
					await sendInteractionReply(
						interaction,
						"You've already joined the election."
					);
					return;
				}


				eventEmitter.emit(
					"AddRevolutionParticipant",
					"Knight",
					userId,
					selectedRevolutionTargets[userId].user.id
				);

				await sendInteractionReply(
					interaction,
					"You have joined the election."
				);
			} catch (err) {
				throw err;
			}
		}
	});
	eventEmitter.on("siegeStarted", async () => {
		try {
			await updateMessage(client, lastMessageId);
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("siegeResult", async (message) => {
		try {
			await updateMessage(client, lastMessageId);
			eventEmitter.emit("NotifyKnightChannel", message);

		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("UpdateSiegeMessageKnight", async () => {
		try {
			if (gameState.isSiegeActive()) await updateMessage(client, lastMessageId);
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("NotifyKnightChannel", async (content) => {
		try {
			let channel = await client.channels.fetch(process.env.CHANNELIDKNIGHT);
			const message = await channel.send({
				content,
			});
			setTimeout(async () => {
				await message.delete().catch(console.error);
			}, RoleChangeMessageDisplayTime);
		} catch (err) {
			showErrorMsg(err);
		}
	});


	eventEmitter.on("RevolutionStarted", async () => {
		try {
			if(gameState.isRevolutionActive() && !gameState.isCoupActive() )await updateMessage(client, lastMessageId);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("CoupStarted", async () => {
		try {
			if(gameState.isRevolutionActive() && gameState.isCoupActive())
				await updateMessage(client, lastMessageId);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("CoupFinished", async () => {
		try {
			if(!gameState.isRevolutionActive() && !gameState.isCoupActive()) await updateMessage(client, lastMessageId);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("RevolutionFinished", async () => {
		try {
			if(!gameState.isRevolutionActive())
				await updateMessage(client, lastMessageId);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("RevolutionMovedToSecondPhase", async () => {
		try {
			if(gameState.isRevolutionSecondPhase())
				await updateMessage(client, lastMessageId);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("RevolutionMovedInEmperorElection", async () => {
		try {
			if(gameState.isEmperorElectionActive())
				await updateMessage(client, lastMessageId);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("RevolutionMovedInEmperorReelection", async (emperorReelectionSelectMenu) => {
		try {
			if(gameState.isReelectionActive())
				await updateMessage(client, lastMessageId, emperorReelectionSelectMenu);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("UpdateRevolutionMessage", async () => {
		try {
			if(gameState.isRevolutionActive()) 
				await updateMessage(client, lastMessageId);
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("ElectionEnthronement", async (emperorUsername) => {
		try {
			const channel = await client.channels.fetch(process.env.CHANNELIDKNIGHT);
			const tmpMessage = await channel.send(
				`Hail our new Emperor! ${emperorUsername}, youy have risen to the mountain spring in the spray of revolution, may your rule last 1000 years!`
			);
			setTimeout(() => {
				tmpMessage.delete().catch(showErrorMsg);
			}, 30000);
		} catch (err) {
			showErrorMsg(err);
		}
	});


	eventEmitter.on('ReturnWritReward', async (userId, writAmount) => {
		await DBUpdateXP(userId, writAmount, client); 
	});

}
async function handleShowWrits(interaction) {
	try {
		const knightId = interaction.user.id;
		const writs = await CacheGetKnightWrits(knightId);

		if (writs.length === 0) {
			await sendInteractionReply(interaction, "You have no active writs.");
			return;
		}

		const writDescriptions = writs.map((writ, index) => {
			return `${index + 1}. Type: ${getWritType(writ.writType)}, Target: <@${
				writ.targetId
			}>, Status: ${getWritStatus(writ.writStatus)}, Message: ${
				writ.writMessage
			}, Reward: ${writ.writAmount} drops`;
		});

		const response = `Your active writs:\n\n${writDescriptions.join("\n")}`;

		await sendInteractionReply(interaction, response);
	} catch (error) {
		console.error("Error in handleShowWrits:", error);
		await sendInteractionReply(
			interaction,
			"An error occurred while fetching your writs."
		);
	}
}

function getWritType(writType) {
	switch (writType) {
		case 1:
			return "High";
		case 2:
			return "Eminent";
		case 3:
			return "Royal";
		case 4:
			return "Imperial";
		default:
			throw new Error("Invalid writ type");
	}
}

function getWritStatus(status) {
	switch (status) {
		case 0:
			return "to be executed";
		case 1:
			return "Executed";
		case 2:
			return "Failed";
		case 3:
			return "Anulled, knight or target have changed roles";
		default:
			showErrorMsg("Writ status incorrect");
	}
}

async function executeCutDown(interaction, userId, targetId, client) {
	const cooldown = await CacheGetCooldown("cutdown", userId);
	if (cooldown) {
		await sendInteractionReply(
			interaction,
			"Cut Down is on cooldown and cannot be used"
		);
		return;
	}
	const userXP = await CacheGetUserXP(userId);

	// Get all active writs for this knight and target
	const activeWrits = await CacheGetKnightWrits(userId);
	const relevantWrits = activeWrits.filter(
		(writ) => writ.targetId === targetId && writ.writStatus === 0
	);

	if (relevantWrits.length === 0) {
		// No writs found, proceed with normal Cut Down
		if (userXP < CutDownCost) {
			await sendInteractionReply(
				interaction,
				`Not enough XP (current XP: ${userXP})`
			);
			return;
		}
		await DBUpdateXP(userId, -CutDownCost, client);
		await performCutDown(interaction, targetId);
		await sendInteractionReply(
			interaction,
			`(${userXP - CutDownCost} XP left) Cut Down successful with no writ`
		);
		return;
	}

	// Calculate total XP reward
	let totalXpReward = 0;
	for (const writ of relevantWrits) {
		totalXpReward += writ.writAmount;
		// Update writ status
		await CacheUpdateWritStatus(
			writ.writType,
			writ.writerId,
			userId,
			targetId,
			1
		);
	}

	// Apply XP reward and perform Cut Down
	await DBUpdateXP(userId, parseInt(totalXpReward), client);
	await CacheSetCooldown("cutdown", userId, CutDownCooldown);
	await performCutDown(interaction, targetId);

	const newXP = parseInt(userXP) + totalXpReward;
	const writDetails = relevantWrits
		.map((writ) => `${getWritType(writ.writType)}`)
		.join(", ");
	await sendInteractionReply(
		interaction,
		`(${newXP} XP) Cut Down successful. Executed ${relevantWrits.length} writ(s): ${writDetails}. Total reward: ${totalXpReward} XP`
	);
}

function getWritType(type) {
	switch (type) {
		case 1:
			return "High Writ";
		case 2:
			return "Eminent Writ";
		case 3:
			return "Royal Writ";
		case 4:
			return "Imperial Writ";
		default:
			showErrorMsg("Writ type incorrect");
			return;
	}
}

async function performCutDown(interaction, targetId) {
	const target = await interaction.guild.members.fetch(targetId);
	await changeRole(target, "Poop", false);
	eventEmitter.emit(
		"CutDownComplete",
		target.user.username,
		interaction.user.username
	);
}

async function updateMessage(client, lastMessageId, emperorReelectionSelectMenu) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDKNIGHT);
		const messageToEdit = await channel.messages.fetch(lastMessageId);

		let actionRow_0 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				["peasant", "scholar", "merchant", "noble", "lord", "king", "knight"],
				"SelectCutDown", TextCutDownSelectMenu
			)
		);
		let actionRow_1 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				["knight", "noble", "lord", "king", "emperor"],
				"SelectRevolutionTarget", TextRevolutionTargetSelectMenu
			)
		);
		let actionRow_2 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				["noble", "lord", "king", "emperor"],
				"SelectCoupTarget", TextCoupTargetSelectMenu
			)
		);
		let actionRow_3 = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("CutDown")
			.setLabel(ButtonLabelCutDown)
			.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
			.setCustomId("ShowWrits")
			.setLabel(ButtonLabelShowWrits)
			.setStyle(ButtonStyle.Primary)
		);
		let actionRow_4 = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("Revolution")
			.setLabel(ButtonLabelRevolution)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.getDisableRevolution()),
			new ButtonBuilder()
			.setCustomId("Coup")
			.setLabel(ButtonLabelCoup)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.getDisableCoup())
		);
		const siegeActive = gameState.isSiegeActive();
		if (siegeActive) {
			const joinSiegeBtn = new ButtonBuilder()
				.setCustomId("JoinSiege")
				.setLabel(ButtonLabelJoinSiege)
				.setStyle(ButtonStyle.Danger);
			if (gameState.isRevolutionActive()) {
				if (gameState.isRevolutionSecondPhase && !gameState.isEmperorElectionActive()) 
				actionRow_4.components[3] = joinSiegeBtn;
				else actionRow_4.components[2] = joinSiegeBtn;
			} else {
				actionRow_4.components[2] = joinSiegeBtn;
			}
			const siegeInitiator = gameState.getSiegeInitiator();
			const siegeTarget = gameState.getSiegeTarget();
			const siegeParticipantsSize = gameState.getSiegeParticipantsSize();
			const knightsSize = gameState.getKnightsSize();
			siegeStatusMsg = `\nKing @${siegeInitiator} initiated a siege. Join siege to downgrade ${siegeTarget}. (Joined ${siegeParticipantsSize} / ${knightsSize}.)`;
		}

		if (gameState.isRevolutionActive() && !gameState.isCoupActive()) {
			let revolutionBtn = new ButtonBuilder()
				.setCustomId("JoinRevolution")
				.setLabel(ButtonLabelJoinRevolution)
				.setStyle(ButtonStyle.Danger);
			const coupBtn = new ButtonBuilder()
				.setCustomId("Coup")
				.setLabel(ButtonLabelCoup)
				.setDisabled(true)
				.setStyle(ButtonStyle.Danger);
			revolutionStatusMsg = `\nRevolution washes over the land. (Joined ${gameState.getRevolutionarySize()} / ${gameState.getPeopleSize()}.))`;
			if (gameState.isRevolutionSecondPhase()) {
				if (siegeActive)
					actionRow_4.components[3] = new ButtonBuilder()
						.setCustomId("WithdrawRevolution")
						.setLabel(ButtonLabelWithdrawRevolution)
						.setStyle(ButtonStyle.Primary);
				else
					actionRow_4.components[2] = new ButtonBuilder()
						.setCustomId("WithdrawRevolution")
						.setLabel(ButtonLabelWithdrawRevolution)
						.setStyle(ButtonStyle.Primary);

				revolutionStatusMsg = `\nRevolution moved in the next phase. townsfolk may still join, those who've joined may withdraw.(Joined ${gameState.getRevolutionarySize()} / ${gameState.getPeopleSize()}.)`;
				if (gameState.isEmperorElectionActive()) {
					actionRow_1 = new ActionRowBuilder().addComponents(
						await buildSelectMenu(
							client,
							["knight", "noble", "lord", "king"],
							"SelectEmperorCandidate", TextEmperorCandidateSelectMenu
						)
					);
					revolutionBtn = new ButtonBuilder()
						.setCustomId("VoteEmperor")
						.setLabel(ButtonLabelVoteEmperor)
						.setStyle(ButtonStyle.Danger);
					if (siegeActive) {
						if (actionRow_4.components[3]) actionRow_4.components.splice(3, 1);
					} else {
						if (actionRow_4.components[2]) actionRow_4.components.splice(2, 1);
					}
					revolutionStatusMsg = `\nA vote for a new Emperor is underway, knight votes weigh heavy. (${gameState.getRevolutionarySize()} votes cast)`;
				}
				if (gameState.isReelectionActive()) {
					actionRow_1 = emperorReelectionSelectMenu;
					revolutionStatusMsg = `\nThere may only be a single Emperor, a new vote is underway amongst notable contenders. (${gameState.getRevolutionarySize()} votes cast)`;
				}
			}
			actionRow_4.components[0] = revolutionBtn;
			actionRow_4.components[1] = coupBtn;
		} else if (gameState.isRevolutionActive() && gameState.isCoupActive()) {
			const revolutionBtn = new ButtonBuilder()
				.setCustomId("Revolution")
				.setLabel(ButtonLabelRevolution)
				.setDisabled(true)
				.setStyle(ButtonStyle.Danger);
			let coupBtn = new ButtonBuilder()
				.setCustomId("JoinCoup")
				.setLabel(ButtonLabelJoinCoup)
				.setStyle(ButtonStyle.Danger);
			revolutionStatusMsg = `\nCoup initiated by sword of the Two Gods. May Heaven's Favour flood the land and sprout a new rule in its likeness. (${gameState.getRevolutionarySize()} / ${gameState.getRoleSize("Knight")} votes cast)`;
			if (gameState.isRevolutionSecondPhase()) {
				revolutionStatusMsg = `\n Coup brimming, its second phase is underway. (Joined ${gameState.GetRevolutionarySize()} / ${gameState.getRoleSize("Knight")}.)`;
				if (gameState.isEmperorElectionActive()) {
					actionRow_2 = new ActionRowBuilder().addComponents( 
						await buildSelectMenu(
							client,
							["knight", "noble", "lord", "king"],
							"SelectEmperorCandidate", TextEmperorCandidateSelectMenu
						)
					);
					coupBtn = new ButtonBuilder()
						.setCustomId("VoteEmperor")
						.setLabel(ButtonLabelVoteEmperor)
						.setStyle(ButtonStyle.Danger);
					revolutionStatusMsg = `\nThe stagnant Emperor has fallen, as channels of the gods, knigfhts must vote in our next proclamation.  (${gameState.getRevolutionarySize()} votes cast)`;
				}
				if (gameState.isReelectionActive()) {
					actionRow_2 = emperorReelectionSelectMenu;

					revolutionStatusMsg = `\nThere may only be a single Emperor, a new vote is underway amongst notable contenders. (${gameState.getRevolutionarySize()} votes cast)`;
				}
			}
			actionRow_4.components[0] = revolutionBtn;
			actionRow_4.components[1] = coupBtn;
		}

		await messageToEdit.edit({
			content: initContent + siegeStatusMsg + revolutionStatusMsg,
			components: [
				actionRow_0,
				actionRow_1,
				actionRow_2,
				actionRow_3,
				actionRow_4,
			],
		});
	} catch (err) {
		showErrorMsg(err);
	}
}

async function messageKnightCommands(client) {
	let channel = null;
	try {
		channel = await client.channels.fetch(process.env.CHANNELIDKNIGHT);
		const actionRow_0 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				["peasant", "scholar", "merchant", "noble", "lord", "king", "knight"],
				"SelectCutDown", TextCutDownSelectMenu
			)
		);
		const actionRow_1 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				["knight", "noble", "lord", "king", "emperor"],
				"SelectRevolutionTarget", TextRevolutionTargetSelectMenu
			)
		);
		const actionRow_2 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				["noble", "lord", "king", "emperor"],
				"SelectCoupTarget", TextCoupTargetSelectMenu
			)
		);
		const actionRow_3 = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("CutDown")
			.setLabel(ButtonLabelCutDown)
			.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
			.setCustomId("ShowWrits")
			.setLabel(ButtonLabelShowWrits)
			.setStyle(ButtonStyle.Primary)
		);
		const actionRow_4 = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("Revolution")
			.setLabel(ButtonLabelRevolution)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.getDisableRevolution()),
			new ButtonBuilder()
			.setCustomId("Coup")
			.setLabel(ButtonLabelCoup)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.getDisableCoup())
		);

		const message = await channel.send({
			content: initContent,
			components: [
				actionRow_0,
				actionRow_1,
				actionRow_2,
				actionRow_3,
				actionRow_4,
			],
		});
		return message;
	} catch (err) {
		console.error(err);
		return;
	}
}




module.exports = { setupKnightBotEvents, messageKnightCommands };
