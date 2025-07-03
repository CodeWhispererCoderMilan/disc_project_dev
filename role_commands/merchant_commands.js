const {
	StringSelectMenuBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
} = require("discord.js");
const {
	buildSelectMenu,
	sendInteractionReply,
} = require("../functions/botActions");
const {
	CacheGetUserXP,
	CacheGetCooldown,
	CacheSetCooldown,
	CacheSetEndow,
	CacheClearTargetEndows,
	CacheClearMerchantEndows,
	CacheCheckEndowExists
} = require("../apis/redis/redisCache");
const { DBUpdateXP } = require("../apis/firebase/querys");
const {
	BribeCoolDown,
	RoleChangeMessageDisplayTime,
	EndowDuration,
	EndowCost,
	EndowCooldown,
	TextMerchantMessageContent,
	TextRevolutionTargetSelectMenu,
	TextEmperorCandidateSelectMenu,
	ButtonLabelRevolution,
	ButtonLabelJoinRevolution,
	ButtonLabelWithdrawRevolution,
	ButtonLabelVoteEmperor,
	ButtonLabelBribe,
	ButtonLabelEndow,
	TextEndowSelectmenu,
	TextBribeSelectMenu
} = require("../game_config.json");
const { eventEmitter } = require("../functions/eventEmitter.js");
const gameState = require("../game_state.js");

let selectedRevolutionTargets = {};
let selectedBribeTargets = {};
let bribeTargetId = null;
let selectedEndowTargets = {};

const initContent = TextMerchantMessageContent;
let revolutionStatusMsg = "";

function showErrorMsg(err) {
	console.error("ERROR: merchant_commands.js", err);
}


async function setupMerchantBotEvents(client, lastMessageId) {

	eventEmitter.on("DisableRevolution", async () => {
		if(!gameState.isRevolutionActive() && !gameState.isCoupActive()) await updateMessage();
	});
	eventEmitter.on("enableRevolution", async () => {
		if(!gameState.isRevolutionActive() && !gameState.isCoupActive()) await updateMessage();
	});

	client.on("guildMemberRemove", async (member) => {
		const hadRoleBeforeMerchant = member.roles.cache.has(
			process.env.ROLEID_MERCHANT
		);
		const hadRoleBeforePeasant = member.roles.cache.has(
			process.env.ROLEID_PEASANT
		);
		const hadRoleBeforeScholar = member.roles.cache.has(
			process.env.ROLEID_SCHOLAR
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
		if(hadRoleBeforePeasant || hadRoleBeforeScholar || hadRoleBeforeKnight || hadRoleBeforeNoble){
			await CacheClearTargetEndows(member.id);
		}
		if(hadRoleBeforeMerchant){
			await CacheClearTargetEndows(member.id);
			await CacheClearMerchantEndows(member.id);
		}

		if (
			hadRoleBeforePeasant ||
			hadRoleBeforeScholar ||
			hadRoleBeforeMerchant ||
			hadRoleBeforeKnight ||
			hadRoleBeforeNoble ||
			hadRoleBeforeLord ||
			hadRoleBeforeKing ||
			hadRoleBeforeEmperor
		) {
			await updateMessage(client, lastMessageId);
		}
	});
	client.on("guildMemberUpdate", async (oldMember, newMember) => {
		const hadRoleBeforeMerchant = oldMember.roles.cache.has(
			process.env.ROLEID_MERCHANT
		);
		const hasRoleNowMerchant = newMember.roles.cache.has(
			process.env.ROLEID_MERCHANT
		);
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
		const hadRoleBeforeKnight = oldMember.roles.cache.has(
			process.env.ROLEID_KNIGHT
		);
		const hasRoleNowKnight = newMember.roles.cache.has(
			process.env.ROLEID_KNIGHT
		);
		const hadRoleBeforeNoble = oldMember.roles.cache.has(
			process.env.ROLEID_NOBLE
		);
		const hasRoleNowNoble = newMember.roles.cache.has(process.env.ROLEID_NOBLE);
		const hadRoleBeforeLord = oldMember.roles.cache.has(
			process.env.ROLEID_LORD
		);
		const hasRoleNowLord = newMember.roles.cache.has(process.env.ROLEID_LORD);
		const hadRoleBeforeKing = oldMember.roles.cache.has(
			process.env.ROLEID_KING
		);
		const hasRoleNowKing = newMember.roles.cache.has(process.env.ROLEID_KING);
		const hadRoleBeforeEmperor = oldMember.roles.cache.has(
			process.env.ROLEID_EMPEROR
		);
		const hasRoleNowEmperor = newMember.roles.cache.has(
			process.env.ROLEID_EMPEROR
		);
		if(hadRoleBeforePeasant || hadRoleBeforeScholar || hadRoleBeforeKnight || hadRoleBeforeNoble){
			await CacheClearTargetEndows(oldMember.id);
		}
		if(hadRoleBeforeMerchant || hasRoleNowMerchant){
			await CacheClearTargetEndows(oldMember.id);
			await CacheClearMerchantEndows(oldMember.id);
		}
		if (
			hadRoleBeforePeasant ||
			hadRoleBeforeScholar ||
			hadRoleBeforeMerchant ||
			hadRoleBeforeKnight ||
			hadRoleBeforeNoble ||
			hadRoleBeforeLord ||
			hadRoleBeforeKing ||
			hadRoleBeforeEmperor ||
			hasRoleNowPeasant ||
			hasRoleNowScholar ||
			hasRoleNowMerchant ||
			hasRoleNowKnight ||
			hasRoleNowNoble ||
			hasRoleNowLord ||
			hasRoleNowKing ||
			hasRoleNowEmperor
		) {
			await updateMessage(client, lastMessageId);
		}
	});

	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return;

		if (
			interaction.isStringSelectMenu() &&
			interaction.customId === "BribeSelectMenu"
		) {
			const userId = interaction.user.id;

			bribeTargetId = interaction.values[0];
			try {
				selectedBribeTargets[userId] =
					await interaction.guild.members.cache.get(bribeTargetId);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.isStringSelectMenu() && interaction.customId === "EndowSelectMenu") {
			const userId = interaction.user.id;
			let targetId = interaction.values[0];
			try {
				selectedEndowTargets[userId] = await interaction.guild.members.cache.get(targetId);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (
			interaction.isStringSelectMenu() &&
			interaction.customId === "SelectRevolutionTarget"
		) {
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

		if (
			interaction.isStringSelectMenu() &&
			interaction.customId === "SelectEmperorCandidate"
		) {
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

		if (interaction.isButton()) {
			if (interaction.customId === "Endow") {
				const userId = interaction.user.id;
				if (!selectedEndowTargets[userId]) {
					await sendInteractionReply(interaction, "Choose a member to endow");
					return;
				}

				const targetId = selectedEndowTargets[userId].user.id;
				if (targetId === userId) {
					await sendInteractionReply(interaction, "You cannot endow yourself!");
					return;
				}
				let cooldown;
				try {
					cooldown = await CacheGetCooldown("Endow", userId);
				} catch (err) {
					showErrorMsg(err);
				}
				if (cooldown) {
					sendInteractionReply(interaction, "Endow is on cooldown");
					return;
				}
				let userXP = await CacheGetUserXP(userId);
				if (userXP < EndowCost) {
					await sendInteractionReply(interaction, `Not enough XP (current XP: ${userXP})`);
					return;
				}
				try {
					const endowExists = await CacheCheckEndowExists(userId, targetId);
					if (endowExists) {
						await sendInteractionReply(interaction, "You have already endowed this target!");
						return;
					}

					const endTime = Date.now() + EndowDuration;
					await CacheSetEndow(userId, targetId, endTime);
					await DBUpdateXP(userId, EndowCost, client);
					await CacheSetCooldown("Endow", userId, EndowCooldown);
					await sendInteractionReply(
						interaction,
						`Successfully endowed ${selectedEndowTargets[userId].user.username}. You will receive half of their XP gains while they receive 1.5x XP.`
					);

					// Clear after endow
					selectedEndowTargets[userId] = null;
				} catch (err) {
					showErrorMsg(err);
					await sendInteractionReply(interaction, "Failed to endow target");
				}
			}
			if (interaction.customId === "Bribe") {
				const userId = interaction.user.id;
				if (!selectedBribeTargets[userId]) {
					await sendInteractionReply(interaction, "Choose a member");
					return;
				}
				bribeTargetId = selectedBribeTargets[userId].user.id;
				if (bribeTargetId === userId) {
					await sendInteractionReply(
						interaction,
						"You cannot target yourself!"
					);
					return;
				}

				let cooldown;
				try {
					cooldown = await CacheGetCooldown("Bribe", userId);
				} catch (err) {
					showErrorMsg(err);
				}
				if (cooldown) {
					sendInteractionReply(interaction, "Bribe is on cooldown");
					return;
				}

				// Display the modal
				const modal = new ModalBuilder()
					.setCustomId("xpModal")
					.setTitle("Grant XP to Member");

				const xpInput = new TextInputBuilder()
					.setCustomId("xpAmount")
					.setLabel("XP Amount")
					.setStyle(TextInputStyle.Short)
					.setPlaceholder("Enter XP to grant")
					.setRequired(true);

				const messageInput = new TextInputBuilder()
					.setCustomId("optionalMessage")
					.setLabel("Optional Message")
					.setStyle(TextInputStyle.Paragraph)
					.setPlaceholder("Enter an optional message")
					.setRequired(false);

				const xpActionRow = new ActionRowBuilder().addComponents(xpInput);
				const messageActionRow = new ActionRowBuilder().addComponents(
					messageInput
				);

				modal.addComponents(xpActionRow, messageActionRow);

				await interaction.showModal(modal);
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

					eventEmitter.emit("StartRevolution", userId, target.user.id, "Merchant");
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
					"Merchant",
					userId,
					target.user.id
				);

				await sendInteractionReply(
					interaction,
					`You have joined the revolution with target @${target.user.username}.`
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
				);eventEmitter.on("RevolutionStarted", async () => {
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
			if(!gameState.isRevolutionActive()) 
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
	eventEmitter.on("ElectionEnthronement", async (emperorUsername) => {
		try {
			const channel = await client.channels.fetch(process.env.CHANNELIDSCHOLAR);
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
						"Merchant",
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
		}
		// Handle modal submission
		if (interaction.isModalSubmit() && interaction.customId === "xpModal") {
			const userId = interaction.user.id;
			const xpAmount = Number(interaction.fields.getTextInputValue("xpAmount"));
			const optionalMessage =
				interaction.fields.getTextInputValue("optionalMessage") ||
				"No message provided";

			try {
				const merchantXPText = await CacheGetUserXP(userId);
				const merchantXP = Number(merchantXPText);
				if (merchantXP < xpAmount) {
					await interaction.reply({
						content: `You don't have enough XP to grant ${xpAmount}. You only have ${merchantXP} XP.`,
						ephemeral: true,
					});
					return;
				}

				// Deduct XP from merchant
				await DBUpdateXP(interaction.user.id, -xpAmount, client);

				// Give XP to the target member
				const targetMember = selectedBribeTargets[userId];
				await DBUpdateXP(targetMember.user.id, xpAmount, client);
				await interaction.reply({
					content: `Successfully granted ${xpAmount} XP to ${targetMember.user.username}. Message: ${optionalMessage}`,
					ephemeral: true,
				});
				await CacheSetCooldown("Bribe", userId, BribeCoolDown);
				eventEmitter.emit("BribeComplete", targetMember.user.id);
			} catch (err) {
				showErrorMsg(err);
			}
		}
	});
	eventEmitter.on("NotifyMerchantChannel", async (msg) => {
		try {
			let channel = await client.channels.fetch(process.env.CHANNELIDMERCHANT);
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
			if(!gameState.isRevolutionActive()) 
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
	eventEmitter.on("ElectionEnthronement", async (emperorUsername) => {
		try {
			const channel = await client
				.channels.fetch(process.env.CHANNELIDMERCHANT);
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

}

async function updateMessage(client, lastMessageId, emperorReelectionSelectMenu) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDMERCHANT);
		const messageToEdit = await channel.messages.fetch(lastMessageId);

		let actionRow_0 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				[
					"peasant",
					"scholar",
					"merchant",
					"knight",
					"noble",
					"lord",
					"king",
					"emperor",
				],
				"BribeSelectMenu", TextBribeSelectMenu
			)
		);
		let actionRow_1 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				["knight", "noble", "lord", "king", "emperor"],
				"SelectRevolutionTarget", TextRevolutionTargetSelectMenu
			)
		);
		const actionRow_2 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(client, ["peasant", "scholar", "merchant", "knight", "noble"], "EndowSelectMenu", TextEndowSelectmenu)
		);
		let actionRow_3 = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("Bribe")
			.setLabel(ButtonLabelBribe)
			.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
			.setCustomId("Revolution")
			.setLabel(ButtonLabelRevolution)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.getDisableRevolution()),
			new ButtonBuilder()
			.setCustomId("Endow")
			.setLabel(ButtonLabelEndow)
			.setStyle(ButtonStyle.Primary)
		);

		let coupActive = gameState.isCoupActive();

		if (coupActive) {
			const revolutionBtn = new ButtonBuilder()
				.setCustomId("Revolution")
				.setLabel(ButtonLabelRevolution)
				.setDisabled(true)
				.setStyle(ButtonStyle.Danger);
			actionRow_3.components[1] = revolutionBtn;
		}

		if (gameState.isRevolutionActive() && !coupActive) {
			let revolutionBtn = new ButtonBuilder()
				.setCustomId("JoinRevolution")
				.setLabel(ButtonLabelJoinRevolution)
				.setStyle(ButtonStyle.Danger);
			revolutionStatusMsg = `\nRevolution washes over the land. (Joined ${gameState.getRevolutionarySize()} / ${gameState.getPeopleSize()}.)`;
			if (gameState.isRevolutionSecondPhase()) {
				actionRow_3.components[3] = new ButtonBuilder()
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
					if (actionRow_3.components[3]) actionRow_3.components.splice(3, 1);
					revolutionStatusMsg = `\nA vote for a new Emperor is underway. (${gameState.getRevolutionarySize()} votes cast)`;
				}
				if (gameState.isReelectionActive()) {
					actionRow_1 = emperorReelectionSelectMenu;
					revolutionStatusMsg = `\nThere may only be a single Emperor, a new vote is underway amongst notable contenders. (${gameState.getRevolutionarySize()} votes cast)`;
				}
			}

			actionRow_3.components[1] = revolutionBtn;
		}

		await messageToEdit.edit({
			content: initContent + revolutionStatusMsg,
			components: [actionRow_0, actionRow_1, actionRow_2, actionRow_3],
		});
	} catch (err) {
		showErrorMsg(err);
	}
}

async function messageMerchantCommands(client) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDMERCHANT);
		const actionRow_0 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				[
					"peasant",
					"scholar",
					"merchant",
					"knight",
					"noble",
					"lord",
					"king",
					"emperor",
				],
				"BribeSelectMenu", TextBribeSelectMenu
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
			await buildSelectMenu(client, ["peasant", "scholar", "merchant", "knight", "noble"], "EndowSelectMenu", TextEndowSelectmenu)
		);

		const actionRow_3 = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("Bribe")
			.setLabel(ButtonLabelBribe)
			.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
			.setCustomId("Revolution")
			.setLabel(ButtonLabelRevolution)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.getDisableRevolution()),
			new ButtonBuilder()
			.setCustomId("Endow")
			.setLabel(ButtonLabelEndow)
			.setStyle(ButtonStyle.Danger)

		);

		return await channel.send({
			content: initContent,
			components: [actionRow_0, actionRow_1, actionRow_2, actionRow_3],
		});
	} catch (err) {
		showErrorMsg(err);
	}
}



module.exports = { setupMerchantBotEvents, messageMerchantCommands };
