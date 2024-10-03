const {
	StringSelectMenuBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle
} = require("discord.js");
const {
	buildSelectMenu,
	sendInteractionReply,
} = require("../functions/botActions");
const {
	CacheGetCooldown,
	CacheSetCooldown,
	CacheGetUserXP,
	CacheGetWriterWrits,
	CacheSetWrit
} = require("../apis/redis/redisCache");

const {
	NobleTimedPollDuration,
	NobleTimedPollWinningRate,
	GlobalCoolDown,
	HighWritCost,
	HighWritCooldown
} = require("../game_config.json");
const { eventEmitter } = require("../functions/eventEmitter.js");
const { DBUpdateXP } = require("../apis/firebase/querys");

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
const selectedHumans = {};
const selectedKnights = {};


let interactions = [];

function showErrorMsg(err) {
	console.error("ERROR: noble_commands.js", err);
}

const initContent =
	"Nobles can trigger a timed poll to strip a target of their role by selecting Knight, Noble or Lord in a menu and clicking a button. If over 3 of participants join before the timer ends, the target's role is changed to POOP; otherwise, the attempt fails. A global cooldown is activated after each use.\n\n" +
	"**Abilities:**\n" +
	"- **Timed Poll**: With more than 3 of Nobles, you can make one knight, noble or lord to poop.";

async function setupNobleBotEvents(client, lastMessageId) {
	client.on("guildMemberUpdate", async (oldMember, newMember) => {
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
		const channel = await client.channels.fetch(process.env.CHANNELIDNOBLE);
		const messageToEdit = await channel.messages.fetch(lastMessageId);
		if (oldMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
			oldMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
			oldMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
			oldMember.roles.cache.has(process.env.ROLEID_KNIGHT) ||
			newMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
			newMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
			newMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
			newMember.roles.cache.has(process.env.ROLEID_KNIGHT)) {
			await updateSelectMenu(client, lastMessageId);
			for(let userId in selectedHumans){
				if(selectedHumans[userId] && selectedHumans[userId].id === oldMember.id){
					selectedHumans[userId] = null;
				}
			}
			for(let userId in selectedKnights){
				if(selectedKnights[userId] && selectedKnights[userId].id === oldMember.id){
					selectedHumans[userId] = null;
				}
			}
		}
		if (pollActive && hasRoleNowNoble && !hadRoleBeforeNoble) {
			if (pollParticipants.has(newMember.id)) {
				try {
					selectedMembers[newMember.id] = null;
					pollParticipants.delete(newMember.id);

					if (newMember.id === pollInitiatorId) {
						// If the initiator lost the role, reset the poll
						await client.emit(
							"NoblePollTimedInitiatorRoleChanged",
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
			((hadRoleBeforeKnight && !hasRoleNowKnight) ||
				(hadRoleBeforeNoble && !hasRoleNowNoble) ||
				(hadRoleBeforeLord && !hasRoleNowLord))
		) {
			if (newMember.id === pollTargetId) {
				try {
					// If the target lost the role, reset the poll
					await client.emit("NoblePollTimedTargetRoleChanged", pollTargetName);
					pollActive = false;
					await triggerPollEarly(client, messageToEdit);
					return;
				} catch (e) {
					showErrorMsg(e);
				}
			}
		}
		if (
			hadRoleBeforeKnight ||
			hasRoleNowKnight ||
			hadRoleBeforeNoble ||
			hasRoleNowNoble ||
			hadRoleBeforeLord ||
			hasRoleNowLord
		) {
			if (lastMessageId) {
				try {
					const guild = await client.guilds.fetch(process.env.GUILDID);
					await guild.members.fetch();
					roleMembers = guild.members.cache.filter((member) =>
						member.roles.cache.has(process.env.ROLEID_NOBLE)
					);
					roleMembersSize = roleMembers.size;

					const channel = await client.channels.fetch(
						process.env.CHANNELIDNOBLE
					);
					const messageToEdit = await channel.messages.fetch(lastMessageId);
					let content = initContent;
					if (pollActive) {
						content =
							content +
							`\n@${pollInitiatorUsername} initiated a poll. Join poll to downgrade ${pollTargetName}. (Joined ${pollParticipants.size} / ${roleMembersSize}.)`;
						if (pollParticipants.size >= NobleTimedPollWinningRate) {
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
							["knight", "noble", "lord"],
							"MembersSelectMenu"
						);
						actionRow_0.components[0] = memberSelectMenu;
					}
					const existingComponents = messageToEdit.components.map((component) =>
						ActionRowBuilder.from(component.toJSON())
					);
					var actionRow_3;  
					if (pollActive) {
						actionRow_3 = new ActionRowBuilder().addComponents(
							new ButtonBuilder()
							.setCustomId("JoinPoll")
							.setLabel("Join Poll")
							.setStyle(ButtonStyle.Primary),
							new ButtonBuilder()
							.setCustomId("HighWrit")
							.setLabel("Writ")
							.setStyle(ButtonStyle.Primary)
						);
						existingComponents[3] = actionRow_3;
					} else {
						const buttonRow = new ActionRowBuilder().addComponents(
							new ButtonBuilder()
							.setCustomId("TimedPoll")
							.setLabel("Timed Poll")
							.setStyle(ButtonStyle.Danger),
							new ButtonBuilder()
							.setCustomId("HighWrit")
							.setLabel("Writ")
							.setStyle(ButtonStyle.Primary)

						);
						existingComponents[3] = buttonRow;
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
		if (!interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return;
		const userId = interaction.user.id;
		if (interaction.customId === "SelectHuman") {
			let selectedUserId = interaction.values[0];
			try {
				await interaction.deferUpdate();
				selectedHumans[userId] = await interaction.guild.members.cache.get(selectedUserId);
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "SelectKnight") {
			let selectedUserId = interaction.values[0];
			try {
				await interaction.deferUpdate();
				selectedKnights[userId] = await interaction.guild.members.cache.get(selectedUserId);
			}catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "HighWrit") {
			try {

				if (!selectedHumans[userId] || !selectedKnights[userId]){
					await sendInteractionReply(interaction, "No knight or target selected.");
					return;
				}
				const userXP = await CacheGetUserXP(userId);
				if (userXP < HighWritCost) {
					await sendInteractionReply(interaction, `Not enough XP (current XP: ${userXP})`)
				} else {
					const cooldown = await CacheGetCooldown("highWrit", userId);
					if (cooldown)
						await sendInteractionReply(interaction, "High Writ is on cooldown and cannot be used.");
					else {
						const modal = buildHighWritModal();
						await interaction.showModal(modal);
					}
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "HighWritModal"){
			try{
				const writMessage = interaction.fields.getTextInputValue('messageToKnight');
				await CacheSetWrit(1, userId, selectedKnights[userId].id, selectedHumans[userId].id, 0, writMessage);
				const userXP = await CacheGetUserXP(userId);
				await DBUpdateXP(userId, HighWritCost, client);
				await CacheSetCooldown("highWrit", userId, HighWritCooldown);
				await sendInteractionReply(interaction, `High Writ of execution succesfully emitted! (XP left: ${userXP - HighWritCost})`);
			}catch(err){
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "ShowWrits") {
			await interaction.deferUpdate();
			await handleShowWrits(interaction);
		}
		if (interaction.customId === "MembersSelectMenu") {
			let selectedMemberId = interaction.values[0];
			try {
				await interaction.deferUpdate();
				selectedMembers[userId] = await interaction.guild.members.cache.get(
					selectedMemberId
				);
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "TimedPoll") {
			roleMembers = interaction.guild.members.cache.filter((member) =>
				member.roles.cache.has(process.env.ROLEID_NOBLE)
			);
			roleMembersSize = roleMembers.size;

			let cooldown;
			try {
				cooldown = await CacheGetCooldown("NobleCooldown", userId);
			} catch (err) {
				showErrorMsg(err);
			}
			if (cooldown) {
				sendInteractionReply(interaction, "Timed Poll is on cooldown");
				return;
			}

			if (!selectedMembers[userId]) {
				sendInteractionReply(interaction, "No member selected");
				return;
			}

			if (selectedMembers[userId].user.id === userId) {
				sendInteractionReply(interaction, "You cannot target yourself.");
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

			const channel = await client.channels.fetch(process.env.CHANNELIDNOBLE);
			if (lastMessageId) {
				try {
					// Set cooldown
					await CacheSetCooldown("NobleCooldown", userId, GlobalCoolDown);

					const messageToEdit = await channel.messages.fetch(lastMessageId);
					const existingComponents = messageToEdit.components.map(component => ActionRowBuilder.from(component.toJSON()));
					const actionRow_0 = ActionRowBuilder.from(
						messageToEdit.components[0].toJSON()
					);
					const memberSelectMenu = StringSelectMenuBuilder.from(
						actionRow_0.components[0].toJSON()
					)
						.setDisabled(true)
						.setPlaceholder(selectedMembers[userId].user.username);
					actionRow_0.components[0] = memberSelectMenu;
					const actionRow_3 = new ActionRowBuilder().addComponents(
						new ButtonBuilder()
						.setCustomId("JoinPoll")
						.setLabel("Join Poll")
						.setStyle(ButtonStyle.Primary),
						new ButtonBuilder()
						.setCustomId("HighWrit")
						.setLabel("Writ")
						.setStyle(ButtonStyle.Primary)
					);
					existingComponents[0] = actionRow_0;
					existingComponents[3] = actionRow_3;
					const content =
						initContent +
						`\n@${pollInitiatorUsername} initiated a poll. Join poll to downgrade ${pollTargetName}. (Joined ${pollParticipants.size} / ${roleMembersSize}.)`;
					await messageToEdit.edit({
						content,
						components: existingComponents,
					});

					await startPoll(client, messageToEdit, NobleTimedPollDuration);

					await sendInteractionReply(
						interaction,
						"Timed poll initiated, waiting for other nobles to join your poll"
					);
					if (pollParticipants.size >= NobleTimedPollWinningRate) {
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

				const channel = await client.channels.fetch(process.env.CHANNELIDNOBLE);
				const messageToEdit = await channel.messages.fetch(lastMessageId);
				if (pollActive && pollParticipants.size >= NobleTimedPollWinningRate) {
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
			"TimedPollSuccessful",
			async (targetName, initiatorUsername) => {
				try {
					const message =
						"Timed poll successful! " +
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
			"TimedPollFailed",
			async (targetName, initiatorUsername) => {
				try {
					const message =
						"Timed poll on " +
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

		client.on("NoblePollTimedInitiatorRoleChanged", async (username) => {
			try {
				const message = "The initiator " + username + " is no longer a noble.";
				sendMessage(message);
			} catch (err) {
				throw err;
			}
		});

		client.on("NoblePollTimedTargetRoleChanged", async (username) => {
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
	if (pollActive && pollParticipants.size >= NobleTimedPollWinningRate) {
		// If Timed poll is sucessful
		const member = selectedMembers[pollInitiatorId];
		if (member)
			eventEmitter.emit("changeRole", selectedMembers[pollInitiatorId], "Poop");
		eventEmitter.emit(
			"TimedPollSuccessful",
			pollTargetName,
			pollInitiatorUsername
		);
		await resetPoll(client, messageToEdit);
	} else {
		eventEmitter.emit("TimedPollFailed", pollTargetName, pollInitiatorUsername);
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

async function sendMessage(messsage) {
	interactions.forEach(async (interaction) => {
		if (!interaction) return;
		else {
			if (!interaction.replied && !interaction.deferred) {
				// Send the initial reply if it hasn't been replied to yet
				await interaction.reply({
					content: messsage,
					ephemeral: true,
				});
			} else {
				// Send a follow-up message if the interaction has already been replied to
				await interaction.followUp({
					content: messsage,
					ephemeral: true,
				});
			}
		}
	});
}

function buildHighWritModal(){
	const modal = new ModalBuilder()
		.setCustomId('HighWritModal')
		.setTitle('High Writ of Execution');

	const messageToKnight = new TextInputBuilder()
		.setMaxLength(300)
		.setCustomId('messageToKnight')
		.setLabel("Message for your knight")
		.setStyle(TextInputStyle.Paragraph)
		.setRequired(true);
	const actionRow = new ActionRowBuilder().addComponents(messageToKnight);

	modal.addComponents(actionRow);
	return modal;
}

async function handleShowWrits(interaction) {
	try {

		const writerId = interaction.user.id;
		const writs = await CacheGetWriterWrits(writerId);

		if (writs.length === 0) {
			await sendInteractionReply(interaction, 'You have not issued any writs.');
			return;
		}

		const writDescriptions = await Promise.all(writs.map(async (writ, index) => {
			const knight = await interaction.client.users.fetch(writ.knightId).catch(() => ({ username: 'Unknown Knight' }));
			const target = await interaction.client.users.fetch(writ.targetId).catch(() => ({ username: 'Unknown Target' }));
			return `${index + 1}. Knight: ${knight.username}, Target: ${target.username}, Status: ${getWritStatus(writ.writStatus)}, Message: ${writ.writMessage}`;
		}));

		const response = `Your issued writs:\n\n${writDescriptions.join('\n')}`;

		await sendInteractionReply(interaction, response);
	} catch (error) {
		console.error('Error in handleShowWrits:', error);
		await sendInteractionReply(interaction, 'An error occurred while fetching your writs.');
	}
}

function getWritStatus(status) {
	switch (status) {
		case 0: return 'To be executed';
		case 1: return 'Executed';
		case 2: return 'Failed';
		case 3: return 'Annulled, knight or target have changed roles';
		default: return 'Unknown';
	}
}

async function updateSelectMenu(client, lastMessageId) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDNOBLE);
		const messageToEdit = await channel.messages.fetch(lastMessageId);

		const actionRow_1 = new ActionRowBuilder().addComponents(await buildSelectMenu(client, ["peasant", "scholar", "merchant"], "SelectHuman"));
		const actionRow_2 = new ActionRowBuilder().addComponents(await buildSelectMenu(client, ["knight"], "SelectKnight"));
		const existingComponents = messageToEdit.components.map(component => ActionRowBuilder.from(component.toJSON()));
		existingComponents[1] = actionRow_1;
		existingComponents[2] = actionRow_2;

		await messageToEdit.edit({
			content: messageToEdit.content,
			components: existingComponents
		});
	} catch (err) {
		showErrorMsg(err);
	}
}

async function messageNobleCommands(client) {
	let channel = null;
	try {
		channel = await client.channels.fetch(process.env.CHANNELIDNOBLE);
	} catch (err) {
		showErrorMsg(err);
		return;
	}

	try {
		const selectMenu = await buildSelectMenu(
			client,
			["knight", "noble", "lord"],
			"MembersSelectMenu"
		);
		const row_knight_noble_lord_select = new ActionRowBuilder().addComponents(
			selectMenu
		);
		const humanSelectMenu = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(
				client, ["peasant", "scholar", "merchant"], "SelectHuman"
			));
		const knightSelectMenu = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(
				client, ["knight"], "SelectKnight"
			));

		const buttonRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("TimedPoll")
			.setLabel("Timed Poll")
			.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
			.setCustomId("HighWrit")
			.setLabel("Writ")
			.setStyle(ButtonStyle.Primary)
		);
		const infoBtnRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("ShowWrits")
			.setLabel("Show Writs")
			.setStyle(ButtonStyle.Secondary)
		)
		const message = await channel.send({
			content: initContent,
			components:
			[row_knight_noble_lord_select,humanSelectMenu,knightSelectMenu,
				buttonRow,infoBtnRow],
		});
		return message;
	} catch (err) {
		showErrorMsg(err);
	}
}

async function resetPoll(client, messageToEdit) {
	try {
		pollInLastPhase = false;
		pollActive = false;
		pollInitiatorUsername = null;
		pollTargetName = null;
		pollTargetId = null;
		selectedMembers = {};
		pollInitiatorId = null;
		pollParticipants.clear();
		roleMembersSize = 1;
		roleMembers = [];

		const existingComponents = messageToEdit.components.map(component => ActionRowBuilder.from(component.toJSON()));
		const memberSelectMenu = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(
				client,
				["knight", "noble", "lord"],
				"MembersSelectMenu"
			));
		// Reset poll button
		const buttonRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("TimedPoll")
			.setLabel("Timed Poll")
			.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
			.setCustomId("HighWrit")
			.setLabel("Writ")
			.setStyle(ButtonStyle.Primary)

		);
		existingComponents[0] = memberSelectMenu;
		existingComponents[3] = buttonRow;
		await messageToEdit.edit({
			content: initContent,
			components: existingComponents,
		});
	} catch (err) {
		throw err;
	}
}

module.exports = { setupNobleBotEvents, messageNobleCommands };
