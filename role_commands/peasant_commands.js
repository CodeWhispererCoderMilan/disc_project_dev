const {
	StringSelectMenuBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
    WebhookMixin,
} = require("discord.js");
const {
	buildSelectMenu,
	sendInteractionReply,
	messageChannel
} = require("../functions/botActions");
const {
	CacheGetCooldown,
	CacheSetCooldown,
    	CacheGetUsersByRoles,
} = require("../apis/redis/redisCache");
const {
	changeRole
} = require("../apis/firebase/querys.js");
const {
	MobFlayingTime,
	MobFlayingSuccessThreshold,
	MobFlayingCooldown,
	RoleChangeMessageDisplayTime,
	TextPeasantMessageContent,
	TextRevolutionTargetSelectMenu,
	TextEmperorCandidateSelectMenu,
	ButtonLabelRevolution,
	ButtonLabelJoinRevolution,
	ButtonLabelWithdrawRevolution,
	ButtonLabelVoteEmperor,
	ButtonLabelMobFlaying,
	ButtonLabelJoinMobFlaying,
	TextMobFlayingSelectMenu
} = require("../game_config.json");
const { eventEmitter } = require("../functions/eventEmitter.js");
const gameState = require("../game_state.js");

let selectedRevolutionTargets = {};
let selectedMobFlayingTargets = {};
let selectedEmperorCandidates = {};
let peasants = [];
let peasantsSize = 1;
let mobFlayingInitiatorId = null;
let mobFlayingInitiator = null;
let mobFlayingTargetId = null;
let mobFlayingTarget = null;
let mobFlayingActive = false;
let mobFlayingParticipants = new Set();
let mobFlayingTimeout;
const initContent = TextPeasantMessageContent;
let mobFlayingStatusMsg = "";

function showErrorMsg(err) {
	console.error("ERROR: peasant_commands.js", err);
}

async function setupPeasantBotEvents(client, lastMessageId) {

	eventEmitter.on("DisableRevolution", async () => {
		if(!gameState.isRevolutionActive() && !gameState.isCoupActive()) await updateMessage(client, lastMessageId);
	});
	eventEmitter.on("EnableRevolution", async () => {
		if(!gameState.isRevolutionActive() && !gameState.isCoupActive()) await updateMessage(client, lastMessageId);
	});
	client.on("guildMemberRemove", async (member) => {
		try {
			const hadRoleBeforePeasant = member.roles.cache.has(
				process.env.ROLEID_PEASANT
			);
			const hadRoleBeforeSubHuman = member.roles.cache.has(
				process.env.ROLEID_SUBHUMAN
			);
			const hadRoleBeforeKnight = member.roles.cache.has(
				process.env.ROLEID_KNIGHT
			);
			const hadRoleBeforeNoble = member.roles.cache.has(
				process.env.ROLEID_NOBLE
			);
			const hadRoleBeforeLord = member.roles.cache.has(
				process.env.ROLEID_LORD
			);
			const hadRoleBeforeKing = member.roles.cache.has(
				process.env.ROLEID_KING
			);
			const hadRoleBeforeEmperor = member.roles.cache.has(
				process.env.ROLEID_EMPEROR
			);
			// Handle mob flaying cleanup
			if (hadRoleBeforePeasant) {
				if (mobFlayingActive){
					try{
						peasants = await CacheGetUsersByRoles(["peasant"]);
						peasantsSize = peasants.length;
						if(mobFlayingParticipants.has(member.id)) {
							mobFlayingParticipants.delete(member.id);
							if (newMember.id === mobFlayingInitiatorId) {
							const msg = `<@${mobFlayingInitiatorId}>, initiator of the mob flaying is no longer a peasant.`;
							eventEmitter.emit("NotifyPeasantChannel", msg);
							await ceaseMobFlaying(client, lastMessageId, true);
							return;
							}
							const participationRate = mobFlayingParticipants.size / peasantsSize;
							if (participationRate >= MobFlayingSuccessThreshold) {
								await ceaseMobFlaying(client, lastMessageId);
							} else {
								await updateMessage(client, lastMessageId);
							}
						}else{
							await updateMessage(client, lastMessageId);
						}
					}catch(err){
						showErrorMsg(err);
					}
				}
			}
			if (mobFlayingActive && (hadRoleBeforePeasant || hadRoleBeforeSubHuman)) {
				if (member.id === mobFlayingTargetId) {
					const msg = `The role of the target @${mobFlayingTarget} has been changed.`;
					eventEmitter.emit("NotifyPeasantChannel", msg);
					await ceaseMobFlaying(client, lastMessageId, true);
				}
			}

			// Clear mob flaying targets
			if ((hadRoleBeforePeasant||hadRoleBeforeSubHuman) && !mobFlayingActive ) {
				for (let userId in selectedMobFlayingTargets) {
					if (selectedMobFlayingTargets[userId] && selectedMobFlayingTargets[userId].id === member.id) {
						selectedMobFlayingTargets[userId] = null;
					}
					await updateMessage(client,lastMessageId);
				}
			}
			// Clear revolution targets
			if ((hadRoleBeforeKnight || hadRoleBeforeNoble || hadRoleBeforeLord || 
				hadRoleBeforeKing || hadRoleBeforeEmperor) && !gameState.isEmperorElectionActive()) {
				for (let userId in selectedRevolutionTargets) {
					if (selectedRevolutionTargets[userId] && selectedRevolutionTargets[userId].id === member.id) {
						selectedRevolutionTargets[userId] = null;
					}
				}
				await updateMessage(client, lastMessageId);
			}
			if ((hadRoleBeforeKnight || hadRoleBeforeNoble || hadRoleBeforeLord || 
				hadRoleBeforeKing) && gameState.isEmperorElectionActive()) {
				for (let userId in selectedEmperorCandidates) {
					if (selectedEmperorCandidates[userId] && selectedEmperorCandidates[userId].id === member.id) {
						selectedEmperorCandidates[userId] = null;
					}
				}
				await updateMessage(client, lastMessageId);
			}

		} catch (err) {
			showErrorMsg(err);
		}
	});
	client.on("guildMemberUpdate", async (oldMember, newMember) => {

		const hadRoleBeforeSubHuman = oldMember.roles.cache.has(
			process.env.ROLEID_SUBHUMAN
		);
		const hasRoleNowSubhuman = newMember.roles.cache.has(
			process.env.ROLEID_SUBHUMAN
		);
		const hadRoleBeforePeasant = oldMember.roles.cache.has(
			process.env.ROLEID_PEASANT
		);
		const hasRoleNowPeasant = newMember.roles.cache.has(
			process.env.ROLEID_PEASANT
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

		if (
			(mobFlayingActive || gameState.isRevolutionActive()) &&
			(hadRoleBeforePeasant || hasRoleNowPeasant)
		) {
			peasants = await CacheGetUsersByRoles(["peasant"]);
			peasantsSize = peasants.length;
			if (mobFlayingActive) {
				if (mobFlayingParticipants.has(newMember.id)) {
					try {
						selectedMobFlayingTargets[newMember.id] = null;
						mobFlayingParticipants.delete(newMember.id);

						const participationRate =
							mobFlayingParticipants.size / peasantsSize;

						if (newMember.id === mobFlayingInitiatorId) {
							const msg = `<@${mobFlayingInitiatorId}>, initiator of the mob flaying is no longer a peasant.`;
							eventEmitter.emit("NotifyPeasantChannel", msg);
							await ceaseMobFlaying(client, lastMessageId, true);
							return;
						} else if (participationRate >= MobFlayingSuccessThreshold) {
							await ceaseMobFlaying(client, lastMessageId);
						} else {
							await updateMessage(client, lastMessageId);
						}
					} catch (err) {
						showErrorMsg(err);
					}
				} else{
					try{
						await updateMessage(client, lastMessageId)
					}catch(err){
						showErrorMsg(err);
					}	
				}
			}
			
		}
		if (mobFlayingActive && (hadRoleBeforePeasant || hadRoleBeforeSubHuman)) {
			if (newMember.id === mobFlayingTargetId) {
				try {
					const msg = `The role of <@${mobFlayingTargetId}>, the one to be flayed, has been changed.`;
					eventEmitter.emit("NotifyPeasantChannel", msg);
					await ceaseMobFlaying(client, lastMessageId, true);
				} catch (e) {
					showErrorMsg(e);
				}
			}
		}
		if (
			hasRoleNowKnight ||
			hasRoleNowNoble ||
			hasRoleNowLord ||
			hasRoleNowKing ||
			hasRoleNowEmperor
		) {
			await updateMessage(client, lastMessageId);
		}
		if (
			(hadRoleBeforePeasant ||
				hasRoleNowPeasant ||
				hadRoleBeforeSubHuman ||
				hasRoleNowSubhuman) &&
			!mobFlayingActive) {
			for (let userId in selectedMobFlayingTargets) {
				if (selectedMobFlayingTargets[userId] && selectedMobFlayingTargets[userId].id === oldMember.id) {
					selectedMobFlayingTargets[userId] = null;
				}
			}
			try {
				await updateMessage(client, lastMessageId);
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if ((hadRoleBeforeKnight || hadRoleBeforeNoble || hadRoleBeforeLord || 
			hadRoleBeforeKing || hadRoleBeforeEmperor) && !gameState.isEmperorElectionActive()) {
			for (let userId in selectedRevolutionTargets) {
				if (selectedRevolutionTargets[userId] && selectedRevolutionTargets[userId].id === oldMember.id) {
					selectedRevolutionTargets[userId] = null;
				}
			}
			await updateMessage(client, lastMessageId);
		}
		if ((hadRoleBeforeKnight || hadRoleBeforeNoble || hadRoleBeforeLord || 
			hadRoleBeforeKing) && gameState.isEmperorElectionActive()) {
			for (let userId in selectedEmperorCandidates) {
				if (selectedEmperorCandidates[userId] && selectedEmperorCandidates[userId].id === oldMember.id) {
					selectedEmperorCandidates[userId] = null;
				}
			}
			await updateMessage(client, lastMessageId);
		}
	});

	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

		if (interaction.customId === "MobFlayingSelectMenu") {
			const userId = interaction.user.id;
			let targetId = interaction.values[0];
			try {
				selectedMobFlayingTargets[userId] =
					await interaction.guild.members.fetch(targetId);
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
					await interaction.guild.members.fetch(targetId);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "SelectEmperorCandidate") {
			const userId = interaction.user.id;
			let selectedCandidateId = interaction.values[0];
			try {
				selectedEmperorCandidates[userId] =
					await interaction.guild.members.fetch(selectedCandidateId);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "MobFlaying") {
			const userId = interaction.user.id;
			peasants = await CacheGetUsersByRoles(["peasant"]);
			peasantsSize = peasants.length;

			if (!selectedMobFlayingTargets[userId]) {
				await sendInteractionReply(interaction, "No member selected");
				return;
			}

			let cooldown;
			try {
				cooldown = await CacheGetCooldown("MobFlaying", userId);
			} catch (err) {
				showErrorMsg(err);
			}
			if (cooldown) {
				await sendInteractionReply(interaction, "Mob flaying is on cooldown");
				return;
			}
			if (selectedMobFlayingTargets[userId].user.id === userId) {
				await sendInteractionReply(interaction, "You cannot target yourself.");
				return;
			}


			mobFlayingInitiatorId = userId;
			mobFlayingInitiator = interaction.user.username;
			mobFlayingParticipants.add(userId);
			mobFlayingActive = true;
			mobFlayingTarget = selectedMobFlayingTargets[userId].user.username;
			mobFlayingTargetId = selectedMobFlayingTargets[userId].user.id;

			if (lastMessageId) {
				try {
					// Set cooldown
					await CacheSetCooldown("MobFlaying", userId, MobFlayingCooldown);

					await sendInteractionReply(
						interaction,
						"Mob flaying initiated, waiting for other peasants to join."
					);

					await startMobFlaying(client, lastMessageId, MobFlayingTime);
					await updateMessage(client, lastMessageId);
					
					const participationRate = mobFlayingParticipants.size / peasantsSize;
					if (participationRate >= MobFlayingSuccessThreshold) {
						await ceaseMobFlaying(client, lastMessageId);
						return;
					}
				} catch (err) {
					showErrorMsg(err);
				}
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

				eventEmitter.emit("StartRevolution", userId, target.user.id, "Peasant");
				delete selectedRevolutionTargets[userId];
				await sendInteractionReply(
					interaction,
					"Revolution started, waiting for others to join."
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
				"Peasant",
				userId,
				target.user.id
			);
			delete selectedRevolutionTargets[userId];
			await sendInteractionReply(	
				interaction,
				`You have joined the revolution with target <@${target.user.id}>.`
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
				if (!selectedEmperorCandidates[userId]) {
					await sendInteractionReply(interaction, "No member selected");
					return;
				}

				if (gameState.isRevolutionParticipant(userId)) {
					await sendInteractionReply(
						interaction,
						"You've already joined the election."
					);
					return;
				}

				eventEmitter.emit(
					"AddRevolutionParticipant",
					"Peasant",
					userId,
					selectedEmperorCandidates[userId].user.id
				);
				delete selectedEmperorCandidates[userId];
				await sendInteractionReply(
					interaction,
					"You have joined the election."
				);
			} catch (err) {
				throw err;
			}
		}
		if (interaction.customId === "JoinMobFlaying") {
			try {
				if (!mobFlayingActive) {
					await sendInteractionReply(
						interaction,
						"There is no active mob flaying to join."
					);
					return;
				}
				const userId = interaction.user.id;
				if (userId === mobFlayingInitiatorId) {
					await sendInteractionReply(
						interaction,
						"Once you initiated mob flaying, you don't need to join since you are alreday a participant."
					);
					return;
				}

				if (userId === mobFlayingTargetId) {
					await sendInteractionReply(
						interaction,
						"You cannot join mob flyaing targeted yourself."
					);
					return;
				}

				if (mobFlayingParticipants.has(userId)) {
					await sendInteractionReply(interaction, "You've already joined.");
					return;
				}

				mobFlayingParticipants.add(userId);
				await sendInteractionReply(
					interaction,
					"You have joind the mob flaying."
				);

				const participationRate = mobFlayingParticipants.size / peasantsSize;
				if (
					mobFlayingActive &&
					participationRate >= MobFlayingSuccessThreshold
				) {
					//If poll succeeded within voting ending time.
						ceaseMobFlaying(client, lastMessageId);
					return;
				} else {
					updateMessage(client, lastMessageId);
				}
			} catch (err) {
				throw err;
			}
		}
	});

	
	eventEmitter.on("NotifyPeasantChannel", async (msg) => {
		try {
			let channel = await client.channels.fetch(process.env.CHANNELIDPEASANT);
			const message = await channel.send({
				content: msg,	
			});
			setTimeout(async () => {
				await message.delete().catch(console.error);
			}, RoleChangeMessageDisplayTime);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("RevolutionStarted", async () => {
		try {
			if(gameState.isRevolutionActive() && !gameState.isCoupActive())await updateMessage(client, lastMessageId);
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
			if(!gameState.isRevolutionActive() && !gameState.isCoupActive()) 
				await updateMessage(client, lastMessageId);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("RevolutionFinished", async () => {
		try {
				await updateMessage(client, lastMessageId);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("RevolutionMovedToSecondPhase", async () => {
		try {
			if(gameState.isRevolutionSecondPhase() && !gameState.isCoupActive())await updateMessage(client, lastMessageId);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("RevolutionMovedInEmperorElection", async () => {
		try {
			if(gameState.isEmperorElectionActive() && !gameState.isCoupActive()) await updateMessage(client, lastMessageId);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("RevolutionMovedInEmperorReelection", async (emperorReelectionSelectMenu) => {
		try {
			if(gameState.isReelectionActive() && !gameState.isCoupActive())
				await updateMessage(client, lastMessageId, emperorReelectionSelectMenu);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("UpdateRevolutionMessage", async () => {
		try {
			if(gameState.isRevolutionActive() && !gameState.isCoupActive()) 
				await updateMessage(client, lastMessageId);
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("ElectionEnthronement", async (emperorId) => {
		try {
			const channel = await client
				.channels.fetch(process.env.CHANNELIDPEASANT);
			const tmpMessage = await channel.send(
				`Hail our new Emperor! <@${emperorId}>,you have risen to the mountain spring in the spray of revolution, may your rule last 1000 years!`
			);
			setTimeout(() => {
				tmpMessage.delete().catch(showErrorMsg);
			}, 30000);
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("ServerStatusChange", async () => {
		try {
			await updateMessage(client, lastMessageId);
		} catch (err) {
			showErrorMsg(err);
		}
	});
}

async function startMobFlaying(client, lastMessageId, timeout) {
	await messageChannel(client, process.env.CHANNELID_FARMS, `A crowd has gathered, dancing, singing and ready for a good ol' mob flaying!`);
	mobFlayingTimeout = setTimeout(async () => {
		await handleMobFlayingEnd(client, lastMessageId, false);
	}, timeout);
}

async function handleMobFlayingEnd(client, lastMessageId, failed) {
	const participationRate = mobFlayingParticipants.size / peasantsSize;
	mobFlayingActive = false;
	if (participationRate >= MobFlayingSuccessThreshold && !failed) {
		const target = selectedMobFlayingTargets[mobFlayingInitiatorId];
		if (target) await changeRole( target, "Poop", false);
		const msg = `Mob flaying successful! <@${mobFlayingTarget}> has been reduced to poop.`;
		eventEmitter.emit("NotifyPeasantChannel", msg);
		messageChannel(client, process.env.CHANNELID_FARMS, `Peasants jeer in exhaltation as strips of flesh are pulled off <@${mobFlayingTargetId}>'s sides. May the Two Gods accept<@${mobFlayingInitiatorId}>'s sacrifice.`);
		messageChannel(client, process.env.CHANNELID_FOREST, `<@${mobFlayingTargetId}> was ripped apart by an angry mob`);
		eventEmitter.emit("Death", `<@${mobFlayingTargetId}> was torn apart by an angry mob.`);
	} else {
		const msg = `Mob flaying of <@${mobFlayingTargetId}> initiated by <@${mobFlayingInitiatorId}> has failed.`;
		eventEmitter.emit("NotifyPeasantChannel", msg);
		messageChannel(client, process.env.CHANNELID_FARMS, `The small crowd disperses, displeased with <@${mobFlayingInitiatorId}>'s failure to serve the Two Gods, stagnant scum...`);
	}
	await resetMobFlaying(client, lastMessageId);
}

async function ceaseMobFlaying(client, lastMessageId, failed) {
	if (mobFlayingTimeout && mobFlayingActive) {
		clearTimeout(mobFlayingTimeout);
		await handleMobFlayingEnd(client, lastMessageId, failed);
	}
}

async function updateMessage(client, lastMessageId,emperorReelectionSelectMenu) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDPEASANT);
		const messageToEdit = await channel.messages.fetch(lastMessageId);
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";
		let revolutionStatusMsg = "";
		let actionRow_0 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				["peasant", "sub-human"],
				"MobFlayingSelectMenu", TextMobFlayingSelectMenu
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
			new ButtonBuilder()
			.setCustomId("MobFlaying")
			.setLabel(ButtonLabelMobFlaying)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("Revolution")
			.setLabel(ButtonLabelRevolution)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.getDisableRevolution() || gameState.isServerDown())
		);
		let coupActive = gameState.isCoupActive();
		if (coupActive) {
			const revolutionBtn = new ButtonBuilder()
				.setCustomId("Revolution")
				.setLabel(ButtonLabelRevolution)
				.setDisabled(true)
				.setStyle(ButtonStyle.Danger);
			actionRow_2.components[1] = revolutionBtn;
		}

		if (mobFlayingActive) {
			const mobFlayingSelectMenu = StringSelectMenuBuilder.from(
				actionRow_0.components[0].toJSON()
			)
				.setDisabled(true)
				.setPlaceholder(mobFlayingTarget);
			actionRow_0.components[0] = mobFlayingSelectMenu;
			const joinMobFlayingBtn = new ButtonBuilder()
				.setCustomId("JoinMobFlaying")
				.setLabel(ButtonLabelJoinMobFlaying)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(false);
			actionRow_2.components[0] = joinMobFlayingBtn;

			mobFlayingStatusMsg = `\n<@${mobFlayingInitiatorId}> initiated a mob flaying. Join to kill <@${mobFlayingTargetId}>. (Joined ${mobFlayingParticipants.size} / ${gameState.getRoleSize("Peasant")} peasants)`;
		}
		if (gameState.isRevolutionActive() && !coupActive) {
			let revolutionBtn = new ButtonBuilder()
				.setCustomId("JoinRevolution")
				.setLabel(ButtonLabelJoinRevolution)
				.setStyle(ButtonStyle.Danger)
				.setDisabled(gameState.isServerDown());
			revolutionStatusMsg = `\nRevolution washes over the land. (Joined ${gameState.getRevolutionarySize()} / ${gameState.getPeopleSize()}.)`;
			if (gameState.isRevolutionSecondPhase()) {
				actionRow_2.components[2] = new ButtonBuilder()
					.setCustomId("WithdrawRevolution")
					.setLabel(ButtonLabelWithdrawRevolution)
					.setStyle(ButtonStyle.Primary)
					.setDisabled(gameState.isServerDown());
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
						.setStyle(ButtonStyle.Danger)
						.setDisabled(gameState.isServerDown());
					if (actionRow_2.components[2]) actionRow_2.components.splice(2, 1);
					revolutionStatusMsg = `\nA vote for a new Emperor is underway. (${gameState.getRevolutionarySize()} votes cast)`;
				}
				if (gameState.isReelectionActive()) {
					actionRow_0 = emperorReelectionSelectMenu;

					revolutionStatusMsg = `\nThere may only be a single Emperor, a new vote is underway amongst notable contenders. (${gameState.getRevolutionarySize()} votes cast)`;
				}
			}

			actionRow_2.components[1] = revolutionBtn;
		}

		await messageToEdit.edit({
			content: serverText + '\n' + initContent + mobFlayingStatusMsg + revolutionStatusMsg,
			components: [actionRow_0, actionRow_1, actionRow_2],
		});
	} catch (err) {
		showErrorMsg(err);
	}
}

async function messagePeasantCommands(client) {
	let channel = null;
	try {
		channel = await client.channels.fetch(process.env.CHANNELIDPEASANT);
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";
		const actionRow_0 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				["peasant", "sub-human"],
				"MobFlayingSelectMenu", TextMobFlayingSelectMenu
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
			new ButtonBuilder()
			.setCustomId("MobFlaying")
			.setLabel(ButtonLabelMobFlaying)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("Revolution")
			.setLabel(ButtonLabelRevolution)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.getDisableRevolution() || gameState.isServerDown())
		);

		const message = await channel.send({
			content: serverText + '\n' + initContent,
			components: [actionRow_0, actionRow_1, actionRow_2],
		});
		return message;
	} catch (err) {
		showErrorMsg(err);
	}
}

async function resetMobFlaying(client, lastMessageId) {
	try {
		selectedMobFlayingTargets = {};
		peasants = [];
		peasantsSize = 1;
		mobFlayingInitiatorId = null;
		mobFlayingInitiator = null;
		mobFlayingTargetId = null;
		mobFlayingTarget = null;
		mobFlayingParticipants = new Set();
		mobFlayingStatusMsg = "";
		await updateMessage(client, lastMessageId);
	} catch (err) {
		throw err;
	}
}


module.exports = { setupPeasantBotEvents, messagePeasantCommands };
