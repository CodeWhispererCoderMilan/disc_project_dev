const {eventEmitter} = require('../functions/eventEmitter.js');
const gameState = require("../game_state.js");
const {sendInteractionReply, buildSelectMenu} = require("../functions/botActions");
const { CacheGetUsersByRoles,CacheGetUserXP, CacheGetCooldown, CacheSetCooldown} = require("../apis/redis/redisCache");
const {ActionRowBuilder, ButtonBuilder, ButtonStyle} = require("discord.js");
const {DBUpdateXP, changeRole} = require("../apis/firebase/querys");
const {
	DepravityCost,
	DepravityCooldown, 
	ManhuntCost, 
	ManhuntCooldown, 
	PickingCost, 
	PickingCooldown,
	TextSubhumanMessageContent,
	ButtonLabelManhunt,
	ButtonLabelDepravity,
	ButtonLabelPickings,
	TextPickingsSelectMenu,
	TextDepravitySelectMenu,
	TextManhuntSelectMenu
} = require("../game_config.json");

const content = TextSubhumanMessageContent;

let selectedSubHumans = {};
let selectedPeasants = {};
let selectedPickings = {};

function showErrorMsg(err) {
	console.error("ERROR: subhuman_commands.js", err);
}
async function setupSubhumanBotEvents(client, lastMessageId) {
	client.on("guildMemberRemove", async (member) => {
    try {
        const hadRoleBeforeSubhuman = member.roles.cache.has(
            process.env.ROLEID_SUBHUMAN
        );
        const hadRoleBeforePeasant = member.roles.cache.has(
            process.env.ROLEID_PEASANT
        );
        const hadRoleBeforeMaggot = member.roles.cache.has(
            process.env.ROLEID_MAGGOT
        );
        const hadRoleBeforeRat = member.roles.cache.has(
            process.env.ROLEID_RAT
        );

        // Clean up subhuman targets if leaving member was subhuman
        if (hadRoleBeforeSubhuman) {
            for (let userId in selectedSubHumans) {
                if (selectedSubHumans[userId] && selectedSubHumans[userId].id === member.id) {
                    delete selectedSubHumans[userId];
                }
            }
            await updateSelectMenu(client, lastMessageId);
        }

        // Clean up peasant targets
        if (hadRoleBeforePeasant) {
            for (let userId in selectedPeasants) {
                if (selectedPeasants[userId] && selectedPeasants[userId].id === member.id) {
                    delete selectedPeasants[userId];
                }
            }
            await updateSelectMenu(client, lastMessageId);
        }

        // Clean up picking targets
        if (hadRoleBeforeMaggot || hadRoleBeforeRat) {
            for (let userId in selectedPickings) {
                if (selectedPickings[userId] && selectedPickings[userId].id === member.id) {
                    delete selectedPickings[userId];
                }
            }
            await updateSelectMenu(client, lastMessageId);
        }
    } catch (err) {
        showErrorMsg(err);
    }
});
	client.on("guildMemberUpdate", async (oldMember, newMember) => {
		if (oldMember.roles.cache.has(process.env.ROLEID_SUBHUMAN)) {
			for (let userId in selectedSubHumans) {
				if (selectedSubHumans[userId] && selectedSubHumans[userId].id === oldMember.id) {
					delete selectedSubHumans[userId];
					console.log(`Removed ${oldMember.user.username} from selectedSubHumans`);
				}
			}
		}
		if (oldMember.roles.cache.has(process.env.ROLEID_PEASANT)) {
			for (let userId in selectedPeasants) {
				if (selectedPeasants[userId] && selectedPeasants[userId].id === oldMember.id) {
					delete selectedPeasants[userId];
					console.log(`Removed ${oldMember.user.username} from selectedPeasants`);
				}
			}
		}
		if (oldMember.roles.cache.has(process.env.ROLEID_MAGGOT)||oldMember.roles.cache.has(process.env.ROLEID_RAT)) {
			for (let userId in selectedPickings) {
				if (selectedPickings[userId] && selectedPickings[userId].id === oldMember.id) {
					delete selectedPickings[userId];
					console.log(`Removed ${oldMember.user.username} from selectedPickings`);
				}
			}
		}
		if (oldMember.roles.cache.has(process.env.ROLEID_SUBHUMAN)||
			newMember.roles.cache.has(process.env.ROLEID_SUBHUMAN)||
			oldMember.roles.cache.has(process.env.ROLEID_PEASANT)||
			newMember.roles.cache.has(process.env.ROLEID_PEASANT)||
			oldMember.roles.cache.has(process.env.ROLEID_MAGGOT)||
			oldMember.roles.cache.has(process.env.ROLEID_RAT)||
			newMember.roles.cache.has(process.env.ROLEID_MAGGOT)||
			newMember.roles.cache.has(process.env.ROLEID_RAT)){

			await updateSelectMenu(client, lastMessageId);
		}
	});

	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
		const userId = interaction.user.id;
		if (interaction.customId === "SelectSubHuman") {
			let selectedTargetId = interaction.values[0];
			try {
				selectedSubHumans[userId] = await interaction.guild.members.fetch(selectedTargetId);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if(interaction.customId === "SelectPeasant") {
			let selectedTargetId = interaction.values[0];
			try {
				selectedPeasants[userId] = await interaction.guild.members.fetch(selectedTargetId);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "SelectPicking") {
			let selectedTargetId = interaction.values[0];
			try {
				selectedPickings[userId] = await interaction.guild.members.fetch(selectedTargetId);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "Depravity") {
			try {
				if (!selectedSubHumans[userId]){
					await sendInteractionReply(interaction,`No sub-human selected`)
					return;
				}
				if(selectedSubHumans[userId].id == interaction.user.id){
					await sendInteractionReply(interaction,`Unfortunately, you cannot eat yourself...`)
					return;

				}
				const userXP = await CacheGetUserXP(userId);
				if (userXP < DepravityCost) {
					await sendInteractionReply(interaction,`Not enough XP (current XP: ${userXP})`)
				} else {
					const cooldown = await CacheGetCooldown("depravity", userId);
					if (cooldown){
						await sendInteractionReply(interaction,"Depravity is on cooldown and cannot be used");
						return;
					}else {

						const targetUsername = selectedSubHumans[userId].user.username;
						await changeRole(selectedSubHumans[userId],'Poop',false);
						selectedSubHumans[userId] = null;
						await DBUpdateXP(userId, -DepravityCost, client);
						await CacheSetCooldown("depravity", userId, DepravityCooldown);
						eventEmitter.emit("DepravityComplete", targetUsername, interaction.user.username);
						const XPLeft = parseInt(userXP) - parseInt(DepravityCost);
						await sendInteractionReply(interaction,`(${XPLeft} XP left) Depravity committed successfully. \n${targetUsername} has been reduced to poop`);
					}
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "Manhunt") {
			try {
				if (!selectedPeasants[userId]){
					await sendInteractionReply(interaction, `No peasant selected`);
					return;
				}
				const userXP = await CacheGetUserXP(userId);
				if (userXP < ManhuntCost) {
					await sendInteractionReply(interaction, `Not enough XP (current XP: ${userXP})`)
					return;
				} else {
					const cooldown = await CacheGetCooldown("manhunt", userId);
					if (cooldown){
						await sendInteractionReply(interaction,"Depravity is on cooldown and cannot be used");
						return;	
					}
					else {
						targetUsername = selectedPeasants[userId].user.username;
						await changeRole(selectedPeasants[userId], 'Poop',false);
						selectedSubHumans[userId] = null;
						await DBUpdateXP(userId, -ManhuntCost, client);
						await CacheSetCooldown("manhunt", userId, ManhuntCooldown);
						eventEmitter.emit("ManhuntComplete",targetUsername , interaction.user.username);
						const XPLeft = parseInt(userXP) - parseInt(ManhuntCost);
						await sendInteractionReply(interaction, `(${XPLeft} XP left) Manhunt committed successfully. \n${targetUsername} has been reduced to poop`);
					}
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "Picking") {
			try {
				if (!selectedPickings[userId]){
					await sendInteractionReply(interaction, `No rat or maggot selected`);
					return;
				}
				const userXP = await CacheGetUserXP(userId);
				if (userXP < PickingCost) {
					await sendInteractionReply(interaction, `Not enough XP (current XP: ${userXP})`)
					return;
				}else {
					const cooldown = await CacheGetCooldown("picking", userId);
					if (cooldown){
						await sendInteractionReply(interaction, "Picking is on cooldown and cannot be used");
						return;
					}else {
						const targetUsername = selectedPickings[userId].user.username
						await changeRole (selectedPickings[userId],'Poop',false);
						selectedPickings[userId] = null;
						await DBUpdateXP(userId, -PickingCost, client);
						await CacheSetCooldown("picking", userId, PickingCooldown);
						eventEmitter.emit("PickingComplete", targetUsername, interaction.user.username);
						const XPLeft = parseInt(userXP) - parseInt(PickingCost);
						await sendInteractionReply(interaction, `(${XPLeft} XP left) Picking committed successfully. \n${targetUsername} has been reduced to poop`);
					}
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
	});

	client.on("ExileComplete", async (subHumanUsername, initiatorUsername) => {
		try {
			const channel = await client.channels.fetch(process.env.CHANNELIDLORD);
			const tmpMessage = await channel.send(`${subHumanUsername} has become a sub-human by ${initiatorUsername}.`);
			setTimeout(() => {
				tmpMessage.delete.catch(showErrorMsg);
			}, 30000);
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("ServerStatusChange", async () => {
		try{
			await updateSelectMenu(client, lastMessageId);
		} catch (err) {
			showErrorMsg(err);
		}
	});
}

async function updateSelectMenu(client, lastMessageId) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDSUBHUMAN);
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";
		const messageToEdit = await channel.messages.fetch(lastMessageId);
		const actionRow_0 = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(client, ["sub-human"], "SelectSubHuman", TextDepravitySelectMenu)); 
		const actionRow_1 = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(client, ["peasant"], "SelectPeasant",TextManhuntSelectMenu));
		const actionRow_2 = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(client, ["maggot", "rat"], "SelectPicking", TextPickingsSelectMenu));
		const btnRows = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
				.setCustomId("Depravity")
				.setLabel(ButtonLabelDepravity)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("Manhunt")
				.setLabel(ButtonLabelManhunt)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("Picking")
				.setLabel(ButtonLabelPickings)
				.setStyle(ButtonStyle.Danger)
				.setDisabled(gameState.isServerDown()),
			);

		const existingComponents = messageToEdit.components.map(component => ActionRowBuilder.from(component.toJSON()));
		existingComponents[0] = actionRow_0;
		existingComponents[1] = actionRow_1;
		existingComponents[2] = actionRow_2;
		existingComponents[3] = btnRows;
		await messageToEdit.edit({
			content: serverText + '\n' + content,
			components: existingComponents
		});



	} catch (err) {
		showErrorMsg(err);
	}
}

async function messageSubhumanCommands(client) {
	let channel = null;
	try {
		channel = await client.channels.fetch(process.env.CHANNELIDSUBHUMAN);
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";
		const subHumanSelectMenu = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(client, ["sub-human"], "SelectSubHuman", TextDepravitySelectMenu));
		const peasantSelectMenu = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(client, ["peasant"], "SelectPeasant",TextManhuntSelectMenu));
		const pickingSelectMenu = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(client, ["maggot", "rat"], "SelectPicking", TextPickingsSelectMenu));

		const btnRows = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
				.setCustomId("Depravity")
				.setLabel(ButtonLabelDepravity)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("Manhunt")
				.setLabel(ButtonLabelManhunt)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("Picking")
				.setLabel(ButtonLabelPickings)
				.setStyle(ButtonStyle.Danger)
				.setDisabled(gameState.isServerDown()),
			);

		return await channel.send({
			content: serverText + '\n' + content,
			components: [subHumanSelectMenu, peasantSelectMenu, pickingSelectMenu, btnRows]
		});
	} catch (err) {
		return console.error(err);
	}
}

module.exports = {setupSubhumanBotEvents, messageSubhumanCommands};

