const { eventEmitter } = require("../functions/eventEmitter.js");
const {
	sendInteractionReply,
	buildSelectMenu,
} = require("../functions/botActions");
const {
	CacheGetUserXP,
	CacheGetCooldown,
	CacheSetCooldown,
	CacheGetWriterWrits,
	CacheSetWrit
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
	ImperialWritCost,
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
		// If emperor leaves, need to handle succession/opening emperor role
		if (member.roles.cache.has(process.env.ROLEID_EMPEROR)) {
			selectedKing = null;
			selectedLord = null;
			selectedKnight = null;
			selectedHuman = null;
			await openThreshold(12, client);
			eventEmitter.emit("EmperorVanished", member.username);		}
			await updateSelectMenu(client, lastMessageId);
	});
	client.on("guildMemberUpdate", async (oldMember, newMember) => {
		let hasRoleEmperor = newMember.roles.cache.has(process.env.ROLEID_EMPEROR);
		if( hasRoleEmperor && isThresholdOpen(12) ){
			closeThreshold(12);
			eventEmitter.emit("FirstEnthronement", newMember.username);
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
				selectedHuman = await interaction.guild.members.cache.get(selectedUserId);
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "SelectKnight") {
			let selectedUserId = interaction.values[0];
			try {
				await interaction.deferUpdate();
				selectedKnight = await interaction.guild.members.cache.get(selectedUserId);
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
				const userXP = await CacheGetUserXP(userId);
				if (userXP < ImperialWritCost) {
					await sendInteractionReply(interaction, `Not enough XP (current XP: ${userXP})`)
				} else {
					const cooldown = await CacheGetCooldown("ImperialWrit", userId);
					if (cooldown)
						await sendInteractionReply(interaction, "Imperial Writ is on cooldown and cannot be used.");
					else {
						const modal = buildImperialWritModal();
						await interaction.showModal(modal);
					}
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "ImperialWritModal"){
			try{
				const writMessage = interaction.fields.getTextInputValue('messageToKnight');
				await CacheSetWrit(4, userId, selectedKnight.id, selectedHuman.id, 0, writMessage);
				const userXP = await CacheGetUserXP(userId);
				await DBUpdateXP(userId, ImperialWritCost, client);
				await CacheSetCooldown("ImperialWrit", userId, ImperialWritCooldown);
				await sendInteractionReply(interaction, `Imperial Writ of execution succesfully emitted! (XP left: ${userXP - ImperialWritCost})`);
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
				selectedLord = await interaction.guild.members.cache.get(
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
				selectedKing = await interaction.guild.members.cache.get(
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
						`Not enough XP (current XP: ${userXP})`
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
						const targetUsername = selectedLord.user.username;
						selectedLord = null;
						await DBUpdateXP(userId, -CoronationCost, client);
						await CacheSetCooldown("coronation", null, CoronationCooldown);
						eventEmitter.emit(
							"coronationComplete",
							targetUsername,
							interaction.user.username
						);
						const XPLeft = parseInt(userXP) - parseInt(CoronationCost);
						await sendInteractionReply(
							interaction,
							`(${XPLeft} XP left) \n${targetUsername} was crowned as king`
						);
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
						`Not enough XP (current XP: ${userXP})`
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
						eventEmitter.emit(
							"dethroneComplete",
							targetUsername,
							interaction.user.username
						);
						const XPLeft = parseInt(userXP) - parseInt(DethroneCost);
						await sendInteractionReply(
							interaction,
							`(${XPLeft} XP left) Dethrone committed successfully. \n${targetUsername} has been reduced to lord`
						);
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
						`Not enough XP (current XP: ${userXP})`
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
							`(${XPLeft} XP left) Heir to the Throne chosen, your rule has ended,  enthronement in progress...`
						);
						await changeRole( interaction.member, "King", true);
						await DBUpdateXP(userId, -HeirCost, client);
						await CacheSetCooldown("heirSuccession", null, HeirCooldown);
						const selectedHeir = selectedKing;
						eventEmitter.emit(
							"Enthronement",
							selectedHeir,
							interaction.user.username
						);
					}
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
	});
	eventEmitter.on("Enthronement", async (selectedHeir, initiatorUsername) => {
		try {
			selectedLord = null;
			selectedKing = null;
			selectedHuman = null;
			selectedKnight = null;
			const channel = await client.channels.fetch(process.env.CHANNELIDEMPEROR);
			await changeRole( selectedHeir, "Emperor", true);
			const heirUsername = selectedHeir.user.username;
			const tmpMessage = await channel.send(
				`Hail our new Emperor! ${heirUsername} heir to ${initiatorUsername}, may your rule last 1000 years !`
			);
			eventEmitter.emit(
				"heirSuccessionComplete",
				heirUsername,
				initiatorUsername
			);
			setTimeout(() => {
				tmpMessage.delete().catch(showErrorMsg);
			}, 30000);
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("FirstEnthronement", async (emperorUsername) => {
		try {
			const channel = await client.channels.fetch(process.env.CHANNELIDEMPEROR);

			const tmpMessage = await channel.send(
				`Hail our first Emperor! ${emperorUsername} the Progenitor, may your rule last 1000 years !`
			);
			emperorUsername
			eventEmitter.emit(
				"firstEnthronementComplete",
				emperorUsername
			);
			setTimeout(() => {
				tmpMessage.delete().catch(showErrorMsg);
			}, 30000);
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("ElectionEnthronement", async (emperorUsername) => {
		try {
			selectedLord = null;
			selectedKing = null;
			selectedHuman = null;
			selectedKnight = null;
			const channel = await client.channels.fetch(process.env.CHANNELIDEMPEROR);
			const tmpMessage = await channel.send(
				`Hail our new Emperor! ${heirUsername}, youy have risen to the mountain spring in the spray of revolution, may your rule last 1000 years!`
			);
			setTimeout(() => {
				tmpMessage.delete().catch(showErrorMsg);
			}, 30000);
		} catch (err) {
			showErrorMsg(err);
		}
	});
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
https://drive.google.com/drive/folders/18wx1dylyms37ABAtqNXmhxHh-QCHrfVT?usp=sharing
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
		const channel = await client.channels.fetch(process.env.CHANNELIDEMPEROR);
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
		existingComponents[0] = actionRow_0;
		existingComponents[1] = actionRow_1;
		existingComponents[2] = actionRow_2;
		existingComponents[3] = actionRow_3;

		await messageToEdit.edit({
			content: messageToEdit.content,
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
			.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
			.setCustomId("Dethrone")
			.setLabel(ButtonLabelDethrone)
			.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
			.setCustomId("HeirSuccession")
			.setLabel(ButtonLabelHeir)
			.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
			.setCustomId("ImperialWrit")
			.setLabel(ButtonLabelImperialWrit)
			.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
			.setCustomId("ShowWrits")
			.setLabel(ButtonLabelShowWrits)
			.setStyle(ButtonStyle.Secondary)
		);
		return await channel.send({
			content,
			components: [lordSelectMenu, kingSelectMenu,actionRow_2,actionRow_3, btnRow],
		});
	} catch (err) {
		showErrorMsg(err);
	}
}

module.exports = { setupEmperorBotEvents, messageEmperorCommands };
