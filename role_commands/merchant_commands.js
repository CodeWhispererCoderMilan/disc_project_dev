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
	RevolutionCoolDown,
	RoleChangeMessageDisplayTime,
	EndowDuration
} = require("../game_config.json");
const { eventEmitter } = require("../functions/eventEmitter.js");

let selectedBribeTargets = {};
let bribeTargetId = null;
let merchants = [];
let merchantsSize = 1;
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
let selectedEndowTargets = {};

const initContent =
	"Merchants can trigger bride to give xp to a target by selecting Peasant,Merchant,Knight, Noble, Lord or King in a menu and clicking a button. There will be displayed a modal and should enter xp and message(optional) to give.\n\n" +
	"**Abilities:**\n" +
	"- **Bribe**: Enter xp and message to give to a target.\n" +
	"- **Revolution**: Let's make a new world!\n"+
	"- **Endow**: Endow a target to receive half their future XP gains while they receive 1.5x XP.\n";
let revolutionStatusMsg = "";

function showErrorMsg(err) {
	console.error("ERROR: merchant_commands.js", err);
}


async function setupMerchantBotEvents(client, lastMessageId) {
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
		if (revolutionActive && (hadRoleBeforeMerchant || hasRoleNowMerchant)) {
			const guild = await client.guilds.fetch(process.env.GUILDID);
			merchants = guild.members.cache.filter((member) =>
				member.roles.cache.has(process.env.ROLEID_MERCHANT)
			);
			merchantsSize = merchants.size;
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
				"Merchant",
				revolutionParticipants,
				merchantsSize
			);
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

				try {
					const endowExists = await CacheCheckEndowExists(userId, targetId);
					if (endowExists) {
						await sendInteractionReply(interaction, "You have already endowed this target!");
						return;
					}

					const endTime = Date.now() + EndowDuration;
					await CacheSetEndow(userId, targetId, endTime);

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
					await sendInteractionReply(
						interaction,
						"You cannot target yourself."
					);
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
					Object.keys(revolutionParticipants).findIndex(
						(key) => key === userId
					) > -1
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
					"Merchant",
					revolutionParticipants,
					merchantsSize
				);

				await sendInteractionReply(
					interaction,
					`You have joined the revolution with target @${target.user.username}.`
				);
			}
			if (interaction.customId === "WithdrawRevolution") {
				const userId = interaction.user.id;
				if (
					Object.keys(revolutionParticipants).findIndex(
						(key) => key === userId
					) < 0
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
					"Merchant",
					revolutionParticipants,
					merchantsSize
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
						"Merchant",
						revolutionParticipants,
						merchantsSize
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
			const guild = await client.guilds.fetch(process.env.GUILDID);
			merchants = guild.members.cache.filter((member) =>
				member.roles.cache.has(process.env.ROLEID_MERCHANT)
			);
			merchantsSize = merchants.size;
			revolutionActive = true;
			eventEmitter.emit(
				"SendRevolutionStatus",
				"Merchant",
				revolutionParticipants,
				merchantsSize
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

async function updateMessage(client, lastMessageId) {
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
				"BribeSelectMenu"
			)
		);
		let actionRow_1 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				["knight", "noble", "lord", "king", "emperor"],
				"SelectRevolutionTarget"
			)
		);
		const actionRow_2 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(client, ["peasant", "scholar", "merchant", "knight", "noble"], "EndowSelectMenu")
		);
		let actionRow_3 = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("Bribe")
			.setLabel("Bribe")
			.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
			.setCustomId("Revolution")
			.setLabel("Revolution")
			.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
			.setCustomId("Endow")
			.setLabel("Endow")
			.setStyle(ButtonStyle.Primary)
		);

		if (coupActive) {
			const revolutionBtn = new ButtonBuilder()
				.setCustomId("Revolution")
				.setLabel("Revolution")
				.setDisabled(true)
				.setStyle(ButtonStyle.Danger);
			actionRow_3.components[1] = revolutionBtn;
		}

		if (revolutionActive) {
			let revolutionBtn = new ButtonBuilder()
				.setCustomId("JoinRevolution")
				.setLabel("Join Revolution")
				.setStyle(ButtonStyle.Danger);
			revolutionStatusMsg = `\nRevolution started. Join revolution. (Joined ${revolutionarySize} / ${peopleSize}.)`;
			if (revolutionSecondPhase) {
				actionRow_3.components[3] = new ButtonBuilder()
					.setCustomId("WithdrawRevolution")
					.setLabel("Withdraw Revolution")
					.setStyle(ButtonStyle.Primary);

				revolutionStatusMsg = `\nRevolution moved in the next phase. Join revolution. You can also withdraw. (Joined ${revolutionarySize} / ${peopleSize}.)`;
				if (emperorElectionActive) {
					actionRow_1 = new ActionRowBuilder().addComponents(
						await buildSelectMenu(
							client,
							["knight", "noble", "lord", "king"],
							"SelectEmperorCandidate"
						)
					);
					revolutionBtn = new ButtonBuilder()
						.setCustomId("VoteEmperor")
						.setLabel("Vote")
						.setStyle(ButtonStyle.Danger);
					if (actionRow_3.components[3]) actionRow_3.components.splice(3, 1);
					revolutionStatusMsg = `\nLet's vote a new emperor.  (Joined ${revolutionarySize} members.)`;
				}
				if (reelectionActive) {
					actionRow_1 = new ActionRowBuilder().addComponents(
						new StringSelectMenuBuilder()
						.setCustomId("SelectEmperorCandidate")
						.setPlaceholder("Choose a candidate")
						.addOptions(candidates)
					);

					revolutionStatusMsg = `\nEmperor must be only one. Let's reelect an emperor. (Joined ${revolutionarySize} members.)`;
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
				"BribeSelectMenu"
			)
		);
		const actionRow_1 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				["knight", "noble", "lord", "king", "emperor"],
				"SelectRevolutionTarget"
			)
		);
		const actionRow_2 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(client, ["peasant", "scholar", "merchant", "knight", "noble"], "EndowSelectMenu")
		);

		const actionRow_3 = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("Bribe")
			.setLabel("Bribe")
			.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
			.setCustomId("Revolution")
			.setLabel("Revolution")
			.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
			.setCustomId("Endow")
			.setLabel("Endow")
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

module.exports = { setupMerchantBotEvents, messageMerchantCommands };
