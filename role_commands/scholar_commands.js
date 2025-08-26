const {
	StringSelectMenuBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
} = require("discord.js");
const gameState = require("../game_state.js");
const {
	buildSelectMenu,
	sendInteractionReply,
} = require("../functions/botActions");
const {
	CacheGetCooldown,
	CacheSetCooldown,
} = require("../apis/redis/redisCache");
const {
	AdviseCooldown,
	RoleChangeMessageDisplayTime,
	TextScholarMessageContent,
	TextEmperorCandidateSelectMenu,
	TextRevolutionTargetSelectMenu,
	ButtonLabelWithdrawRevolution,
	ButtonLabelJoinRevolution,
	ButtonLabelRevolution,
	ButtonLabelVoteEmperor,
	ButtonLabelAdvise
} = require("../game_config.json");
const { eventEmitter } = require("../functions/eventEmitter.js");

let selectedRevolutionTargets = {};
const initContent =TextScholarMessageContent;
let revolutionStatusMsg = "";

function showErrorMsg(err) {
	console.error("ERROR: scholar_commands.js", err);
}

async function setupScholarBotEvents(client, lastMessageId) {
	eventEmitter.on("DisableRevolution", async () => {
		if(!gameState.isRevolutionActive() && !gameState.isCoupActive()) await updateMessage(client, lastMessageId);
	});
	eventEmitter.on("EnableRevolution", async () => {
		if(!gameState.isRevolutionActive() && !gameState.isCoupActive()) await updateMessage(client, lastMessageId);
	});
	client.on("guildMemberRemove", async(member) => {
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

		if (
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
	});
	client.on("interactionCreate", async (interaction) => {
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
			if (interaction.customId === "Advise") {
				const userId = interaction.user.id;

				const modal = new ModalBuilder()
					.setCustomId("adviseModal")
					.setTitle("Send Message to Royal Castle");

				const messageInput = new TextInputBuilder()
					.setCustomId("messageInput")
					.setLabel("Enter your message:")
					.setStyle(TextInputStyle.Paragraph);

				const actionRow = new ActionRowBuilder().addComponents(messageInput);

				modal.addComponents(actionRow);

				const cooldown = await CacheGetCooldown("Advise", userId);
				if (cooldown) {
					await sendInteractionReply(
						interaction,
						"Advise is on cooldown and cannot be used"
					);

					return;
				}

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
					await sendInteractionReply(
						interaction,
						"You cannot target yourself."
					);
					return;
				}


				try {

					eventEmitter.emit("StartRevolution", userId, target.user.id, "Scholar");
					await sendInteractionReply(
						interaction,
						"Revolution started, waiting for others to join."
					);
				} catch (err) {
					showErrorMsg(err);
				}
			}
			if (interaction.customId === "JoinRevolution") {
				if (!gameState.isRevolutionActive()) {
					await sendInteractionReply(
						interaction,
						"No revolution ongoing, messages will sync soon."
					);
					return;
				}
				const userId = interaction.user.id;
				if (!selectedRevolutionTargets[userId]) {
					await sendInteractionReply(interaction, "No member selected");
					return;
				}
				const isRevolutionParticipant = gameState.isRevolutionParticipant(userId);
				if (isRevolutionParticipant) {
					await sendInteractionReply(
						interaction,
						"You've already joined revolution."
					);
					return;
				}

				const target = selectedRevolutionTargets[userId];

				eventEmitter.emit(
					"AddRevolutionParticipant",
					"Scholar",
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

					const candidate = selectedRevolutionTargets[userId];

					eventEmitter.emit(
						"AddRevolutionParticipant",
						"Scholar",
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

		if (interaction.isModalSubmit()) {
			if (interaction.customId === "adviseModal") {
				const userId = interaction.user.id;
				const message = interaction.fields.getTextInputValue("messageInput");

				try {
					// Defer reply to avoid timeout
					await interaction.deferReply({ ephemeral: true });

					// Emit event
					eventEmitter.emit("sendMessageToRoyalCastle", userId, message);

					// Set cooldown (e.g., 60 seconds)
					await CacheSetCooldown("advise", userId, AdviseCooldown);

					await sendInteractionReply(
						interaction,
						"You have successfuly sent message to the royal castle."
					);
				} catch (err) {
					showErrorMsg(err);
				}
			}
		}
	});
	eventEmitter.on("NotifyScholarChannel", async (msg) => {
		try {
			let channel = await client.channels.fetch(process.env.CHANNELIDSCHOLAR);
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
			if(gameState.isRevolutionActive() && !gameState.isCoupActive())
				await updateMessage(client, lastMessageId);
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

async function updateMessage(client, lastMessageId, emperorReelectionSelectMenu) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDSCHOLAR);
		const messageToEdit = await channel.messages.fetch(lastMessageId);

		let actionRow_0 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				["knight", "noble", "lord", "king", "emperor"],
				"SelectRevolutionTarget", TextRevolutionTargetSelectMenu
			)
		);
		let actionRow_1 = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("Advise")
			.setLabel(ButtonLabelAdvise)
			.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
			.setCustomId("Revolution")
			.setLabel(ButtonLabelRevolution)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.getDisableRevolution())
		);
		let coupActive = gameState.isCoupActive();
		if (coupActive) {
			const revolutionBtn = new ButtonBuilder()
				.setCustomId("Revolution")
				.setLabel(ButtonLabelRevolution)
				.setDisabled(true)
				.setStyle(ButtonStyle.Danger);
			actionRow_1.components[1] = revolutionBtn;
		}

		if (gameState.isRevolutionActive() && !coupActive) {
			let revolutionBtn = new ButtonBuilder()
				.setCustomId("JoinRevolution")
				.setLabel(ButtonLabelJoinRevolution)
				.setStyle(ButtonStyle.Danger);
			revolutionStatusMsg = `\n Revolution washes over the Land. (Joined ${gameState.getRevolutionarySize()} / ${gameState.getPeopleSize()}.)`;
			if (gameState.isRevolutionSecondPhase()) {
				actionRow_1.components[2] = new ButtonBuilder()
					.setCustomId("WithdrawRevolution")
					.setLabel(ButtonLabelWithdrawRevolution)
					.setStyle(ButtonStyle.Primary);

				revolutionStatusMsg = `\nRevolution moved in the next phase. townsfolk may still join, those who've joined may withdraw. (Joined ${gameState.getRevolutionarySize()} / ${gameState.getPeopleSize()}.)`;
				if (gameState.isEmperorElectionActive()) {
					actionRow_0 = new ActionRowBuilder().addComponents(
						await buildSelectMenu(
							client,
							["knight", "noble", "lord", "king"],
							"SelectEmperorCandidate",TextEmperorCandidateSelectMenu
						)
					);
					revolutionBtn = new ButtonBuilder()
						.setCustomId("VoteEmperor")
						.setLabel(ButtonLabelVoteEmperor)
						.setStyle(ButtonStyle.Danger);
					if (actionRow_1.components[2]) actionRow_1.components.splice(2, 1);
					revolutionStatusMsg = `\nLet's vote a new emperor.  (Joined ${revolutionarySize} members.)`;
				}
				if (gameState.isReelectionActive()) {
					actionRow_0 = emperorReelectionSelectMenu;
					revolutionStatusMsg = `\nEmperor must be only one. Let's reelect an emperor. (Joined ${gameState.getRevolutionarySize()} members.)`; }
			}

			actionRow_1.components[1] = revolutionBtn;
		}

		await messageToEdit.edit({
			content: initContent + revolutionStatusMsg,
			components: [actionRow_0, actionRow_1],
		});
	} catch (err) {

		showErrorMsg(err);
	}
}

async function messageScholarCommands(client) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDSCHOLAR);
		const actionRow_0 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				["knight", "noble", "lord", "king", "emperor"],
				"SelectRevolutionTarget", TextRevolutionTargetSelectMenu
			)
		);
		const actionRow_1 = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("Advise")
			.setLabel(ButtonLabelAdvise)
			.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
			.setCustomId("Revolution")
			.setLabel(ButtonLabelRevolution)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.getDisableRevolution())
		);

		return await channel.send({
			content: initContent,
			components: [actionRow_0, actionRow_1],
		});
	} catch (err) {
		showErrorMsg(err);
	}
}

module.exports = { setupScholarBotEvents, messageScholarCommands };
