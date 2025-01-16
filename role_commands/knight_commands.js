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
	HighWritReward,
	EminentWritReward,
	RoyalWritReward,
	ImperialWritReward,
	SiegeTime,
	RevolutionCoolDown,
	CoupCoolDown,
	RoleChangeMessageDisplayTime,
	MinimumKnightSizeForCoup,
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
const { DBUpdateXP } = require("../apis/firebase/querys.js");
const { eventEmitter } = require("../functions/eventEmitter.js");

let selectedTargets = {};
let knights = [];
let knightsSize = 0;
let kingsSize = 1;
let siegeInitiator = null;
let siegeTarget = null;
let siegeActive = false;
let siegeParticipants = new Set();
let siegeTimeout;
let selectedRevolutionTargets = {};
let revolutionarySize = 0;
let revolutionActive = false;
let revolutionSecondPhase = false;
let peopleSize = 0;
let revolutionParticipants = {};
let emperorElectionActive = false;
let reelectionActive = false;
let candidates = null;
let coupActive = false;
let selectedCoupTargets = {};
let disableCoup = true;
let xpThresholdKnightOpen = true;
const initContent = TextKnightMessageContent;
let siegeStatusMsg = "";
let revolutionStatusMsg = "";

function showErrorMsg(err) {
	console.error("ERROR: knight_commands.js", err);
}

async function setupKnightBotEvents(client, lastMessageId) {
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
			knightsSize = knights.size;
			if(knightsSize < MinimumKnightSize && !xpThresholdKnightOpen){
				xpThresholdKnightOpen  = true;
				eventEmitter.emit("OpenXpThresholdKnight");
			}
			if(knightsSize > MinimumKnightSize && xpThresholdKnightOpen ){
				xpThresholdKnightOpen = false;
				eventEmitter.emit("CloseXpThresholdKnight");
			}
			if(knightsSize < MinimumKnightSizeForCoup && disableCoup === false){
				disableCoup = true;
				if(!coupActive && !revolutionActive)await updateMessage(client, lastMessageId);
			}
			if(knightsSize >= MinimumKnightSizeForCoup && disableCoup === true){
				disableCoup = false;
				if(!coupActive && !revolutionActive)await updateMessage(client, lastMessageId);
			}
		}
		if (
			hadRoleBeforePeasant ||
			hadRoleBeforeScholar ||
			hadRoleBeforeMerchant ||
			hadRoleBeforeNoble ||
			hadRoleBeforeLord ||
			hadRoleBeforeKing
		) {
			await CacheCheckAndUpdateUserWrits(oldMember.id);
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
			hadRoleBeforeKing ||
			hadRoleBeforeEmperor ||
			hadRoleBeforeKnight ||
			hasRoleNowPeasant ||
			hasRoleNowScholar ||
			hasRoleNowMerchant ||
			hasRoleNowNoble ||
			hasRoleNowLord ||
			hasRoleNowKing ||
			hasRoleNowKnight ||
			hasRoleNowEmperor
		) {
			await updateMessage(client, lastMessageId);
		}

		if (
			(siegeActive || revolutionActive) &&
			(hadRoleBeforeKnight || hasRoleNowKnight)
		) {
			if (siegeActive) {
				if (siegeParticipants.has(newMember.id)) {
					try {
						siegeParticipants.delete(newMember.id);
					} catch (err) {
						showErrorMsg(err);
					}
				}
			}
			if (revolutionActive) {
				if (
					Object.keys(revolutionParticipants).findIndex(
						(key) => key === newMember.id
					) > -1
				) {
					delete revolutionParticipants[newMember.id];
					delete selectedRevolutionTargets[newMember.id];
				}
				eventEmitter.emit(
					"SendRevolutionStatus",
					"Knight",
					revolutionParticipants,
					knightsSize
				);
			}
		}

		if (
			siegeActive &&
			(hadRoleBeforeKnight ||
				hasRoleNowKnight ||
				hadRoleBeforeKing ||
				hasRoleNowKing)
		) {
			if (lastMessageId) {
				try {
					const kings = guild.members.cache.filter((member) =>
						member.roles.cache.has(process.env.ROLEID_KING)
					);
					kingsSize = kings.size;
					if (siegeActive) {
						const siegeSuccess =
							siegeParticipants.size >= knightsSize / kingsSize;
						if (siegeSuccess) {
							await ceaseSiege(client, lastMessageId);
							return;
						} else {
							await updateMessage(client, lastMessageId);
						}
					}
				} catch (err) {
					showErrorMsg(err);
				}
			}
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
					await executeCutDown(
						interaction,
						userId,
						targetId,
						userXP,
						validWrit,
						client
					);
				} else {
					// No writ required
					const activeWrit = await CacheCheckActiveWrit(userId, targetId);
					if (activeWrit) {
						await executeCutDown(
							interaction,
							userId,
							targetId,
							userXP,
							activeWrit
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
				if (!siegeActive) {
					await sendInteractionReply(
						interaction,
						"There is no active siege to join."
					);
					return;
				}

				const userId = interaction.user.id;
				if (siegeParticipants.has(userId)) {
					await sendInteractionReply(
						interaction,
						"You've already joined this siege."
					);
					return;
				}

				siegeParticipants.add(userId);
				await sendInteractionReply(interaction, "You have joind the siege.");

				const siegeSuccess = siegeParticipants.size >= knightsSize / kingsSize;
				if (siegeSuccess) {
					await ceaseSiege(client, lastMessageId);
					return;
				} else {
					eventEmitter.emit(
						"KnightParticipatedOnSiege",
						siegeParticipants.size,
						knightsSize
					);
					await updateMessage(client, lastMessageId);
				}
			} catch (err) {
				throw err;
			}
		}

		if (interaction.customId === "Revolution") {
			const userId = interaction.user.id;
			const target = selectedRevolutionTargets[userId];

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

			await CacheSetCooldown("Revolution", "Global", RevolutionCoolDown);

			try {
				revolutionParticipants[userId] = target;

				eventEmitter.emit("StartRevolution");
				await sendInteractionReply(
					interaction,
					"Revolution started, waiting for others to join."
				);
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "JoinRevolution") {
			const userId = interaction.user.id;
			if (!selectedRevolutionTargets[userId]) {
				await sendInteractionReply(interaction, "No member selected");
				return;
			}

			if (
				Object.keys(revolutionParticipants).findIndex((key) => key === userId) >
				-1
			) {
				await sendInteractionReply(
					interaction,
					"You've already joined revolution."
				);
				return;
			}

			const target = selectedRevolutionTargets[userId];
			revolutionParticipants[userId] = target;

			eventEmitter.emit(
				"SendRevolutionStatus",
				"Knight",
				revolutionParticipants,
				knightsSize
			);

			await sendInteractionReply(
				interaction,
				`You have joined the revolution with target @${target.user.username}.`
			);
		}
		if (interaction.customId === "JoinCoup") {
			const userId = interaction.user.id;
			if (!selectedCoupTargets[userId]) {
				await sendInteractionReply(interaction, "No member selected");
				return;
			}

			if (
				Object.keys(revolutionParticipants).findIndex((key) => key === userId) >
				-1
			) {
				await sendInteractionReply(interaction, "You've already joined coup.");
				return;
			}

			const target = selectedCoupTargets[userId];
			revolutionParticipants[userId] = target;

			eventEmitter.emit(
				"SendRevolutionStatus",
				"Knight",
				revolutionParticipants,
				knightsSize
			);

			await sendInteractionReply(
				interaction,
				`You have joined the coup with target @${target.user.username}.`
			);
		}
		if (interaction.customId === "WithdrawRevolution") {
			const userId = interaction.user.id;
			if (
				Object.keys(revolutionParticipants).findIndex((key) => key === userId) <
				0
			) {
				await sendInteractionReply(
					interaction,
					"You've not joined revolution."
				);
				return;
			}

			delete revolutionParticipants[userId];
			if (coupActive) delete selectedCoupTargets[userId];
			else delete selectedRevolutionTargets[userId];

			eventEmitter.emit(
				"SendRevolutionStatus",
				"Knight",
				revolutionParticipants,
				knightsSize
			);

			await sendInteractionReply(
				interaction,
				`You have withdrawn the revolution`
			);
		}
		if (interaction.customId === "Coup") {
			const userId = interaction.user.id;
			const target = selectedCoupTargets[userId];

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

			await CacheSetCooldown("Coup", "Global", CoupCoolDown);

			try {
				revolutionParticipants[userId] = target;

				eventEmitter.emit("StartCoup");
				await sendInteractionReply(
					interaction,
					"Coup started, waiting for others to join."
				);
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "VoteEmperor") {
			try {
				if (!emperorElectionActive) {
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
					Object.keys(revolutionParticipants).findIndex(
						(key) => key === userId
					) > -1
				) {
					await sendInteractionReply(
						interaction,
						"You've already joined the election."
					);
					return;
				}

				const candidate = selectedRevolutionTargets[userId];
				if (candidate.user.id === userId) {
					await sendInteractionReply(interaction, "You cannot vote yourself.");
					return;
				}
				revolutionParticipants[userId] = candidate;

				eventEmitter.emit(
					"SendRevolutionStatus",
					"Knight",
					revolutionParticipants,
					knightsSize
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

	eventEmitter.on("siegeStarted", async (initiator, target) => {
		try {
			if (lastMessageId) {
				const guild = await client.guilds.fetch(process.env.GUILDID);
				knights = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_KNIGHT)
				);
				const kings = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_KING)
				);
				knightsSize = knights.size;
				kingsSize = kings.size;
				siegeInitiator = initiator;
				siegeTarget = target;

				await startSiege(client, lastMessageId, SiegeTime);
				await updateMessage(client, lastMessageId);
			}
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("siegeResult", async (message, status) => {
		try {
			if (status === "early") {
				await ceaseSiege(client, lastMessageId);
			}
			eventEmitter.emit("NotifyKnightChannel", message);
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
			const guild = await client.guilds.fetch(process.env.GUILDID);
			knights = guild.members.cache.filter((member) =>
				member.roles.cache.has(process.env.ROLEID_KNIGHT)
			);
			knightsSize = knights.size;
			revolutionActive = true;

			eventEmitter.emit(
				"SendRevolutionStatus",
				"Knight",
				revolutionParticipants,
				knightsSize
			);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("CoupStarted", async () => {
		try {
			const guild = await client.guilds.fetch(process.env.GUILDID);
			knights = guild.members.cache.filter((member) =>
				member.roles.cache.has(process.env.ROLEID_KNIGHT)
			);
			knightsSize = knights.size;
			coupActive = true;

			eventEmitter.emit(
				"SendRevolutionStatus",
				"Knight",
				revolutionParticipants,
				knightsSize
			);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("CoupFinished", async () => {
		try {
			await resetRevolution(client, lastMessageId);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("RevolutionFinished", async () => {
		try {
			await resetRevolution(client, lastMessageId);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("RevolutionMovedInSecondPhase", async () => {
		try {
			revolutionSecondPhase = true;
			await updateMessage(client, lastMessageId);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("RevolutionMovedInEmperorElection", async () => {
		try {
			emperorElectionActive = true;
			revolutionParticipants = {};
			selectedRevolutionTargets = {};
			revolutionarySize = 0;
			await updateMessage(client, lastMessageId);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("RevolutionMovedInEmperorReelection", async (members) => {
		try {
			reelectionActive = true;
			candidates = members;
			revolutionParticipants = {};
			selectedRevolutionTargets = {};
			revolutionarySize = 0;
			await updateMessage(client, lastMessageId);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on(
		"UpdateRevolutionStatus",
		async (participantsSize, totalSize) => {
			try {
				revolutionarySize = participantsSize;
				peopleSize = totalSize;
				await updateMessage(client, lastMessageId);
			} catch (err) {
				throw err;
			}
		}
	);
}

async function startSiege(client, lastMessageId, timeout) {
	siegeActive = true;
	siegeTimeout = setTimeout(async () => {
		await handleSiegeEnd(client, lastMessageId);
	}, timeout);
}

async function handleSiegeEnd(client, lastMessageId) {
	eventEmitter.emit("SiegeFinished", siegeParticipants.size, knightsSize);
	eventEmitter.emit("NotifyKnightChannel", "Siege finished.");
	await resetSiege(client, lastMessageId);
}

async function ceaseSiege(client, lastMessageId) {
	siegeActive = false;
	if (siegeTimeout) {
		clearTimeout(siegeTimeout);
		await handleSiegeEnd(client, lastMessageId);
	}
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
			}`;
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

async function executeCutDown(interaction, userId, targetId, userXP, client) {
	const cooldown = await CacheGetCooldown("cutdown", userId);
	if (cooldown) {
		await sendInteractionReply(
			interaction,
			"Cut Down is on cooldown and cannot be used"
		);
		return;
	}

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
		let xpReward;
		switch (writ.writType) {
			case 1:
				xpReward = HighWritReward;
				break;
			case 2:
				xpReward = EminentWritReward;
				break;
			case 3:
				xpReward = RoyalWritReward;
				break;
			case 4:
				xpReward = ImperialWritReward;
				break;
			default:
				showErrorMsg("Writ type incorrect");
		}
		totalXpReward += xpReward;

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
	await DBUpdateXP(userId, totalXpReward, client);
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
	eventEmitter.emit("changeRole", target, "Poop", false);
	eventEmitter.emit(
		"CutDownComplete",
		target.user.username,
		interaction.user.username
	);
}

async function updateMessage(client, lastMessageId) {
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
			.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
			.setCustomId("Coup")
			.setLabel(ButtonLabelCoup)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disableCoup)
		);

		if (siegeActive) {
			const joinSiegeBtn = new ButtonBuilder()
				.setCustomId("JoinSiege")
				.setLabel(ButtonLabelJoinSiege)
				.setStyle(ButtonStyle.Danger);
			if (revolutionActive) {
				if (revolutionSecondPhase && !emperorElectionActive)
					actionRow_4.components[3] = joinSiegeBtn;
				else actionRow_4.components[2] = joinSiegeBtn;
			} else {
				actionRow_4.components[2] = joinSiegeBtn;
			}

			siegeStatusMsg = `\nKing @${siegeInitiator} initiated a siege. Join siege to downgrade ${siegeTarget}. (Joined ${siegeParticipants.size} / ${knightsSize}.)`;
		}

		if (revolutionActive) {
			let revolutionBtn = new ButtonBuilder()
				.setCustomId("JoinRevolution")
				.setLabel(ButtonLabelJoinRevolution)
				.setStyle(ButtonStyle.Danger);
			const coupBtn = new ButtonBuilder()
				.setCustomId("Coup")
				.setLabel(ButtonLabelCoup)
				.setDisabled(true)
				.setStyle(ButtonStyle.Danger);
			revolutionStatusMsg = `\nRevolution started. Join revolution. (Joined ${revolutionarySize} / ${peopleSize}.)`;
			if (revolutionSecondPhase) {
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

				revolutionStatusMsg = `\nRevolution moved in the next phase. Join revolution. You can also withdraw. (Joined ${revolutionarySize} / ${peopleSize}.)`;
				if (emperorElectionActive) {
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
					revolutionStatusMsg = `\nLet's vote a new emperor.  (Joined ${revolutionarySize} members.)`;
				}
				if (reelectionActive) {
					actionRow_1 = new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder()
						.setCustomId("SelectEmperorCandidate")
						.setPlaceholder(TextEmperorCandidateSelectMenu)
						.addOptions(candidates)
					);

					revolutionStatusMsg = `\nEmperor must be only one. Let's reelect an emperor. (Joined ${revolutionarySize} members.)`;
				}
			}
			actionRow_4.components[0] = revolutionBtn;
			actionRow_4.components[1] = coupBtn;
		} else if (coupActive) {
			const revolutionBtn = new ButtonBuilder()
				.setCustomId("Revolution")
				.setLabel(ButtonLabelRevolution)
				.setDisabled(true)
				.setStyle(ButtonStyle.Danger);
			let coupBtn = new ButtonBuilder()
				.setCustomId("JoinCoup")
				.setLabel(ButtonLabelJoinCoup)
				.setStyle(ButtonStyle.Danger);
			revolutionStatusMsg = `\nCoup started. Join coup. (Joined ${revolutionarySize} / ${peopleSize}.)`;
			if (revolutionSecondPhase) {
				revolutionStatusMsg = `\nCoup moved in the next phase. (Joined ${revolutionarySize} / ${peopleSize}.)`;
				if (emperorElectionActive) {
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
					revolutionStatusMsg = `\nLet's vote a new emperor.  (Joined ${revolutionarySize} members.)`;
				}
				if (reelectionActive) {
					actionRow_2 = new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder()
						.setCustomId("SelectEmperorCandidate")
						.setPlaceholder(TextEmperorCandidateSelectMenu)
						.addOptions(candidates)
					);

					revolutionStatusMsg = `\nEmperor must be only one. Let's reelect an emperor. (Joined ${revolutionarySize} members.)`;
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
			.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
			.setCustomId("Coup")
			.setLabel(ButtonLabelCoup)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disableCoup)
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

async function resetSiege(client, lastMessageId) {
	try {
		siegeActive = false;
		siegeInitiator = "";
		siegeTarget = "";
		siegeParticipants.clear();
		knightsSize = 1;
		knights = [];
		siegeStatusMsg = "";
		await updateMessage(client, lastMessageId);
	} catch (err) {
		throw err;
	}
}

async function resetRevolution(client, lastMessageId) {
	try {
		selectedRevolutionTargets = {};
		revolutionActive = false;
		revolutionSecondPhase = false;
		revolutionarySize = 0;
		peopleSize = 0;
		revolutionParticipants = {};
		emperorElectionActive = false;
		reelectionActive = false;
		candidates = null;
		revolutionStatusMsg = "";
		selectedCoupTargets = {};
		coupActive = false;
		await updateMessage(client, lastMessageId);
	} catch (err) {
		throw err;
	}
}
module.exports = { setupKnightBotEvents, messageKnightCommands };
