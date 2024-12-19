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
	AssassinationTime,
	AssassinationThreadshold,
	GlobalCoolDown,
	RoleChangeMessageDisplayTime,
	HighWritCost,
	HighWritCooldown
} = require("../game_config.json");
const { eventEmitter } = require("../functions/eventEmitter.js");
const { DBUpdateXP } = require("../apis/firebase/querys");

let selectedTargets = {};
let nobles = [];
let noblesSize = 1;
let assassinationInitiatorId = null;
let assassinationInitiator = null;
let assassinationTarget = null;
let assassinationTargetId = null;
let assassinationActive = false;
let assassinationParticipants = new Set();
let assassinationTimeout;
const selectedHumans = {};
const selectedKnights = {};

const initContent =
	"Nobles can assassin a target of their role by selecting Knight, Noble or Lord in a menu and clicking a button. If over 3 of participants join before the timer ends, the target's role is changed to POOP; otherwise, the attempt fails. A global cooldown is activated after each use.\n\n" +
	"**Abilities:**\n" +
	"- **Assassination**: With more than 3 of Nobles, you can make one knight, noble or lord to poop.";

function showErrorMsg(err) {
	console.error("ERROR: noble_commands.js", err);
}

async function setupNobleBotEvents(client, lastMessageId) {
	client.on("guildMemberUpdate", async (oldMember, newMember) => {
		const hadRoleBeforeNoble = oldMember.roles.cache.has(
			process.env.ROLEID_NOBLE
		);
		const hasRoleNowNoble = newMember.roles.cache.has(process.env.ROLEID_NOBLE);
		const hadRoleBeforeKnight = oldMember.roles.cache.has(
			process.env.ROLEID_KNIGHT
		);
		const hadRoleBeforeLord = oldMember.roles.cache.has(
			process.env.ROLEID_LORD
		);
		const hasRoleNowLord = newMember.roles.cache.has(process.env.ROLEID_LORD);
		if (oldMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
			oldMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
			oldMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
			oldMember.roles.cache.has(process.env.ROLEID_KNIGHT) ||
			newMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
			newMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
			newMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
			newMember.roles.cache.has(process.env.ROLEID_KNIGHT)) {
			await updateMessage(client, lastMessageId);
			for(let userId in selectedHumans){
				if(selectedHumans[userId] && selectedHumans[userId].id === oldMember.id){
					selectedHumans[userId] = null;
				}
			}
			for(let userId in selectedKnights){
				if(selectedKnights[userId] && selectedKnights[userId].id === oldMember.id){
					selectedKnights[userId] = null;
				}
			}
		}
		if (assassinationActive && hadRoleBeforeNoble) {
			if (assassinationParticipants.has(newMember.id)) {
				try {
					selectedTargets[newMember.id] = null;
					assassinationParticipants.delete(newMember.id);
					const guild = await client.guilds.fetch(process.env.GUILDID);
					// await guild.members.fetch();
					nobles = guild.members.cache.filter((member) =>
						member.roles.cache.has(process.env.ROLEID_NOBLE)
					);
					noblesSize = nobles.size;

					if (newMember.id === assassinationInitiatorId) {
						const msg = `The initiator @${assassinationInitiator} is no longer a noble.`;
						eventEmitter.emit("NotifyNobleChannel", msg);
						assassinationActive = false;
						await ceaseAssassination(client, lastMessageId);
						return;
					} else updateMessage(client, lastMessageId);
				} catch (err) {
					showErrorMsg(err);
				}
			}
		}
		if (
			assassinationActive &&
			(hadRoleBeforeKnight || hadRoleBeforeNoble || hadRoleBeforeLord)
		) {
			if (newMember.id === assassinationTargetId) {
				try {
					const msg = `The role of the target @${assassinationTarget} has been changed.`;
					eventEmitter.emit("NotifyNobleChannel", msg);
					assassinationActive = false;
					await ceaseAssassination(client, lastMessageId);
					return;
				} catch (e) {
					showErrorMsg(e);
				}
			}
		}
		if(assassinationActive && hasRoleNowNoble){
					const guild = await client.guilds.fetch(process.env.GUILDID);
					nobles = guild.members.cache.filter((member) =>
						member.roles.cache.has(process.env.ROLEID_NOBLE)
					);
					noblesSize = nobles.size;
					await updateMessage(client, lastMessageId);
		}
		if (
			hadRoleBeforeNoble ||
			hasRoleNowNoble ||
			hadRoleBeforeLord ||
			hasRoleNowLord && !assassinationActive
		) {
			if (lastMessageId) {
				try {
					await updateMessage(client, lastMessageId);
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
			await handleShowWrits(interaction);
		}

		if (interaction.customId === "AssassinationTargetSelectMenu") {
			let targetId = interaction.values[0];
			try {
				selectedTargets[userId] = await interaction.guild.members.cache.get(
					targetId
				);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "Assassination") {
			nobles = interaction.guild.members.cache.filter((member) =>
				member.roles.cache.has(process.env.ROLEID_NOBLE)
			);
			noblesSize = nobles.size;

			if (!selectedTargets[userId]) {
				sendInteractionReply(interaction, "No member selected");
				return;
			}

			let cooldown;
			try {
				cooldown = await CacheGetCooldown("NobleCooldown", userId);
			} catch (err) {
				showErrorMsg(err);
			}
			if (cooldown) {
				sendInteractionReply(interaction, "Assassination is on cooldown");
				return;
			}

			assassinationInitiatorId = userId;
			assassinationInitiator = interaction.user.username;
			assassinationParticipants.add(userId);
			assassinationActive = true;
			assassinationTarget = selectedTargets[userId].user.username;
			assassinationTargetId = selectedTargets[userId].user.id;

			if (assassinationTargetId === userId) {
				sendInteractionReply(interaction, "You cannot target yourself.");
				return;
			}

			if (lastMessageId) {
				try {
					// Set cooldown
					await CacheSetCooldown("NobleCooldown", userId, GlobalCoolDown);
					await updateMessage(client, lastMessageId);
					await startAssassination(client, lastMessageId, AssassinationTime);

					await sendInteractionReply(
						interaction,
						"Assassination initiated, waiting for other nobles to join."
					);
					if (assassinationParticipants.size >= AssassinationThreadshold) {
						ceaseAssassination(client, lastMessageId);
						return;
					}
				} catch (err) {
					showErrorMsg(err);
				}
			}
		}
		if (interaction.customId === "JoinAssassination") {
			try {
				if (!assassinationActive) {
					await sendInteractionReply(
						interaction,
						"There is no active assassination to join."
					);
					return;
				}

				if (userId === assassinationInitiatorId) {
					await sendInteractionReply(
						interaction,
						"Once you created an assassination, you don't need to join your assassination since you are alreday a participant."
					);
					return;
				}

				if (userId === assassinationTargetId) {
					await sendInteractionReply(
						interaction,
						"You cannot join assassination targeted yourself."
					);
					return;
				}

				if (assassinationParticipants.has(userId)) {
					await sendInteractionReply(
						interaction,
						"You've already joined this assassination."
					);
					return;
				}

				assassinationParticipants.add(userId);
				await sendInteractionReply(
					interaction,
					"You have joind the assassination."
				);

				if (
					assassinationActive &&
					assassinationParticipants.size >= AssassinationThreadshold
				) {
					//If assassination succeeded within voting ending time.
						ceaseAssassination(client, lastMessageId);
					return;
				} else {
					updateMessage(client, lastMessageId);
				}
			} catch (err) {
				throw err;
			}
		}
	});
	eventEmitter.on("NotifyNobleChannel", async (msg) => {
		try {
			let channel = await client.channels.fetch(process.env.CHANNELIDNOBLE);
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
}

async function startAssassination(client, lastMessageId, timeout) {
	assassinationTimeout = setTimeout(async () => {
		await handleAssassinationEnd(client, lastMessageId);
	}, timeout);
}

async function handleAssassinationEnd(client, lastMessageId) {
	if (
		assassinationActive &&
		assassinationParticipants.size >= AssassinationThreadshold
	) {
		const target = selectedTargets[assassinationInitiatorId];
		if (target) eventEmitter.emit("changeRole", target, "Poop", false);
		const msg = `Assassination successful! @${assassinationTarget} has become a poop by @${assassinationInitiator}.`;
		eventEmitter.emit("NotifyNobleChannel", msg);
	} else {
		const msg = `Assassination on @${assassinationTarget} initiated by @${assassinationInitiator} has been failed.`;
		eventEmitter.emit("NotifyNobleChannel", msg);
	}
	await resetComponents(client, lastMessageId);
}

async function ceaseAssassination(client, lastMessageId) {
	if (assassinationTimeout) {
		clearTimeout(assassinationTimeout);
		await handleAssassinationEnd(client, lastMessageId);
	}
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
async function updateMessage(client, lastMessageId) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDNOBLE);
		const messageToEdit = await channel.messages.fetch(lastMessageId);

		if (!assassinationActive) {

			const assassinationSelectMenu = await buildSelectMenu(
				client,
				["knight", "noble", "lord"],
				"AssassinationTargetSelectMenu"
			);
			const actionRow_0 = new ActionRowBuilder().addComponents(
				assassinationSelectMenu
			);
			const actionRow_1 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(
					client, ["peasant", "scholar", "merchant"], "SelectHuman"
				));
			const actionRow_2 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(
					client, ["knight"], "SelectKnight"
				));

			const buttonRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("Assassination")
				.setLabel("Assassination")
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
			);


			await messageToEdit.edit({
				content: initContent,
				components: [actionRow_0, actionRow_1, actionRow_2, buttonRow, infoBtnRow],
			});
		} else {
			const actionRow_0 = ActionRowBuilder.from(
				messageToEdit.components[0].toJSON()
			);
			const assassinationSelectMenu = StringSelectMenuBuilder.from(
				actionRow_0.components[0].toJSON()
			)
				.setDisabled(true)
				.setPlaceholder(assassinationTarget);
			actionRow_0.components[0] = assassinationSelectMenu;
			const actionRow_1 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(
					client, ["peasant", "scholar", "merchant"], "SelectHuman"
				));
			const actionRow_2 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(
					client, ["knight"], "SelectKnight"
				));

			const buttonRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("JoinAssassination")
				.setLabel("Join Assassination")
				.setStyle(ButtonStyle.Primary),
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
			);
			await messageToEdit.edit({
				content:
				initContent +
				`\n@${assassinationInitiator} initiated assassination. Join assassination to kill @${assassinationTarget}. (Joined ${assassinationParticipants.size} / ${noblesSize} nobles.)`,
				components: [actionRow_0, actionRow_1, actionRow_2, buttonRow, infoBtnRow],
			});
		}
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
		const assassinationSelectMenu = await buildSelectMenu(
			client,
			["knight", "noble", "lord"],
			"AssassinationTargetSelectMenu"
		);
		const actionRow_0 = new ActionRowBuilder().addComponents(
			assassinationSelectMenu
		);
		const actionRow_1 = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(
				client, ["peasant", "scholar", "merchant"], "SelectHuman"
			));
		const actionRow_2 = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(
				client, ["knight"], "SelectKnight"
			));

		const buttonRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("Assassination")
			.setLabel("Assassination")
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
		);
		const message = await channel.send({
			content: initContent,
			components: [actionRow_0, actionRow_1, actionRow_2, buttonRow, infoBtnRow],
		});
		return message;
	} catch (err) {
		showErrorMsg(err);
	}
}

async function resetComponents(client, lastMessageId) {
	try {
		selectedTargets = {};
		assassinationActive = false;
		assassinationInitiator = null;
		assassinationInitiatorId = null;
		assassinationTarget = null;
		assassinationTargetId = null;
		assassinationParticipants.clear();
		noblesSize = 1;
		nobles = [];
		await updateMessage(client, lastMessageId);
	} catch (err) {
		throw err;
	}
}

module.exports = { setupNobleBotEvents, messageNobleCommands };

