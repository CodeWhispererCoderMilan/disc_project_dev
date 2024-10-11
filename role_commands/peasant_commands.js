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
	PeasantMobFlayingVoteTime,
	PeasantMobFlayingWinningRate,
	PeasantMobFlayingCoolDown,
} = require("../game_config.json");
const { eventEmitter } = require("../functions/eventEmitter.js");

let selectedMembers = {};
let roleMembers = [];
let roleMembersSize = 1;
let pollInitiatorId = null;
let pollInitiatorUsername = null;
let pollTargetName = null;
let pollTargetId = null;
let pollActive = false;
let pollParticipants = new Set();
let eventListenersSetUp = false; // Flag to track if event listeners are set up
let pollTimeout;

let interactions = [];

const initContent =
	"Peasants can trigger a timed poll to strip a target of their role by selecting SUBHUMAN or PEASANT in a menu and clicking a button. If over 50% of participants join before the timer ends, the target's role is changed to POOP; otherwise, the attempt fails. A global cooldown is activated after each use.\n\n" +
	"**Abilities:**\n" +
	"- **Mob Flaying**: With more than 50% of peasants, you can make one sub-human or peasant to poop.";

function showErrorMsg(err) {
	console.error("ERROR: peasant_commands.js", err);
}

async function setupPeasantBotEvents(client, lastMessageId) {
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

		const channel = await client.channels.fetch(process.env.CHANNELIDPEASANT);
		const messageToEdit = await channel.messages.fetch(lastMessageId);
		if (pollActive && hadRoleBeforePeasant && !hasRoleNowPeasant) {
			if (pollParticipants.has(newMember.id)) {
				try {
					selectedMembers[newMember.id] = null;
					pollParticipants.delete(newMember.id);

					if (newMember.id === pollInitiatorId) {
						// If the initiator lost the role, reset the poll
						await client.emit(
							"MobFlayingInitiatorRoleChanged",
							pollInitiatorUsername
						);
						pollActive = false;
						await triggerPollEarly(client, messageToEdit);
						return;
					}
				} catch (err) {
					showErrorMsg(err);
				}
			}
		}
		if (
			pollActive &&
			((hadRoleBeforePeasant && !hasRoleNowPeasant) ||
				(hadRoleBeforeSubHuman && !hasRoleNowSubhuman))
		) {
			if (newMember.id === pollTargetId) {
				try {
					// If the poll target lost the role, reset the poll
					await client.emit("MobFlayingTargetRoleChanged", pollTargetName);
					pollActive = false;
					await triggerPollEarly(client, messageToEdit);
					return;
				} catch (err) {
					showErrorMsg(err);
				}
			}
		}
		if (
			hadRoleBeforePeasant ||
			hasRoleNowPeasant ||
			hadRoleBeforeSubHuman ||
			hasRoleNowSubhuman
		) {
			if (lastMessageId) {
				try {
					const guild = await client.guilds.fetch(process.env.GUILDID);
					await guild.members.fetch();
					roleMembers = guild.members.cache.filter((member) =>
						member.roles.cache.has(process.env.ROLEID_PEASANT)
					);
					roleMembersSize = roleMembers.size;

					let content = initContent;
					if (pollActive) {
						content =
							content +
							`\n@${pollInitiatorUsername} initiated a poll. Join poll to downgrade ${pollTargetName}. (Joined ${pollParticipants.size} / ${roleMembersSize}.)`;
						const participationRate = pollParticipants.size / roleMembersSize;
						if (participationRate >= PeasantMobFlayingWinningRate) {
							triggerPollEarly(client, messageToEdit);
							return;
						}
					}
					const actionRow_0 = ActionRowBuilder.from(
						messageToEdit.components[0].toJSON()
					);

					if (pollActive) {
						const memberSelectMenu = StringSelectMenuBuilder.from(
							actionRow_0.components[0].toJSON()
						)
							.setDisabled(true)
							.setPlaceholder(pollInitiatorUsername);
						actionRow_0.components[0] = memberSelectMenu;
					} else {
						const memberSelectMenu = await buildSelectMenu(
							client,
							["peasant", "subhuman"],
							"MembersSelectMenu"
						);
						actionRow_0.components[0] = memberSelectMenu;
					}
					const existingComponents = messageToEdit.components.map((component) =>
						ActionRowBuilder.from(component.toJSON())
					);
					const actionRow_1 = ActionRowBuilder.from(
						messageToEdit.components[1].toJSON()
					);
					if (pollActive) {
						const pollButton = ButtonBuilder.from(
							actionRow_1.components[0].toJSON()
						);
						pollButton.setDisabled(true);
						const joinPollButton = new ButtonBuilder()
							.setCustomId("JoinPoll")
							.setLabel("Join Poll")
							.setStyle(ButtonStyle.Primary);
						actionRow_1.components[0] = pollButton;
						actionRow_1.components[1] = joinPollButton;
						existingComponents[1] = actionRow_1;
					} else {
						// Reset poll button
						const buttonRow = new ActionRowBuilder().addComponents(
							new ButtonBuilder()
							.setCustomId("TimedPoll")
							.setLabel("Mob Flaying")
							.setStyle(ButtonStyle.Danger)
						);
						existingComponents[1] = buttonRow;
					}
					existingComponents[0] = actionRow_0;
					await messageToEdit.edit({
						content,
						components: existingComponents,
					});
				} catch (err) {
					showErrorMsg(err);
				}
			}
		}
	});

	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

		if (interaction.customId === "MembersSelectMenu") {
			const userId = interaction.user.id;
			let selectedMemberId = interaction.values[0];
			try {
				selectedMembers[userId] = await interaction.guild.members.cache.get(
					selectedMemberId
				);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "TimedPoll") {
			const userId = interaction.user.id;
			roleMembers = interaction.guild.members.cache.filter((member) =>
				member.roles.cache.has(process.env.ROLEID_PEASANT)
			);
			roleMembersSize = roleMembers.size;

			if (!selectedMembers[userId]) {
				await sendInteractionReply(interaction, "No member selected");
				return;
			}

			let cooldown;
			try {
				cooldown = await CacheGetCooldown("PeasantMobFlaying", userId);
			} catch (err) {
				showErrorMsg(err);
			}
			if (cooldown) {
				await sendInteractionReply(interaction, "Mob flaying is on cooldown");
				return;
			}

			if (selectedMembers[userId].user.id === userId) {
				await sendInteractionReply(interaction, "You cannot target yourself.");
				return;
			}

			pollInitiatorId = userId;
			pollInitiatorUsername = interaction.user.username;
			pollParticipants.add(userId);
			pollActive = true;
			pollTargetName = selectedMembers[userId].user.username;
			pollTargetId = selectedMembers[userId].user.id;

			interactions = [];
			interactions.push(interaction);

			const channel = await client.channels.fetch(process.env.CHANNELIDPEASANT);
			if (lastMessageId) {
				try {
					// Set cooldown
					await CacheSetCooldown(
						"PeasantMobFlaying",
						userId,
						PeasantMobFlayingCoolDown
					);

					const messageToEdit = await channel.messages.fetch(lastMessageId);
					const actionRow_0 = ActionRowBuilder.from(
						messageToEdit.components[0].toJSON()
					);
					const memberSelectMenu = StringSelectMenuBuilder.from(
						actionRow_0.components[0].toJSON()
					)
						.setDisabled(true)
						.setPlaceholder(selectedMembers[userId].user.username);
					actionRow_0.components[0] = memberSelectMenu;

					const actionRow_1 = ActionRowBuilder.from(
						messageToEdit.components[1].toJSON()
					);
					const pollButton = ButtonBuilder.from(
						actionRow_1.components[0].toJSON()
					);
					pollButton.setDisabled(true);
					const joinPollButton = new ButtonBuilder()
						.setCustomId("JoinPoll")
						.setLabel("Join Poll")
						.setStyle(ButtonStyle.Primary);
					actionRow_1.components[0] = pollButton;
					actionRow_1.components[1] = joinPollButton;

					const content =
						initContent +
						`\n@${pollInitiatorUsername} initiated a poll. Join poll to downgrade ${pollTargetName}. (Joined ${pollParticipants.size} / ${roleMembersSize}.)`;
					await messageToEdit.edit({
						content,
						components: [actionRow_0, actionRow_1],
					});

					await startPoll(client, messageToEdit, PeasantMobFlayingVoteTime);

					if (!interaction.deferred && !interaction.replied) {
						await interaction.deferReply({ ephemeral: true });
					}

					await sendInteractionReply(
						interaction,
						"Timed poll initiated, waiting for other peasants to join your poll"
					);

					const participationRate = pollParticipants.size / roleMembersSize;
					if (participationRate >= PeasantMobFlayingWinningRate) {
						triggerPollEarly(client, messageToEdit);
						return;
					}
				} catch (err) {
					showErrorMsg(err);
				}
			}
		}
		if (interaction.customId === "JoinPoll") {
			try {
				if (!pollActive) {
					await sendInteractionReply(
						interaction,
						"There is no active poll to join."
					);
					return;
				}

				const userId = interaction.user.id;
				if (userId === pollInitiatorId) {
					await sendInteractionReply(
						interaction,
						"Once you created a poll, you don't need to join your poll since you are alreday a participant."
					);
					return;
				}

				if (pollParticipants.has(userId)) {
					await sendInteractionReply(
						interaction,
						"You've already joined this poll."
					);
					return;
				}

				interactions.push(interaction);
				pollParticipants.add(userId);
				await sendInteractionReply(interaction, "You have joind the poll.");

				const participationRate = pollParticipants.size / roleMembersSize;
				const channel = await client.channels.fetch(
					process.env.CHANNELIDPEASANT
				);
				const messageToEdit = await channel.messages.fetch(lastMessageId);
				if (pollActive && participationRate >= PeasantMobFlayingWinningRate) {
					//If poll succeeded within voting ending time.
						triggerPollEarly(client, messageToEdit);
					return;
				} else {
					const editedContent =
						initContent +
						`\n@${pollInitiatorUsername} initiated a poll. Join poll to downgrade ${pollTargetName}. (Joined ${pollParticipants.size} / ${roleMembersSize}.)`;

					await messageToEdit.edit({ content: editedContent });
				}
			} catch (err) {
				throw err;
			}
		}
	});
	if (!eventListenersSetUp) {
		eventEmitter.on(
			"MobFlayingComplete",
			async (targetName, initiatorUsername) => {
				try {
					const message =
						"Mob flaying successful! " +
						targetName +
						" has become a poop by " +
						initiatorUsername +
						".";
					sendMessage(message);
				} catch (err) {
					throw err;
				}
			}
		);

		eventEmitter.on(
			"MobFlayingFailed",
			async (targetName, initiatorUsername) => {
				try {
					const message =
						"Mob flaying on " +
						targetName +
						" initiated by " +
						initiatorUsername +
						" has been failed.";

					sendMessage(message);
				} catch (err) {
					throw err;
				}
			}
		);

		client.on("MobFlayingInitiatorRoleChanged", async (username) => {
			try {
				const message =
					"The initiator " + username + " is no longer a peasant.";
				sendMessage(message);
			} catch (err) {
				throw err;
			}
		});

		client.on("MobFlayingTargetRoleChanged", async (username) => {
			try {
				const message = "The role of the target " + username + " has changed.";
				sendMessage(message);
			} catch (err) {
				throw err;
			}
		});

		eventListenersSetUp = true; // Set the flag to true
	}
}

async function startPoll(client, messageToEdit, timeout) {
	pollTimeout = setTimeout(async () => {
		await handlePollEnd(client, messageToEdit);
	}, timeout);
}

async function handlePollEnd(client, messageToEdit) {
	const participationRate = pollParticipants.size / roleMembersSize;
	if (pollActive && participationRate >= PeasantMobFlayingWinningRate) {
		// If Timed poll is sucessful
		const member = selectedMembers[pollInitiatorId];
		if (member)
			eventEmitter.emit("changeRole", selectedMembers[pollInitiatorId], "Poop");
		eventEmitter.emit(
			"MobFlayingComplete",
			pollTargetName,
			pollInitiatorUsername
		);
		await resetPoll(client, messageToEdit);
	} else {
		eventEmitter.emit(
			"MobFlayingFailed",
			pollTargetName,
			pollInitiatorUsername
		);
		await resetPoll(client, messageToEdit);
	}
}

// Function to trigger the poll early
async function triggerPollEarly(client, messageToEdit) {
	if (pollTimeout) {
		clearTimeout(pollTimeout); // Clear the original timeout
		await handlePollEnd(client, messageToEdit); // Manually trigger poll logic
	}
}

async function sendMessage(message) {
	for (const interaction of interactions) {
		if (!interaction) continue;
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({ content: message, ephemeral: true });
		} else {
			await interaction.followUp({ content: message, ephemeral: true });
		}
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
		const selectMenuSubhumanPeasants = await buildSelectMenu(
			client,
			["peasant", "subhuman"],
			"MembersSelectMenu"
		);
		const row_subhuman_peasant_select = new ActionRowBuilder().addComponents(
			selectMenuSubhumanPeasants
		);
		const buttonRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("TimedPoll")
			.setLabel("Mob Flaying")
			.setStyle(ButtonStyle.Danger)
		);

		const message = await channel.send({
			content: initContent,
			components: [row_subhuman_peasant_select, buttonRow],
		});
		return message;
	} catch (err) {
		showErrorMsg(err);
	}
}

async function resetPoll(client, messageToEdit) {
	try {
		pollActive = false;
		pollInitiatorUsername = null;
		pollTargetName = null;
		pollTargetId = null;
		selectedMembers = {};
		pollInitiatorId = null;
		pollParticipants.clear();
		roleMembersSize = 1;
		roleMembers = [];

		const actionRow_0 = ActionRowBuilder.from(
			messageToEdit.components[0].toJSON()
		);

		const memberSelectMenu = await buildSelectMenu(
			client,
			["peasant", "subhuman"],
			"MembersSelectMenu"
		);

		actionRow_0.components[0] = memberSelectMenu;

		// Reset poll button
		const buttonRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("TimedPoll")
			.setLabel("Mob Flaying")
			.setStyle(ButtonStyle.Danger)
		);

		await messageToEdit.edit({
			content: initContent,
			components: [actionRow_0, buttonRow],
		});
	} catch (err) {
		throw err;
	}
}

module.exports = { setupPeasantBotEvents, messagePeasantCommands };
