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
	CacheGetCooldown,
	CacheSetCooldown,
} = require("../apis/redis/redisCache");
const {
	MobFlayingTime,
	MobFlayingSuccessThreadshold,
	MobFlayingCoolDown,
	RevolutionCoolDown,
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

let selectedMobFlayingTargets = {};
let peasants = [];
let peasantsSize = 1;
let mobFlayingInitiatorId = null;
let mobFlayingInitiator = null;
let mobFlayingTargetId = null;
let mobFlayingTarget = null;
let mobFlayingActive = false;
let mobFlayingParticipants = new Set();
let mobFlayingTimeout;
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
let disableRevolution = true;
const initContent = TextPeasantMessageContent;
let mobFlayingStatusMsg = "";
let revolutionStatusMsg = "";

function showErrorMsg(err) {
	console.error("ERROR: peasant_commands.js", err);
}

async function setupPeasantBotEvents(client, lastMessageId) {
	eventEmitter.on("DisableRevolution", async () => {
		disableRevolution = true;
		if(!revolutionActive && !coupActive) await updateMessage();
	});
	eventEmitter.on("enableRevolution", async () => {
		disableRevolution = false;
		if(!revolutionActive && !coupActive) await updateMessage();
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
						const guild = await client.guilds.fetch(process.env.GUILDID);
						peasants = guild.members.cache.filter((member) =>
							member.roles.cache.has(process.env.ROLEID_PEASANT)
						);
						peasantsSize = peasants.size;
						if(mobFlayingParticipants.has(member.id)) {
							mobFlayingParticipants.delete(member.id);

							const participationRate = mobFlayingParticipants.size / peasantsSize;
							if (participationRate >= MobFlayingSuccessThreadshold) {
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


				if (revolutionActive) {
					const guild = await client.guilds.fetch(process.env.GUILDID);
					peasants = guild.members.cache.filter((member) =>
						member.roles.cache.has(process.env.ROLEID_PEASANT)
					);
					peasantsSize = peasants.size;

					if (Object.keys(revolutionParticipants).findIndex(
						(key) => key === member.id
					) > -1) {
						delete revolutionParticipants[member.id];
						delete selectedRevolutionTargets[member.id];
					}
					eventEmitter.emit(
						"SendRevolutionStatus",
						"Peasant",
						revolutionParticipants,
						peasantsSize
					);
				}
			}
			if (mobFlayingActive && (hadRoleBeforePeasant || hadRoleBeforeSubHuman)) {
				if (member.id === mobFlayingTargetId) {
					const msg = `The role of the target @${mobFlayingTarget} has been changed.`;
					eventEmitter.emit("NotifyPeasantChannel", msg);
					await ceaseMobFlaying(client, lastMessageId);
				}
			}

			// Clear mob flaying targets
			if ((hadRoleBeforePeasant||hadRoleBeforeSubHuman) && !mobFlayingActive && !revolutionActive) {
				for (let userId in selectedMobFlayingTargets) {
					if (selectedMobFlayingTargets[userId] && selectedMobFlayingTargets[userId].id === member.id) {
						selectedMobFlayingTargets[userId] = null;
					}
					await updateMessage(client,lastMessageId);
				}
			}

			// Clear revolution targets
			if (hadRoleBeforeKnight || hadRoleBeforeNoble || hadRoleBeforeLord || 
				hadRoleBeforeKing || hadRoleBeforeEmperor) {

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
			(mobFlayingActive || revolutionActive) &&
			(hadRoleBeforePeasant || hasRoleNowPeasant)
		) {
			const guild = await client.guilds.fetch(process.env.GUILDID);
			peasants = guild.members.cache.filter((member) =>
				member.roles.cache.has(process.env.ROLEID_PEASANT)
			);
			peasantsSize = peasants.size;
			if (mobFlayingActive) {
				if (mobFlayingParticipants.has(newMember.id)) {
					try {
						selectedMobFlayingTargets[newMember.id] = null;
						mobFlayingParticipants.delete(newMember.id);

						const participationRate =
							mobFlayingParticipants.size / peasantsSize;

						if (newMember.id === mobFlayingInitiatorId) {
							const msg = `The initiator ${mobFlayingInitiator} is no longer a peasant.`;
							eventEmitter.emit("NotifyPeasantChannel", msg);
							await ceaseMobFlaying(client, lastMessageId);
							return;
						} else if (participationRate >= MobFlayingSuccessThreadshold) {
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
					"Peasant",
					revolutionParticipants,
					peasantsSize
				);
			}
		}
		if (mobFlayingActive && (hadRoleBeforePeasant || hadRoleBeforeSubHuman)) {
			if (newMember.id === mobFlayingTargetId) {
				try {
					const msg = `The role of the target @${mobFlayingTarget} has been changed.`;
					eventEmitter.emit("NotifyPeasantChannel", msg);
					await ceaseMobFlaying(client, lastMessageId);
				} catch (e) {
					showErrorMsg(e);
				}
			}
		}
		if (
			hadRoleBeforeKnight ||
			hadRoleBeforeNoble ||
			hadRoleBeforeLord ||
			hadRoleBeforeKing ||
			hadRoleBeforeEmperor ||
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
			!mobFlayingActive &&
			!revolutionActive
		) {
			for (let userId in selectedMobFlayingTargets) {
				if (selectedMobFlayingTargets[userId] && selectedMobFlayingTargets[userId].id === member.id) {
					selectedMobFlayingTargets[userId] = null;
				}
			}
			try {
				await updateMessage(client, lastMessageId);
			} catch (err) {
				showErrorMsg(err);
			}
		}
	});

	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

		if (interaction.customId === "MobFlayingSelectMenu") {
			const userId = interaction.user.id;
			let targetId = interaction.values[0];
			try {
				selectedMobFlayingTargets[userId] =
					await interaction.guild.members.cache.get(targetId);
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

		if (interaction.customId === "MobFlaying") {
			const userId = interaction.user.id;
			peasants = interaction.guild.members.cache.filter((member) =>
				member.roles.cache.has(process.env.ROLEID_PEASANT)
			);
			peasantsSize = peasants.size;

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

			mobFlayingInitiatorId = userId;
			mobFlayingInitiator = interaction.user.username;
			mobFlayingParticipants.add(userId);
			mobFlayingActive = true;
			mobFlayingTarget = selectedMobFlayingTargets[userId].user.username;
			mobFlayingTargetId = selectedMobFlayingTargets[userId].user.id;

			if (mobFlayingTargetId === userId) {
				await sendInteractionReply(interaction, "You cannot target yourself.");
				return;
			}

			if (lastMessageId) {
				try {
					// Set cooldown
					await CacheSetCooldown("MobFlaying", userId, MobFlayingCoolDown);

					await sendInteractionReply(
						interaction,
						"Mob flaying initiated, waiting for other peasants to join."
					);

					await startMobFlaying(client, lastMessageId, MobFlayingTime);
					await updateMessage(client, lastMessageId);

					const participationRate = mobFlayingParticipants.size / peasantsSize;
					if (participationRate >= MobFlayingSuccessThreadshold) {
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
				"Peasant",
				revolutionParticipants,
				peasantsSize
			);

			await sendInteractionReply(
				interaction,
				`You have joined the revolution with target @${target.user.username}.`
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
			delete selectedRevolutionTargets[userId];

			eventEmitter.emit(
				"SendRevolutionStatus",
				"Peasant",
				revolutionParticipants,
				peasantsSize
			);

			await sendInteractionReply(
				interaction,
				`You have withdrawn the revolution`
			);
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
				revolutionParticipants[userId] = candidate;

				eventEmitter.emit(
					"SendRevolutionStatus",
					"Peasant",
					revolutionParticipants,
					peasantsSize
				);

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
					participationRate >= MobFlayingSuccessThreadshold
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
			const guild = await client.guilds.fetch(process.env.GUILDID);
			peasants = guild.members.cache.filter((member) =>
				member.roles.cache.has(process.env.ROLEID_PEASANT)
			);
			peasantsSize = peasants.size;
			revolutionActive = true;
			eventEmitter.emit(
				"SendRevolutionStatus",
				"Peasant",
				revolutionParticipants,
				peasantsSize
			);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("CoupStarted", async () => {
		try {
			coupActive = true;
			updateMessage(client, lastMessageId);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("CoupFinished", async () => {
		try {
			coupActive = false;
			updateMessage(client, lastMessageId);
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

async function startMobFlaying(client, lastMessageId, timeout) {
	mobFlayingTimeout = setTimeout(async () => {
		await handleMobFlayingEnd(client, lastMessageId);
	}, timeout);
}

async function handleMobFlayingEnd(client, lastMessageId) {
	const participationRate = mobFlayingParticipants.size / peasantsSize;
	if (mobFlayingActive && participationRate >= MobFlayingSuccessThreadshold) {
		const target = selectedMobFlayingTargets[mobFlayingInitiatorId];
		if (target) eventEmitter.emit("changeRole", target, "Poop", false);
		const msg = `Mob flaying successful! @${mobFlayingTarget} has become a poop by @${mobFlayingInitiator}.`;
		eventEmitter.emit("NotifyPeasantChannel", msg);
	} else {
		const msg = `Mob flaying on @${mobFlayingTarget} initiated by @${mobFlayingInitiator} has been failed.`;
		eventEmitter.emit("NotifyPeasantChannel", msg);
	}
	await resetMobFlaying(client, lastMessageId);
}

async function ceaseMobFlaying(client, lastMessageId) {
	mobFlayingActive = false;
	if (mobFlayingTimeout) {
		clearTimeout(mobFlayingTimeout);
		await handleMobFlayingEnd(client, lastMessageId);
	}
}

async function updateMessage(client, lastMessageId) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDPEASANT);
		const messageToEdit = await channel.messages.fetch(lastMessageId);

		let actionRow_0 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				["peasant", "subhuman"],
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
			.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
			.setCustomId("Revolution")
			.setLabel(ButtonLabelRevolution)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disableRevolution)
		);

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
				.setStyle(ButtonStyle.Primary);
			actionRow_2.components[0] = joinMobFlayingBtn;

			mobFlayingStatusMsg = `\n@${mobFlayingInitiator} initiated a mob flaying. Join to downgrade ${mobFlayingTarget}. (Joined ${mobFlayingParticipants.size} / ${peasantsSize}.)`;
		}
		if (revolutionActive) {
			let revolutionBtn = new ButtonBuilder()
				.setCustomId("JoinRevolution")
				.setLabel(ButtonLabelJoinRevolution)
				.setStyle(ButtonStyle.Danger);
			revolutionStatusMsg = `\nRevolution started. Join revolution. (Joined ${revolutionarySize} / ${peopleSize}.)`;
			if (revolutionSecondPhase) {
				actionRow_2.components[2] = new ButtonBuilder()
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
					if (actionRow_2.components[2]) actionRow_2.components.splice(2, 1);
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

			actionRow_2.components[1] = revolutionBtn;
		}

		await messageToEdit.edit({
			content: initContent + mobFlayingStatusMsg + revolutionStatusMsg,
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
	} catch (err) {
		showErrorMsg(err);
		return;
	}

	try {
		const actionRow_0 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				["peasant", "subhuman"],
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
			.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
			.setCustomId("Revolution")
			.setLabel(ButtonLabelRevolution)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disableRevolution)
		);

		const message = await channel.send({
			content: initContent,
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
		mobFlayingActive = false;
		mobFlayingParticipants = new Set();
		mobFlayingStatusMsg = "";
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
		await updateMessage(client, lastMessageId);
	} catch (err) {
		throw err;
	}
}
module.exports = { setupPeasantBotEvents, messagePeasantCommands };
