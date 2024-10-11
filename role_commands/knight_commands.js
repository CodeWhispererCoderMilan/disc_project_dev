const { eventEmitter } = require("../functions/eventEmitter.js");
const { buildSelectMenu, sendInteractionReply } = require("../functions/botActions");
const {CacheGetUserXP, CacheSetCooldown, CacheGetCooldown, CacheGetKnightWrits, CacheCheckActiveWrit, CacheUpdateWritStatus, CacheCheckAndUpdateUserWrits} = require("../apis/redis/redisCache");
const { DBUpdateXP } = require("../apis/firebase/querys.js");
const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require("discord.js");
const { CutDownCost, CutDownCooldown, HighWritReward, EminentWritReward, RoyalWritReward, ImperialWritReward, SiegePollDuration } = require("../game_config.json");

let knights = [];
let knightsSize = 0;
let kingsSize = 1;
let pollInitiatorUsername = null;
let pollTargetName = null;
let pollActive = false;
let pollParticipants = new Set();
let pollTimeout;
let interactions = [];
let selectedTargets = {};

const initContent =
	"Test message to Knight.\n" +
	"**Abilities:**\n" +
	"- **Cut down**: Description goes here.\n";

function showErrorMsg(err) {
	console.error("ERROR: knight_commands.js", err);
}

async function setupKnightBotEvents(client, lastMessageId) {
	client.on("guildMemberUpdate", async (oldMember, newMember) => {

		if (oldMember.roles.cache.has(process.env.ROLEID_PEASANT) || 
			oldMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
			oldMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
			oldMember.roles.cache.has(process.env.ROLEID_NOBLE) || 
			oldMember.roles.cache.has(process.env.ROLEID_LORD) ||
			oldMember.roles.cache.has(process.env.ROLEID_KING)
		){
			await CacheCheckAndUpdateUserWrits(oldMember.id);
			for (let userId in selectedTargets) {
				if (selectedTargets[userId] && selectedTargets[userId].id === oldMember.id) {
					delete selectedTargets[userId];
					console.log(`Removed ${oldMember.user.username} from Cut Dowm targets`);
				}
			}
		}
		if (oldMember.roles.cache.has(process.env.ROLEID_PEASANT) || 
			oldMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
			oldMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
			oldMember.roles.cache.has(process.env.ROLEID_NOBLE) || 
			oldMember.roles.cache.has(process.env.ROLEID_LORD) ||
			oldMember.roles.cache.has(process.env.ROLEID_KING) ||
			newMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
			newMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
			newMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||	
			newMember.roles.cache.has(process.env.ROLEID_NOBLE) ||
			newMember.roles.cache.has(process.env.ROLEID_LORD) ||
			newMember.roles.cache.has(process.env.ROLEID_KING)){
			await updateSelectMenu(client, lastMessageId);
		}

		const hadRoleBeforeKnight = oldMember.roles.cache.has(
			process.env.ROLEID_KNIGHT
		);
		const hasRoleNowKnight = newMember.roles.cache.has(
			process.env.ROLEID_KNIGHT
		);

		if (pollActive && hadRoleBeforeKnight && !hasRoleNowKnight) {
			if (pollParticipants.has(newMember.id)) {
				try {
					pollParticipants.delete(newMember.id);
				} catch (err) {
					showErrorMsg(err);
				}
			}
		}
		if (hadRoleBeforeKnight || hasRoleNowKnight) {
			if (lastMessageId) {
				try {
					const guild = await client.guilds.fetch(process.env.GUILDID);
					await guild.members.fetch();
					knights = guild.members.cache.filter((member) =>
						member.roles.cache.has(process.env.ROLEID_KNIGHT)
					);
					const kings = guild.members.cache.filter((member) =>
						member.roles.cache.has(process.env.ROLEID_KING)
					);
					kingsSize = kings.size;

					const channel = await client.channels.fetch(
						process.env.CHANNELIDKNIGHT
					);
					const messageToEdit = await channel.messages.fetch(lastMessageId);
					let content = initContent;
					if (pollActive) {
						content =
							content +
							`\nKing @${pollInitiatorUsername} initiated a siege. Join poll to downgrade ${pollTargetName}. (Joined ${pollParticipants.size} / ${knightsSize}.)`;
						const success = pollParticipants.size >= knightsSize / kingsSize;
						if (success) {
							triggerPollEarly(client, messageToEdit);
							return;
						}
						eventEmitter.emit(
							"KnightParticipatedOnSiege",
							pollParticipants.size,
							knightsSize
						);
					}

					const existingComponents = messageToEdit.components.map((component) =>
						ActionRowBuilder.from(component.toJSON())
					);
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
		if ( !interaction.isStringSelectMenu() && !interaction.isButton() ) return;
		const userId = interaction.user.id;
		if (interaction.customId === "SelectCutDown") {
			let selectedTargetId = interaction.values[0];
			try {
				selectedTargets[userId] = await interaction.guild.members.cache.get(selectedTargetId);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "CutDown") {
			try {
				if (!selectedTargets[userId]) {
					await sendInteractionReply(interaction, `No scoundrel selected...`);
					return;
				}

				const targetId = selectedTargets[userId].id;
				const targetRoles = selectedTargets[userId].roles.cache;
				const userXP = await CacheGetUserXP(userId);

				// Check if target has a role that requires a writ
				const requiresWrit = targetRoles.has(process.env.ROLEID_KNIGHT) ||
					targetRoles.has(process.env.ROLEID_NOBLE) ||
					targetRoles.has(process.env.ROLEID_LORD) ||
					targetRoles.has(process.env.ROLEID_KING);

				if (requiresWrit) {
					// Check for active writs
					const hasWrit2 = await CacheCheckActiveWrit(userId, targetId, 2);
					const hasWrit3 = await CacheCheckActiveWrit(userId, targetId, 3);
					const hasWrit4 = await CacheCheckActiveWrit(userId, targetId, 4);

					let validWrit = null;
					if (hasWrit4) validWrit = 4;
					else if (hasWrit3 && !targetRoles.has(process.env.ROLEID_KING)) validWrit = 3;
					else if (hasWrit2 && !targetRoles.has(process.env.ROLEID_LORD) && !targetRoles.has(process.env.ROLEID_KING)) validWrit = 2;

					if (!validWrit) {
						await sendInteractionReply(interaction, "Target only available with appropriate writ");
						return;
					}

					// Execute writ
					await executeCutDown(interaction, userId, targetId, userXP, validWrit, client);
				} else {
					// No writ required
					const activeWrit = await CacheCheckActiveWrit(userId, targetId);
					if (activeWrit) {
						await executeCutDown(interaction, userId, targetId, userXP, activeWrit);
					} else {
						if (userXP < CutDownCost) {
							await sendInteractionReply(interaction, `Not enough XP (current XP: ${userXP})`);
							return;
						}
						await DBUpdateXP(userId, -CutDownCost, client);
						await performCutDown(interaction, targetId);
						await sendInteractionReply(interaction, `(${userXP - CutDownCost} XP left) Cut Down successful with no writ`);
					}
				}

				selectedTargets[userId] = null;
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "ShowWrits") {
			await handleShowWrits(interaction);
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

				const channel = await client.channels.fetch(
					process.env.CHANNELIDKNIGHT
				);
				const messageToEdit = await channel.messages.fetch(lastMessageId);
				const success = pollParticipants.size >= knightsSize / kingsSize;
				if (pollActive && success) {
					//If poll succeeded within voting ending time.
						triggerPollEarly(client, messageToEdit);
					return;
				} else {
					const editedContent =
						initContent +
						`\nKing @${pollInitiatorUsername} initiated a siege. Join poll to downgrade ${pollTargetName}. (Joined ${pollParticipants.size} / ${knightsSize}.)`;
					const existingComponents = messageToEdit.components.map(component => ActionRowBuilder.from(component.toJSON()));
					await messageToEdit.edit({ content: editedContent, components: existingComponents });
					eventEmitter.emit(
						"KnightParticipatedOnSiege",
						pollParticipants.size,
						knightsSize
					);
				}
			} catch (err) {
				throw err;
			}
		}
	});

	eventEmitter.on("siegeStarted", async (initiatorUsername, targetName) => {
		try {
			const channel = await client.channels.fetch(process.env.CHANNELIDKNIGHT);
			if (lastMessageId) {
				const guild = await client.guilds.fetch(process.env.GUILDID);
				await guild.members.fetch();
				knights = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_KNIGHT)
				);
				const kings = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_KING)
				);
				knightsSize = knights.size;
				kingsSize = kings.size;
				interactions = [];
				pollActive = true;
				pollInitiatorUsername = initiatorUsername;
				pollTargetName = targetName;

				const messageToEdit = await channel.messages.fetch(lastMessageId);
				const content =
					initContent +
					`\nKing @${initiatorUsername} initiated a siege. Join poll to downgrade ${targetName}.`;
				const existingComponents = messageToEdit.components.map((component) =>
					ActionRowBuilder.from(component.toJSON())
				);
				const btnRow = new ActionRowBuilder().addComponents(
					new ButtonBuilder()
					.setCustomId("CutDown")
					.setLabel("Cut Down")
					.setStyle(ButtonStyle.Primary),
					new ButtonBuilder()
					.setCustomId("JoinPoll")
					.setLabel("Join Poll")
					.setStyle(ButtonStyle.Primary)
				);
				existingComponents[1] = btnRow;
				await messageToEdit.edit({
					content,
					components: existingComponents,
				});

				startPoll(client, messageToEdit, SiegePollDuration);
			}
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("siegeResult", async (message) => {
		try {
			sendMessage(message);
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("triggerPollEarly", async (message) => {
		try {
			const channel = await client.channels.fetch(process.env.CHANNELIDKNIGHT);
			const messageToEdit = await channel.messages.fetch(lastMessageId);
			if (pollActive) {
				//If poll succeeded within voting ending time.
					triggerPollEarly(client, messageToEdit);
				sendMessage(message);
			}
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("kingSizeChanged", async (size) => {
		try {
			kingsSize = size;
		} catch (err) {
			showErrorMsg(err);
		}
	});
}

async function startPoll(client, messageToEdit, timeout) {
	pollTimeout = setTimeout(async () => {
		await handlePollEnd(client, messageToEdit);
	}, timeout);
}

async function handlePollEnd(client, messageToEdit) {
	if (pollActive) {
		eventEmitter.emit("SiegePollFinished", pollParticipants.size, knightsSize);
		await sendMessage("Timed poll finished.");
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

async function handleShowWrits(interaction) {
	try {
		const knightId = interaction.user.id;
		const writs = await CacheGetKnightWrits(knightId);

		if (writs.length === 0) {
			await sendInteractionReply(interaction, 'You have no active writs.');
			return;
		}

		const writDescriptions = writs.map((writ, index) => {
			return `${index + 1}. Type: ${getWritType(writ.writType)}, Target: <@${writ.targetId}>, Status: ${getWritStatus(writ.writStatus)}, Message: ${writ.writMessage}`;
		});

		const response = `Your active writs:\n\n${writDescriptions.join('\n')}`;

		await sendInteractionReply(interaction, response);
	} catch (error) {
		console.error('Error in handleShowWrits:', error);
		await sendInteractionReply(interaction, 'An error occurred while fetching your writs.');
	}
}
function getWritType(writType) {
	switch(writType) {
		case 1: return "High";
		case 2: return "Eminent";
		case 3: return "Royal";
		case 4: return "Imperial";
		default: throw new Error('Invalid writ type');
	}
}
function getWritStatus(status) {
	switch (status) {
		case 0: return 'to be executed';
		case 1: return 'Executed';
		case 2: return 'Failed';
		case 3: return 'Anulled, knight or target have changed roles';
		default: showErrorMsg('Writ status incorrect');
	}
}

async function executeCutDown(interaction, userId, targetId, userXP, client) {
	const cooldown = await CacheGetCooldown("cutdown", userId);
	if (cooldown) {
		await sendInteractionReply(interaction, "Cut Down is on cooldown and cannot be used");
		return;
	}

	// Get all active writs for this knight and target
	const activeWrits = await CacheGetKnightWrits(userId);
	const relevantWrits = activeWrits.filter(writ => 
		writ.targetId === targetId && writ.writStatus === 0
	);

	if (relevantWrits.length === 0) {
		// No writs found, proceed with normal Cut Down
		if (userXP < CutDownCost) {
			await sendInteractionReply(interaction, `Not enough XP (current XP: ${userXP})`);
			return;
		}
		await DBUpdateXP(userId, -CutDownCost, client);
		await performCutDown(interaction, targetId);
		await sendInteractionReply(interaction, `(${userXP - CutDownCost} XP left) Cut Down successful with no writ`);
		return;
	}

	// Calculate total XP reward
	let totalXpReward = 0;
	for (const writ of relevantWrits) {
		let xpReward;
		switch (writ.writType) {
			case 1: xpReward = HighWritReward; break;
			case 2: xpReward = EminentWritReward; break;
			case 3: xpReward = RoyalWritReward; break;
			case 4: xpReward = ImperialWritReward; break;
			default: showErrorMsg('Writ type incorrect');

		}
		totalXpReward += xpReward;

		// Update writ status
		await CacheUpdateWritStatus(writ.writType, writ.writerId, userId, targetId, 1);
	}

	// Apply XP reward and perform Cut Down
	await DBUpdateXP(userId, totalXpReward, client);
	await CacheSetCooldown("cutdown", userId, CutDownCooldown);
	await performCutDown(interaction, targetId);

	const newXP = parseInt(userXP) + totalXpReward;
	const writDetails = relevantWrits.map(writ => `type ${writ.writType}`).join(', ');
	await sendInteractionReply(interaction, 
		`(${newXP} XP) Cut Down successful. Executed ${relevantWrits.length} writ(s): ${writDetails}. Total reward: ${totalXpReward} XP`
	);
}
async function performCutDown(interaction, targetId) {
	const target = await interaction.guild.members.fetch(targetId);
	eventEmitter.emit('changeRole', target, 'Poop');
	eventEmitter.emit("CutDownComplete", target.user.username, interaction.user.username);
}


async function updateSelectMenu(client, lastMessageId) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDKNIGHT);
		const messageToEdit = await channel.messages.fetch(lastMessageId);
		const selectMenu = await buildSelectMenu(client, ["peasant", "scholar", "merchant", "noble", "lord", "king"], "SelectCutDown");
		const actionRow_0 = new ActionRowBuilder().addComponents(selectMenu);
		const existingComponents = messageToEdit.components.map(component => ActionRowBuilder.from(component.toJSON()));
		existingComponents[0] = actionRow_0;

		await messageToEdit.edit({
			content: messageToEdit.content,
			components: existingComponents
		});
	} catch (err) {
		showErrorMsg(err);
	}
}
async function messageKnightCommands(client) {
	let channel = null;
	try {
		channel = await client.channels.fetch(process.env.CHANNELIDKNIGHT);
		const cutDownSelectMenu = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(
				client, ["peasant", "scholar", "merchant", "noble", "lord", "king"], "SelectCutDown")
			);
		const btnRow = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
				.setCustomId("CutDown")
				.setLabel("Cut Down")
				.setStyle(ButtonStyle.Primary)
			);
		const infoBtnRow = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
				.setCustomId("ShowWrits")
				.setLabel("Read yer writs")
				.setStyle(ButtonStyle.Danger)
			);

		const message = await channel.send({
			content: initContent,
			components: [cutDownSelectMenu, btnRow, infoBtnRow],
		});
		return message;
	} catch (err) {
		console.error(err);
		return;
	}
}

async function resetPoll(client, messageToEdit) {
	try {
		pollActive = false;
		pollInitiatorUsername = "";
		pollTargetName = "";
		pollParticipants.clear();
		knightsSize = 1;
		knights = [];
		const existingComponents = messageToEdit.components.map(component => ActionRowBuilder.from(component.toJSON()));
		const btnRow = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
				.setCustomId("CutDown")
				.setLabel("Cut Down")
				.setStyle(ButtonStyle.Primary)
			);
		existingComponents[1] = btnRow;
		await messageToEdit.edit({
			content: initContent,
			components: [existingComponents],
		});
	} catch (err) {
		throw err;
	}
}

module.exports = { setupKnightBotEvents, messageKnightCommands };
