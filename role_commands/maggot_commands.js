const {ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder} = require('discord.js'); const {
	CacheIsPoopBeingFestered,
	CacheGetFesterCooldown,
	CacheGetFesteringTarget,
	CacheGetUserXP,
    	CacheGetUsersByRoles
} = require('../apis/redis/redisCache');
const {DBSetFestering, DBClearFestering, DBUpdateXP, DBGetUserById} = require('../apis/firebase/querys');
const {
	FesterCost,
	ButtonLabelFester,
	TextMaggotMessageContent,
	TextFesterSelectMenu,
	TextFesterEmptySelectMenu
} = require('../game_config.json');
const { eventEmitter } = require('../functions/eventEmitter');
const {sendInteractionReply} = require("../functions/botActions");
const gameState = require("../game_state");

const selectedPoops = {};
const content = TextMaggotMessageContent;

function showErrorMsg(err) {
	console.error("ERROR: maggot_commands.js", err);
}

async function setupMaggotBotEvents(client, lastMessageId) {
	client.on("guildMemberAdd",async () => {
		await updateFesterSelectMenu(client, lastMessageId);
	});

	client.on("guildMemberRemove", async (member) => {
		const isFesteredByMaggot = await CacheIsPoopBeingFestered(member.id);
		if (isFesteredByMaggot) {
			await DBClearFestering(isFesteredByMaggot.maggotId);
		}
		await updateFesterSelectMenu(client, lastMessageId);
	});
	client.on('guildMemberUpdate', async (oldMember, newMember) => {
		if (oldMember.roles.cache.has(process.env.ROLEID_MAGGOT)) {
			try {
				const festering = await CacheGetFesteringTarget(oldMember.id);
				if (festering) {
					await DBClearFestering(oldMember.id);
				}
				await updateFesterSelectMenu(client, lastMessageId);
			} catch (err) {
				return showErrorMsg(err);
			}
		}
		if (newMember.roles.cache.has(process.env.ROLEID_POOP)) {
			try {
				await updateFesterSelectMenu(client, lastMessageId);
			} catch (err) {
				return showErrorMsg(err);
			}
		}
		if (newMember.roles.cache.has(process.env.ROLEID_MAGGOT)) {
			try {
				await updateFesterSelectMenu(client, lastMessageId);
			} catch (err) {
				return showErrorMsg(err);
			}
		}
		if (oldMember.roles.cache.has(process.env.ROLEID_POOP)) {
			try {
				for (let userId in selectedPoops) {
					if (selectedPoops[userId] && selectedPoops[userId].id === oldMember.id) {
						delete selectedPoops[userId];
						console.log(`Removed ${oldMember.user.username} from selectedSubHumans`);
					}
				}

				const festeringMaggotId = await CacheIsPoopBeingFestered(oldMember.id);
				if (festeringMaggotId) {
					await DBClearFestering(festeringMaggotId);
				}
				await updateFesterSelectMenu(client, lastMessageId);
			} catch (err) {
				showErrorMsg(err);
			}
		}
	});


	client.on('interactionCreate', async interaction => {
		if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
		if (interaction.customId === 'selectPoop') {
			const userId = interaction.user.id;
			let selectedPoopId = interaction.values[0];
			try {
				selectedPoops[userId] = await interaction.guild.members.fetch(selectedPoopId);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === 'fester') {
			const userId = interaction.user.id;
			if (!selectedPoops[userId]) {
				await sendInteractionReply(interaction, "You must select a poop.");
				return;
			}
			const userXP = await CacheGetUserXP(userId);
			if (userXP < FesterCost) {
				try {
					await sendInteractionReply(interaction, `Not enough XP (current XP: ${userXP})`)
					return;
				} catch (err) {
					return showErrorMsg(err);
					// throw err;
				}
			} else {
				try {
					console.log(`checking if ${selectedPoops[userId].id} is being festered`);
					const festerCooldown = await CacheGetFesterCooldown(userId);
					if (festerCooldown) {
						await sendInteractionReply(interaction, "Fester is on cooldown and cannot be used.");
						return;
					}
					const alreadyFestered = await CacheIsPoopBeingFestered(selectedPoops[userId].id);
					if (alreadyFestered) {
						await sendInteractionReply(interaction, "Poop already festered.");
						return;
					}
					await fester(client, userId, selectedPoops[userId].id);
					const targetUsername = selectedPoops[userId].user.username;
					selectedPoops[userId] = null;
					const maggotUsername = interaction.user.username;
					await sendInteractionReply(interaction, `Successfully latched on to poop ${targetUsername}, half their xp being funneled to you.`);
					await updateFesterSelectMenu(client, lastMessageId);
					eventEmitter.emit('notifyFesterTarget', maggotUsername, targetUsername);
					await festerNotification(client, maggotUsername, targetUsername);
				} catch (err) {
					return showErrorMsg(err);
				}
			}
		}
	});

	eventEmitter.on('ServerStatusChange', async () => {
		try{
			await updateFesterSelectMenu(client, lastMessageId);
		} catch (err) {
			showErrorMsg(err);
		}
	});
	
}
async function festerNotification (client, maggotUsername, poopUsername){
	try {
		const cesspitChannel = await client.channels.fetch(process.env.CHANNELID_CESSPIT);
		const putridWasteChannel = await client.channels.fetch(process.env.CHANNELID_PUTRID_WASTE);
		await cesspitChannel.send(`@**${maggotUsername}** is festering @**${poopUsername}**, drainage of its drops....`);
		await putridWasteChannel.send(`@**${maggotUsername}** festering....`);
	} catch (err) {
		showErrorMsg(err);
	}
}
async function messageMaggotCommands(client) {
	let channel = null;
	try {
		channel = await client.channels.fetch(process.env.CHANNELIDMAGGOT);
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";
		const selectMenu = await buildUnfesteredPoopSelectMenu(client);
		const row = new ActionRowBuilder()
			.addComponents(selectMenu); 	
		const buttonRow = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
				.setCustomId('fester')
				.setLabel(ButtonLabelFester)
				.setStyle(ButtonStyle.Danger)
				.setDisabled(gameState.isServerDown())
			);
		return await channel.send({ // this is a message.
			content: serverText + '\n' + content,
			components: [row, buttonRow],
		});
	} catch (err) {
		showErrorMsg(err);
	}
}

async function getUnfesteredPoops(client) {
	let availablePoops = [];

	const allPoopUsers = await CacheGetUsersByRoles(["poop"]);
	try {
		for (let poop of allPoopUsers) {
			console.log(`checking if ${poop.username} is being festered...`);
			const beingFestered = await CacheIsPoopBeingFestered(poop.id);
			console.log(`${poop.username} is being festered: ${beingFestered}`);
			if (!beingFestered) {
				availablePoops.push({
					id: poop.id,
					username: poop.username
				});
			}
		}
	} catch (err) {
		showErrorMsg(err);
	}
	return availablePoops;
}


async function fester(client, maggotId, poopId) {
	try {
		await DBUpdateXP(maggotId, -FesterCost, client);
		let poopUser = await DBGetUserById(poopId);
		if (poopUser) {
			await DBUpdateXP(maggotId, poopUser.XP / 2, client);
			await DBUpdateXP(poopId, -(poopUser.XP / 2), client);
		}
		await DBSetFestering(maggotId, poopId);
	} catch (err) {
		showErrorMsg(err);
	}
}

async function updateFesterSelectMenu(client, lastMessageId) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDMAGGOT);
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";
		const messageToEdit = await channel.messages.fetch(lastMessageId);
		const selectMenu = await buildUnfesteredPoopSelectMenu(client);
		const actionRow_0 = new ActionRowBuilder().addComponents(selectMenu);
		const existingComponents = messageToEdit.components.map(component => ActionRowBuilder.from(component.toJSON()));
		const buttonRow = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
				.setCustomId('fester')
				.setLabel(ButtonLabelFester)
				.setStyle(ButtonStyle.Danger)
				.setDisabled(gameState.isServerDown())
			);
		existingComponents[0] = actionRow_0;
		existingComponents[1] = buttonRow;

		await messageToEdit.edit({
			content:serverText + '\n' + content,
			components: existingComponents
		});
	} catch (err) {
		showErrorMsg(err);
	}
}

async function buildUnfesteredPoopSelectMenu(client) {
	let availablePoops;
	try {
		availablePoops = await getUnfesteredPoops(client);
	} catch (err) {
		showErrorMsg(err);
		return;
	}

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId('selectPoop')
		.setDisabled(availablePoops.length === 0);

	if (availablePoops.length > 0) {
		selectMenu.setPlaceholder(TextFesterSelectMenu)
			.addOptions(availablePoops.map(poop => ({
				label: poop.username,
				value: poop.id,
			})));
	} else {
		selectMenu.setPlaceholder(TextFesterEmptySelectMenu)
			.addOptions([{
				label: 'No poops available',
				value: 'no_poops',
				// This option is disabled and is just for informational purposes
				disabled: true
			}]);
	}
	return selectMenu;
}

module.exports = {setupMaggotBotEvents, messageMaggotCommands};
