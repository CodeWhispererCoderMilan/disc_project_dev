const { eventEmitter } = require("../functions/eventEmitter.js");
const {
	sendInteractionReply,
	buildSelectMenu,
	messageChannel,
	messageAllHumanChannels
} = require("../functions/botActions");
const {
	CacheGetUserXP,
	CacheGetCooldown,
	CacheSetCooldown,
	CacheGetWriterWrits,
	CacheSetWrit,
	CacheGetUsersByRoles
} = require("../apis/redis/redisCache");

const { 
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle
} = require("discord.js");
const {
	CoronationCost,
	CoronationCooldown,
	DethroneCost,
	DethroneCooldown,
	HeirCost,
	HeirCooldown,
	ImperialWritCooldown,
	TextEmperorMessageContent,
	TextCoronationSelectMenu,
	TextHeirDethroneSelectMenu,
	TextImperialWritTargetSelectMenu,
	TextImperialWritKnightSelectMenu,
	ButtonLabelCoronation,
	ButtonLabelHeir,
	ButtonLabelDethrone,
	ButtonLabelImperialWrit,
	ButtonLabelShowWrits
} = require("../game_config.json");
const { isThresholdOpen,DBUpdateXP, changeRole, openThreshold, closeThreshold } = require("../apis/firebase/querys");
const gameState = require("../game_state.js");

const content = TextEmperorMessageContent;
let selectedKing = null;
let selectedLord = null;
let selectedKnight = null;
let selectedHuman = null;

function showErrorMsg(err) {
	console.error("ERROR: emperor_commands.js", err);
}

async function setupEmperorBotEvents(client, lastMessageId) {
	client.on("guildMemberRemove", async (member) => {
		try{
			// If emperor leaves, need to handle succession/opening emperor role
			if (member.roles.cache.has(process.env.ROLEID_EMPEROR)) {
				await emperorVanished(client, member.id, 'left', lastMessageId);
			}else{
				await updateSelectMenu(client, lastMessageId);
			}
		}catch(err){
			showErrorMsg(err);
		}
	});
	client.on("guildMemberUpdate", async (oldMember, newMember) => {
		let hasRoleEmperor = newMember.roles.cache.has(process.env.ROLEID_EMPEROR);
		if( hasRoleEmperor && isThresholdOpen(12) ){
			closeThreshold(12);
			messageAllHumanChannels(client, `All Hail Emperor <@${newMember.id}> The Progenitor! First of his line, may he serve as a God serves Another.`);
		}
		if (oldMember.roles.cache.has(process.env.ROLEID_KING)) {
			if (selectedKing && selectedKing.id === oldMember.id) {
				selectedKing = null;
			}
		}
		if (oldMember.roles.cache.has(process.env.ROLEID_LORD)) {
			if (selectedLord && selectedLord.id === oldMember.id) {
				selectedLord = null;
				console.log(
					`Removed ${oldMember.user.username} from Coronation selectedTargets`
				);

			}
		}
		if (oldMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
			oldMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
			oldMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
			oldMember.roles.cache.has(process.env.ROLEID_KNIGHT) ||
			oldMember.roles.cache.has(process.env.ROLEID_NOBLE) ||
			oldMember.roles.cache.has(process.env.ROLEID_LORD) ||
			oldMember.roles.cache.has(process.env.ROLEID_KING) ||
			newMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
			newMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
			newMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
			newMember.roles.cache.has(process.env.ROLEID_NOBLE) ||
			newMember.roles.cache.has(process.env.ROLEID_LORD) ||
			newMember.roles.cache.has(process.env.ROLEID_KING) ||
			newMember.roles.cache.has(process.env.ROLEID_KNIGHT)) {
			await updateSelectMenu(client, lastMessageId);
			if(selectedHuman && selectedHuman.id === oldMember.id){
				selectedHuman = null;
			}
			if(selectedKnight && selectedKnight.id === oldMember.id){
				selectedKnight = null;
			}
		}
	});
	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isStringSelectMenu() &&
			!interaction.isButton()&& !interaction.isModalSubmit())
			return;
		const userId = interaction.user.id;
		if (interaction.customId === "SelectHuman") {
			let selectedUserId = interaction.values[0];
			try {
				await interaction.deferUpdate();
				selectedHuman = await interaction.guild.members.fetch(selectedUserId);
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "SelectKnight") {
			let selectedUserId = interaction.values[0];
			try {
				await interaction.deferUpdate();
				selectedKnight = await interaction.guild.members.fetch(selectedUserId);
			}catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "ImperialWrit") {
			try {

				if (!selectedHuman || !selectedKnight){
					await sendInteractionReply(interaction, "No knight or target selected.");
					return;
				}
				const cooldown = await CacheGetCooldown("ImperialWrit", userId);
				if (cooldown){
					await sendInteractionReply(interaction, "Imperial Writ is on cooldown and cannot be used.");
					return;
				}
				if (selectedHuman.id === selectedKnight.id) {
					await sendInteractionReply(interaction, "You cannot target the same person as both knight and target.");
					return;
				}else {
					const modal = await buildImperialWritModal();
					await interaction.showModal(modal);
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "ImperialWritModal"){
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
				await CacheSetWrit(4, userId, selectedKnight.id, selectedHuman.id, 0, writMessage, writAmount);
				await DBUpdateXP(userId, -writAmount, client);
				await CacheSetCooldown("ImperialWrit", userId, ImperialWritCooldown);
				await sendInteractionReply(interaction, `Imperial Writ of execution succesfully emitted! (XP left: ${userXP - writAmount})`);
			}catch(err){
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "ShowWrits") {
			await handleShowWrits(interaction);
		}

		if (interaction.customId === "SelectLord") {
			try {
				let selectedLordId = interaction.values[0];
				selectedLord = await interaction.guild.members.fetch(
					selectedLordId
				);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "SelectKing") {
			try {
				let selectedLordId = interaction.values[0];
				selectedKing = await interaction.guild.members.fetch(
					selectedLordId
				);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "Coronation") {
			try {
				if (!selectedLord) {
					await sendInteractionReply(interaction, `No lord selected`);
					return;
				}
				const userXP = await CacheGetUserXP(userId);
				if (userXP < CoronationCost) {
					await sendInteractionReply(
						interaction,
						`Not enough drops (current drops: ${userXP})`
					);
					return;
				} else {
					const cooldown = await CacheGetCooldown("coronation");
					if (cooldown) {
						await sendInteractionReply(
							interaction,
							"Coronation is on cooldown and cannot be used"
						);
						return;
					} else {
						await changeRole( selectedLord, "King", true);
						const targetId = selectedLord.id;
						selectedLord = null;
						await DBUpdateXP(userId, -CoronationCost, client);
						await CacheSetCooldown("coronation", null, CoronationCooldown);
						const XPLeft = parseInt(userXP) - parseInt(CoronationCost);
						await sendInteractionReply(
							interaction,
							`(${XPLeft} drops left) \n<@${targetId}> was crowned as king`
						);
						await messageChannel(client, process.env.CHANNELID_ROYAL_CASTLE, `Emperor <@${userId}> has crowned <@${targetId}> King.`);
						await messageChannel(client, process.env.CHANNELID_GREAT_COUNCIL, `Emperor <@${userId}> has crowned <@${targetId}> King.`);
					}
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "Dethrone") {
			try {
				if (!selectedKing) {
					await sendInteractionReply(interaction, `No king selected.`);
					return;
				}
				const userXP = await CacheGetUserXP(userId);
				if (userXP < DethroneCost) {
					await sendInteractionReply(
						interaction,
						`Not enough drops (current drops: ${userXP})`
					);
					return;
				} else {
					const cooldown = await CacheGetCooldown("dethrone");
					if (cooldown) {
						await sendInteractionReply(
							interaction,
							"Dethrone is on cooldown and cannot be used"
						);
						return;
					} else {
						await changeRole( selectedKing, "Lord", false);
						const targetUsername = selectedKing.user.username;
						selectedKing = null;
						await DBUpdateXP(userId, -DethroneCost, client);
						await CacheSetCooldown("dethrone", null, DethroneCooldown);
						const XPLeft = parseInt(userXP) - parseInt(DethroneCost);
						await sendInteractionReply(
							interaction,
							`(${XPLeft} drops left) Dethrone committed successfully. \n${targetUsername} has been reduced to lord`
						);
						await messageChannel(client, process.env.CHANNELID_ROYAL_CASTLE, `Emperor <@${userId}> has dethroned the false King <@${targetId}> and in his mercy bestowed upon him lordhood.`);
						await messageChannel(client, process.env.CHANNELID_GREAT_COUNCIL, `Emperor <@${userId}> has dethroned the false King <@${targetId}> and in his mercy bestowed upon him lordhood.`);

					}
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "HeirSuccession") {
			try {
				if (!selectedKing) {
					await sendInteractionReply(interaction, `No heir selected`);
					return;
				}
				const userXP = await CacheGetUserXP(userId);
				if (userXP < HeirCost) {
					await sendInteractionReply(
						interaction,
						`Not enough drops (current drops: ${userXP})`
					);
					return;
				} else {
					const cooldown = await CacheGetCooldown("heirSuccession");
					if (cooldown) {
						await sendInteractionReply(
							interaction,
							"Heir Succession is on cooldown and cannot be used"
						);
						return;
					} else {
						const XPLeft = parseInt(userXP) - parseInt(HeirCost);
						await sendInteractionReply(
							interaction,
							`(${XPLeft} drops left) Heir to the throne chosen, your rule has ended, may you pass softly into the annals. enthronement in progress...`
						);
						await changeRole( interaction.member, "King", true);
						await DBUpdateXP(userId, -HeirCost, client);
						await CacheSetCooldown("heirSuccession", null, HeirCooldown);
						const selectedHeirId = selectedKing.id;
						await enthronement(client, selectedHeirId, userId, false);
					}
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
	});


	eventEmitter.on("ElectionEnthronement", async (emperorId) => {
		try {
			await enthronement(client, emperorId, null, true);		
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("ServerStatusChange", async () => {
		try {
			await updateSelectMenu(client, lastMessageId);
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("EmperorElectionNoCandidates", async (emperorId) => {
		emperorVanished(client, emperorId, 'election', lastMessageId);			
	});

}	
async function emperorVanished(client, emperorId, cause, lastMessageId) {
	try{
		selectedKing = null;
		selectedLord = null;
		selectedKnight = null;
		selectedHuman = null;
		await openThreshold(12, client);
		eventEmitter.emit("EmperorVanished", emperorId, cause);
		await updateSelectMenu(client, lastMessageId);
	}catch(err){
		showErrorMsg(err);
	}
}	
async function enthronement(client, heirId, initiatorId, isElection) {
	try {
		selectedLord = null;
		selectedKing = null;
		selectedHuman = null;
		selectedKnight = null;
		if(!isElection)await changeRole( selectedHeir, "Emperor", true);
		const heirId = selectedHeir.id;
		await messageAllHumanChannels(client, isElection ? 
			`Hail our new Emperor! <@${heirId}>, you have risen to the mountain spring
			in the spray of revolution, may your rule last 1000 years!` :
			`Hail our new Emperor! Child of <@${initiatorId}>, <@${heirId}> spring forth!`);
	} catch (err) {
		showErrorMsg(err);
	}
}
function buildImperialWritModal(){
	const modal = new ModalBuilder()
		.setCustomId('ImperialWritModal')
		.setTitle('Imperial Writ of Execution');

	const messageToKnight = new TextInputBuilder()
		.setMaxLength(300)
		.setCustomId('messageToKnight')
		.setLabel("Message for your knight")
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

async function updateSelectMenu(client, lastMessageId) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDEMPEROR);
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";
		const messageToEdit = await channel.messages.fetch(lastMessageId);
		const actionRow_0 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(client, ["lord"], "SelectLord", TextCoronationSelectMenu)
		);
		const actionRow_1 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(client, ["king"], "SelectKing", TextHeirDethroneSelectMenu)
		);
		const existingComponents = messageToEdit.components.map((component) =>
			ActionRowBuilder.from(component.toJSON())
		);
		const actionRow_2 = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(
				client, ["peasant", "scholar", "merchant","knight","noble","lord","king"],"SelectHuman",TextImperialWritTargetSelectMenu));
		const actionRow_3 = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(
				client, ["knight"], "SelectKnight",TextImperialWritKnightSelectMenu
			));		
		const btnRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("Coronation")
			.setLabel(ButtonLabelCoronation)
			.setStyle(ButtonStyle.Primary)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("Dethrone")
			.setLabel(ButtonLabelDethrone)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("HeirSuccession")
			.setLabel(ButtonLabelHeir)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("ImperialWrit")
			.setLabel(ButtonLabelImperialWrit)
			.setStyle(ButtonStyle.Primary)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("ShowWrits")
			.setLabel(ButtonLabelShowWrits)
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(gameState.isServerDown())
		);

		existingComponents[0] = actionRow_0;
		existingComponents[1] = actionRow_1;
		existingComponents[2] = actionRow_2;
		existingComponents[3] = actionRow_3;
		existingComponents[4] = btnRow;
		await messageToEdit.edit({
			content:serverText +'\n'+ content,
			components: existingComponents,
		});
	} catch (err) {
		showErrorMsg(err);
	}
}


async function messageEmperorCommands(client) {
	let channel = null;
	try {
		channel = await client.channels.fetch(process.env.CHANNELIDEMPEROR);
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";
		const lordSelectMenu = new ActionRowBuilder().addComponents(
			await buildSelectMenu(client, ["lord"], "SelectLord", TextCoronationSelectMenu)
		);
		const kingSelectMenu = new ActionRowBuilder().addComponents(
			await buildSelectMenu(client, ["king"], "SelectKing",TextHeirDethroneSelectMenu)
		);
		const actionRow_2 = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(
				client, ["peasant", "scholar", "merchant","knight","noble","lord","king"], "SelectHuman",TextImperialWritTargetSelectMenu));
		const actionRow_3 = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(
				client, ["knight"], "SelectKnight",TextImperialWritKnightSelectMenu
			));
		const btnRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("Coronation")
			.setLabel(ButtonLabelCoronation)
			.setStyle(ButtonStyle.Primary)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("Dethrone")
			.setLabel(ButtonLabelDethrone)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("HeirSuccession")
			.setLabel(ButtonLabelHeir)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("ImperialWrit")
			.setLabel(ButtonLabelImperialWrit)
			.setStyle(ButtonStyle.Primary)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("ShowWrits")
			.setLabel(ButtonLabelShowWrits)
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(gameState.isServerDown())
		);
		return await channel.send({
			content: serverText + '\n' + content,
			components: [lordSelectMenu, kingSelectMenu,actionRow_2,actionRow_3, btnRow],
		});
	} catch (err) {
		showErrorMsg(err);
	}
}

module.exports = { setupEmperorBotEvents, messageEmperorCommands };
