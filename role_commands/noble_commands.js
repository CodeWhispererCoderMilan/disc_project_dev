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
    messageChannel,
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
	AssassinationThreshold,
	GlobalCooldown,
	RoleChangeMessageDisplayTime,
	HighWritCooldown,
	TextNobleMessageContent,
	ButtonLabelShowWrits,
	ButtonLabelHighWrit,
	ButtonLabelAssassination,
	ButtonLabelJoinAssassination,
	TextAssassinationSelectMenu,
	TextHighWritKnightSelectMenu,
	TextHighWritTargetSelectMenu,
} = require("../game_config.json");
const { eventEmitter } = require("../functions/eventEmitter.js");
const { DBUpdateXP, changeRole } = require("../apis/firebase/querys");
const gameState = require("../game_state");

let selectedTargets = {};
let assassinationInitiatorId = null;
let assassinationInitiator = null;
let assassinationTarget = null;
let assassinationTargetId = null;
let assassinationActive = false;
let assassinationParticipants = new Set();
let assassinationTimeout;
const selectedHumans = {};
const selectedKnights = {};
const initContent = TextNobleMessageContent;
function showErrorMsg(err) {
	console.error("ERROR: noble_commands.js", err);
}

async function setupNobleBotEvents(client, lastMessageId) {
	client.on("guildMemberRemove", async (member) => {
		try {	
			const hadRoleBeforePeasant = member.roles.cache.has(
				process.env.ROLEID_PEASANT
			);
			const hadRoleBeforeScholar = member.roles.cache.has(
				process.env.ROLEID_SCHOLAR
			);
			const hadRoleBeforeMerchant = member.roles.cache.has(
				process.env.ROLEID_MERCHANT
			);
			const hadRoleBeforeNoble = member.roles.cache.has(
				process.env.ROLEID_NOBLE
			);
			const hadRoleBeforeKnight = member.roles.cache.has(
				process.env.ROLEID_KNIGHT
			);
			const hadRoleBeforeLord = member.roles.cache.has(
				process.env.ROLEID_LORD
			);
			if (hadRoleBeforePeasant || hadRoleBeforeScholar || 
				hadRoleBeforeMerchant || hadRoleBeforeKnight){
				await updateMessage(client, lastMessageId);
				for(let userId in selectedHumans){
					if(selectedHumans[userId] && selectedHumans[userId].id === member.id){
						selectedHumans[userId] = null;
					}
				}
				for(let userId in selectedKnights){
					if(selectedKnights[userId] && selectedKnights[userId].id === member.id){
						selectedKnights[userId] = null;
					}
				}
			}

			if (assassinationActive && hadRoleBeforeNoble) {
				if(assassinationParticipants.has(member.id)){	
					selectedTargets[member.id] = null;
					assassinationParticipants.delete(member.id);
					if (member.id === assassinationInitiatorId && assassinationActive) {
						const msg = `The initiator <@${assassinationInitiatorId}> is no longer a noble.`;
						eventEmitter.emit("NotifyNobleChannel", msg);
						assassinationActive = false;
						await ceaseAssassination(client, lastMessageId);
						return;
					} 
				}
			}

			if (assassinationActive &&(hadRoleBeforeKnight || hadRoleBeforeNoble || hadRoleBeforeLord)){
				if(member.id === assassinationTargetId && assassinationActive){
					const msg = `The role of the target <@${assassinationTargetId}> has been changed.`;
					eventEmitter.emit("NotifyNobleChannel", msg);
					await ceaseAssassination(client, lastMessageId);
					return;
				}
			}

			if (
				hadRoleBeforeLord && !assassinationActive
			) {
				if (lastMessageId) {
					await updateMessage(client, lastMessageId);
				}
			}	


		} catch (err) {
			showErrorMsg(err);
		}
	});
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
			if(assassinationParticipants.has(newMember.id)){	
				try {
					selectedTargets[newMember.id] = null;
					assassinationParticipants.delete(newMember.id);
					if (newMember.id === assassinationInitiatorId && assassinationActive) {
						const msg = `The initiator <@${assassinationInitiatorId}> is no longer a noble.`;
						eventEmitter.emit("NotifyNobleChannel", msg);
						await ceaseAssassination(client, lastMessageId);
						return;
					} 
				} catch (err) {
					showErrorMsg(err);
				}
			}
		}

		if (assassinationActive &&(hadRoleBeforeKnight || hadRoleBeforeNoble || hadRoleBeforeLord)){
			if(newMember.id === assassinationTargetId && assassinationActive){

				try {
					const msg = `The role of the target <@${assassinationTargetId}> has been changed.`;
					eventEmitter.emit("NotifyNobleChannel", msg);
					await ceaseAssassination(client, lastMessageId);
					return;
				} catch (e) {
					showErrorMsg(e);
				}
			}
		}

		if (
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
				selectedHumans[userId] = await interaction.guild.members.fetch(selectedUserId);
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "SelectKnight") {
			let selectedUserId = interaction.values[0];
			try {
				await interaction.deferUpdate();
				selectedKnights[userId] = await interaction.guild.members.fetch(selectedUserId);
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
					const cooldown = await CacheGetCooldown("highWrit", userId);
					if (cooldown)
						await sendInteractionReply(interaction, "High Writ is on cooldown and cannot be used.");
					else {
						const modal = buildHighWritModal();
						await interaction.showModal(modal);
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "HighWritModal"){
			try{
				const writMessage = interaction.fields.getTextInputValue('messageToKnight');
				const writAmount = parseInt(interaction.fields.getTextInputValue('amountInput'));
				if (isNaN(writAmount) || writAmount <= 0) {
					await sendInteractionReply(interaction, "Invalid amount of drops. Please enter a positive number.");
					return;
				}
				const userXP = await CacheGetUserXP(userId);
				if (userXP < writAmount) {
					await sendInteractionReply(interaction, `You don't have enough drops. (drops left: ${userXP})`);
					return;
				}
				await CacheSetWrit(1, userId, selectedKnights[userId].id, selectedHumans[userId].id, 0, writMessage, writAmount);
				await DBUpdateXP(userId,-writAmount, client);
				await CacheSetCooldown("highWrit", userId, HighWritCooldown);
				await sendInteractionReply(interaction, `High Writ of execution succesfully emitted! (XP left: ${userXP - writAmount})`);
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
				selectedTargets[userId] = await interaction.guild.members.fetch(
					targetId
				);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "Assassination") {
			if (!selectedTargets[userId]) {
				sendInteractionReply(interaction, "No member selected");
				return;
			}
			if(selectedTargets[userId].id === userId){
				sendInteractionReply(interaction, "You cannot target yourself.");
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
			if (assassinationTargetId === userId) {
				sendInteractionReply(interaction, "You cannot target yourself.");
				return;	
			}		

			await messageChannel(client, process.env.CHANNELID_GREAT_COUNCIL,
				`Baleful nobles leave their estates like a knife leaves its' scabbard.
				Someone is in grave danger.`);
			assassinationInitiatorId = userId;
			assassinationInitiator = interaction.user.username;
			assassinationParticipants.add(userId);
			assassinationActive = true;
			assassinationTarget = selectedTargets[userId].user.username;
			assassinationTargetId = selectedTargets[userId].user.id;
			
			await messageChannel(client, process.env.CHANNELID_BOGLAND_ESTATES,
				`A plot to kill <@${assassinationTargetId}> is foaming at the surface,
				the bog beckons...`);
			if (lastMessageId) {
				try {
					// Set cooldown
					await updateMessage(client, lastMessageId);
					await startAssassination(client, lastMessageId, AssassinationTime);

					await sendInteractionReply(
						interaction,
						"Assassination initiated, waiting for other nobles to join."
					);
					if (assassinationParticipants.size >= AssassinationThreshold) {
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
						"You cannot join your own plot"
					);
					return;
				}

				if (userId === assassinationTargetId) {
					await sendInteractionReply(
						interaction,
						"You cannot join an assassination targeted you."
					);
					return;
				}

				if (assassinationParticipants.has(userId)) {
					await sendInteractionReply(
						interaction,
						"You've already the plot."
					);
					return;
				}

				assassinationParticipants.add(userId);
				await sendInteractionReply(
					interaction,
					"You've joiend the assassination."
				);
				await messageChannel(client, process.env.CHANNELID_GREAT_COUNCIL,
				`Another noble has joined the conspiracy...`);

				if (
					assassinationActive &&
					assassinationParticipants.size >= AssassinationThreshold
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
	eventEmitter.on("UpdateNobleMessageIfNoAssassinationOngoing", async () => {
		try {
			if (!assassinationActive) await updateMessage(client, lastMessageId);
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on('ServerStatusChange', async () => {
		try{
			await updateMessage(client, lastMessageId);
		} catch (err) {
			showErrorMsg(err);
		}
	});
}

async function startAssassination(client, lastMessageId, timeout) {
	assassinationTimeout = setTimeout(async () => {
		await handleAssassinationEnd(client, lastMessageId);
	}, timeout);
}

async function handleAssassinationEnd(client, lastMessageId) {
	assassinationActive = false;
	if (
		assassinationParticipants.size >= AssassinationThreshold
	) {
		const target = selectedTargets[assassinationInitiatorId];
		if (target) await changeRole(target, "Poop", false);
		eventEmitter.emit("Death", `<@${assassinationTargetId}> has been assassinated.`);
		const msg = `Assasination succesfull. <@${assassinationTargetId}> has been killed, 
			stabbed ${assassinationParticipants.size} times.`;
		await messageChannel(client, process.env.CHANNELID_GREAT_COUNCIL,
			`<@${assassinationTargetId}> has been killed,
			stabbed ${assassinationParticipants.size} times.`);
		await messageChannel(client, process.env.CHANNELID_BOGLAND_ESTATES,
			`Will all of the Two Gods' ocean wash\n
				fallen <@${assassinationTargetId}>'s blood off this land?`);
		eventEmitter.emit("NotifyNobleChannel", msg);
	} else {
		const msg = `Assasination failed. <@${assassinationInitiatorId}>'s plot was foiled.`;
		await messageChannel(client, process.env.CHANNELID_GREAT_COUNCIL,
			`<@${assassinationInitiatorId}>'s plot to kill <@${assassinationTargetId}> has been foiled,
			 murky scum, even for a noble.`);
		await messageChannel(client, process.env.CHANNELID_BOGLAND_ESTATES,
			`<@${assassinationInitiatorId}>'s fumbled their plot to kill <@${assassinationTargetId}>.`);
		eventEmitter.emit("NotifyNobleChannel", msg);
	}
	await CacheSetCooldown("NobleCooldown", assassinationInitiatorId, GlobalCooldown);
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
		.setLabel("Message to your knight")
		.setStyle(TextInputStyle.Paragraph)
		.setRequired(true);
	const amountInput = new TextInputBuilder()
		.setCustomId('amountInput')
		.setLabel("Amount of drops rewarded")
		.setStyle(TextInputStyle.Short)
		.setRequired(true);
		
	const actionRow0 = new ActionRowBuilder().addComponents(messageToKnight);
	const actionRow1 = new ActionRowBuilder().addComponents(amountInput);
	modal.addComponents(actionRow0, actionRow1);
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
			return `${index + 1}. Knight: <@${knight.id}>, Target: <@${target.id}>, Status: ${getWritStatus(writ.writStatus)}, Message: ${writ.writMessage}, Reward: ${writ.writAmount} drops`;
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
		case 2: return 'Failed, your drops will be returned';
		case 3: return 'Annulled, knight or target have changed roles, your drops will be returned';
		default: return 'Unknown';
	}
}
async function updateMessage(client, lastMessageId) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDNOBLE);
		const messageToEdit = await channel.messages.fetch(lastMessageId);
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";

		if (!assassinationActive) {

			const assassinationSelectMenu = await buildSelectMenu(
				client,
				["knight", "noble", "lord"],
				"AssassinationTargetSelectMenu", TextAssassinationSelectMenu
			);
			const actionRow_0 = new ActionRowBuilder().addComponents(
				assassinationSelectMenu
			);
			const actionRow_1 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(
					client, ["peasant", "scholar", "merchant", "knight"], "SelectHuman", TextHighWritTargetSelectMenu
				));
			const actionRow_2 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(
					client, ["knight"], "SelectKnight", TextHighWritKnightSelectMenu
				));

			const buttonRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("Assassination")
				.setLabel(ButtonLabelAssassination)
				.setStyle(ButtonStyle.Danger)
				.setDisabled(gameState.getDisableAssassination() || gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("HighWrit")
				.setLabel(ButtonLabelHighWrit)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown())
			);
			const infoBtnRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("ShowWrits")
				.setLabel(ButtonLabelShowWrits)
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(gameState.isServerDown())
			);


			await messageToEdit.edit({
				content: serverText + '\n' + initContent,
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
					client, ["peasant", "scholar", "merchant", "knight"], "SelectHuman", TextHighWritTargetSelectMenu
				));
			const actionRow_2 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(
					client, ["knight"], "SelectKnight", TextHighWritKnightSelectMenu
				));

			const buttonRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("JoinAssassination")
				.setLabel(ButtonLabelJoinAssassination)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("HighWrit")
				.setLabel(ButtonLabelHighWrit)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown())
			);
			const infoBtnRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("ShowWrits")
				.setLabel(ButtonLabelShowWrits)
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(gameState.isServerDown())
			);
			await messageToEdit.edit({
				content:
				serverText + '\n' +
				initContent +
				`\n <@${assassinationInitiatorId}> initiated assassination. Join assassination to kill <@${assassinationTargetId}>. (Joined: ${assassinationParticipants.size} / ${gameState.getRoleSize("Noble")} nobles)`,
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
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";
		const assassinationSelectMenu = await buildSelectMenu(
			client,
			["knight", "noble", "lord"],
			"AssassinationTargetSelectMenu", TextAssassinationSelectMenu
		);
		const actionRow_0 = new ActionRowBuilder().addComponents(
			assassinationSelectMenu
		);
		const actionRow_1 = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(
				client, ["peasant", "scholar", "merchant", "knight"], "SelectHuman", TextHighWritTargetSelectMenu
			));
		const actionRow_2 = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(
				client, ["knight"], "SelectKnight", TextHighWritKnightSelectMenu
			));

		const buttonRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("Assassination")
			.setLabel(ButtonLabelAssassination)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.getDisableAssassination() || gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("HighWrit")
			.setLabel(ButtonLabelHighWrit)
			.setStyle(ButtonStyle.Primary)
			.setDisabled(gameState.isServerDown())
		);
		const infoBtnRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("ShowWrits")
			.setLabel(ButtonLabelShowWrits)
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(gameState.isServerDown())
		);
		const message = await channel.send({
			content:serverText + '\n' + initContent,
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
		assassinationInitiator = null;
		assassinationInitiatorId = null;
		assassinationTarget = null;
		assassinationTargetId = null;
		assassinationParticipants.clear();
		await updateMessage(client, lastMessageId);
	} catch (err) {
		throw err;
	}
}

module.exports = { setupNobleBotEvents, messageNobleCommands };

