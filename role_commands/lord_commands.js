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
	NobleLordElectionTime,
	LordKingElectionTime,
	NobleLordElectionSuccessThreadshold,
	LordKingElectionSuccessThreadshold,
	LordElectionCoolDown,
	RoleChangeMessageDisplayTime,
	EminentWritCost,
	EminentWritCooldown,
	TextLordMessageContent,
	TextEminentWritKnightSelectMenu,
	TextEminentWritTargetSelectMenu,
	TextElectionSelectMenu,
	ButtonLabelEminentWrit,
	ButtonLabelElection,
	ButtonLabelElectionVote,
	ButtonLabelShowWrits,
	MinimumLordSize,
	MinimumLordSizeForElection
} = require("../game_config.json");
const { eventEmitter } = require("../functions/eventEmitter.js");
const { DBUpdateXP } = require("../apis/firebase/querys");

let selectedElectionCandidates = {};
let lords = [];
let lordsSize = 0;
let electionInitiatorId = null;
let electionInitiator = null;
let electionCandidateId = null;
let electionCandidate = null;
let electionActive = false;
let electionParticipants = new Set();
let electionTimeout;
let electionType = "";
let xpThresholdLordOpen = true;
let disableElection = true;
const selectedHumans = {};
const selectedKnights = {};

const initContent = TextLordMessageContent;

function showErrorMsg(err) {
	console.error("ERROR: lord_commands.js", err);
}

async function setupLordBotEvents(client, lastMessageId) {
	client.on("guildMemberUpdate", async (oldMember, newMember) => {
		const hadRoleBeforeNoble = oldMember.roles.cache.has(
			process.env.ROLEID_NOBLE
		);
		const hadRoleBeforeLord = oldMember.roles.cache.has(
			process.env.ROLEID_LORD
		);
		const hasRoleNowLord = newMember.roles.cache.has(process.env.ROLEID_LORD);
		if (oldMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
			oldMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
			oldMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
			oldMember.roles.cache.has(process.env.ROLEID_NOBLE) ||
			oldMember.roles.cache.has(process.env.ROLEID_KNIGHT) ||
			newMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
			newMember.roles.cache.has(process.env.ROLEID_KNIGHT) ||
			newMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
			newMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
			newMember.roles.cache.has(process.env.ROLEID_NOBLE)) {
			if(newMember.id != electionCandidateId) await updateMessage(client, lastMessageId);
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
		if( hadRoleBeforeLord || hasRoleNowLord){
			try{
				const guild = await client.guilds.fetch(process.env.GUILDID);
				lords = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_LORD)
				);
				lordsSize = lords.size;
				if(lordsSize < MinimumLordSize && !xpThresholdLordOpen){
					xpThresholdLordOpen  = true;
					eventEmitter.emit("OpenXpThresholdLord");
				}
				if(lordsSize > MinimumLordSize && xpThresholdLordOpen ){
					xpThresholdLordOpen = false;
					eventEmitter.emit("CloseXpThresholdLord");
				}
				if(lordsSize < MinimumLordSizeForElection && disableElection === false){
					disableElection = true;
					if(!electionActive && lastMessageId) await updateMessage(client,lastMessageId);
				}
				if(lordsSize >= MinimumLordSizeForElection && disableElection === true){
					disableElection = true;
					if(!electionActive && lastMessageId) await updateMessage(client,lastMessageId);
				}
			}catch(err){
				showErrorMsg(err);
			}
		}

		if (electionActive && hadRoleBeforeLord ) {
			if(electionParticipants.has(newMember.id)){
				try {
					selectedElectionCandidates[newMember.id] = null;
					electionParticipants.delete(newMember.id);

					const participationRate = electionParticipants.size / lordsSize;

					if (newMember.id === electionInitiatorId) {
						const msg = `The initiator ${electionInitiator} is no longer a lord.`;
						eventEmitter.emit("NotifyLordChannel", msg);
						electionActive = false;
						await ceaseElection(client, lastMessageId);
						return;
					} else if (
						electionType === "Noble" &&
						participationRate >= NobleLordElectionSuccessThreadshold
					) {
						ceaseElection(client, lastMessageId);
						return;
					} else if (
						electionType === "Lord" &&
						participationRate >= LordKingElectionSuccessThreadshold
					) {
						ceaseElection(client, lastMessageId);
						return;
					} else {
						await updateMessage(client, lastMessageId);
					}
				} catch (err) {
					showErrorMsg(err);
				}
			}
		}
		if (electionActive && (hadRoleBeforeNoble || hadRoleBeforeLord)) {
			if(newMember.id === electionCandidateId){
				try {
					const msg = `The role of the candidate @${electionCandidate} has been changed.`;
					eventEmitter.emit("NotifyLordChannel", msg);
					electionActive = false;
					await ceaseElection(client, lastMessageId);
					return;
				} catch (e) {
					showErrorMsg(e);
				}
			}
		}
		if (electionActive && (hadRoleBeforeLord || hasRoleNowLord)) {
			if(!newMember.id === electionCandidateId &&!electionParticipants.has(newMember.id)){	
				try {
					const participationRate = electionParticipants.size / lordsSize;
					if (
						electionType === "Noble" &&
						participationRate >= NobleLordElectionSuccessThreadshold
					) {
						ceaseElection(client, lastMessageId);
					} else if (
						electionType === "Lord" &&
						participationRate >= LordKingElectionSuccessThreadshold
					) {
						ceaseElection(client, lastMessageId);
					} else {
						updateMessage(client, lastMessageId);
					}
				} catch (e) {
					showErrorMsg(e);
				}
			}
		}

	});

	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isStringSelectMenu() && 
			!interaction.isButton()&& !interaction.isModalSubmit()) return;
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

		if (interaction.customId === "EminentWrit") {
			try {

				if (!selectedHumans[userId] || !selectedKnights[userId]){
					await sendInteractionReply(interaction, "No knight or target selected.");
					return;
				}
				const userXP = await CacheGetUserXP(userId);
				if (userXP < EminentWritCost) {
					await sendInteractionReply(interaction, `Not enough XP (current XP: ${userXP})`)
				} else {
					const cooldown = await CacheGetCooldown("eminentWrit", userId);
					if (cooldown)
						await sendInteractionReply(interaction, "Eminent Writ is on cooldown and cannot be used.");
					else {
						const modal = buildEminentWritModal();
						await interaction.showModal(modal);
					}
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "EminentWritModal"){
			try{
				const writMessage = interaction.fields.getTextInputValue('messageToKnight');
				await CacheSetWrit(2, userId, selectedKnights[userId].id, selectedHumans[userId].id, 0, writMessage);
				const userXP = await CacheGetUserXP(userId);
				await DBUpdateXP(userId, EminentWritCost, client);
				await CacheSetCooldown("eminentWrit", userId, EminentWritCooldown);
				await sendInteractionReply(interaction, `Eminent Writ of execution succesfully emitted! (XP left: ${userXP - EminentWritCost})`);
			}catch(err){
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "ShowWrits") {
			await handleShowWrits(interaction);
		}

		if (interaction.customId === "ElectionSelectMenu") {
			let candidateId = interaction.values[0];
			try {
				selectedElectionCandidates[userId] =
					await interaction.guild.members.cache.get(candidateId);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "Election") {
			lords = interaction.guild.members.cache.filter((member) =>
				member.roles.cache.has(process.env.ROLEID_LORD)
			);
			lordsSize = lords.size;

			if (!selectedElectionCandidates[userId]) {
				await sendInteractionReply(interaction, "No member selected");
				return;
			}

			let cooldown;
			try {
				cooldown = await CacheGetCooldown("Election", userId);
			} catch (err) {
				showErrorMsg(err);
			}
			if (cooldown) {
				sendInteractionReply(interaction, "Election is on cooldown");
				return;
			}

			electionInitiatorId = userId;
			electionInitiator = interaction.user.username;
			electionParticipants.add(userId);
			electionActive = true;
			electionCandidate = selectedElectionCandidates[userId].user.username;
			electionCandidateId = selectedElectionCandidates[userId].user.id;
			if (
				selectedElectionCandidates[userId].roles.cache.has(
					process.env.ROLEID_NOBLE
				)
			)
				electionType = "Noble";
			else electionType = "Lord";

			if (electionCandidateId === userId) {
				sendInteractionReply(interaction, "You cannot elect yourself.");
				return;
			}

			if (lastMessageId) {
				try {
					// Set cooldown
					await CacheSetCooldown("Election", userId, LordElectionCoolDown);
					await updateMessage(client, lastMessageId);
					if (electionType === "Noble")
						await startElection(client, lastMessageId, NobleLordElectionTime);
					else await startElection(client, lastMessageId, LordKingElectionTime);

					await sendInteractionReply(
						interaction,
						"Election started, waiting for other lords to join."
					);

					const participationRate = electionParticipants.size / lordsSize;
					if (
						electionType === "Noble" &&
						participationRate >= NobleLordElectionSuccessThreadshold
					) {
						ceaseElection(client, lastMessageId);
						return;
					} else if (
						electionType === "Lord" &&
						participationRate >= LordKingElectionSuccessThreadshold
					) {
						ceaseElection(client, lastMessageId);
						return;
					}
				} catch (err) {
					showErrorMsg(err);
				}
			}
		}
		if (interaction.customId === "Vote") {
			try {
				if (!electionActive) {
					await sendInteractionReply(
						interaction,
						"There is no active election to join."
					);
					return;
				}

				if (userId === electionInitiatorId) {
					await sendInteractionReply(
						interaction,
						"Once you started election, you don't need to vote since you are alreday a participant."
					);
					return;
				}

				if (userId === electionCandidateId) {
					await sendInteractionReply(interaction, "You cannot vote yourself.");
					return;
				}

				if (electionParticipants.has(userId)) {
					await sendInteractionReply(interaction, "You've already voted.");
					return;
				}

				electionParticipants.add(userId);
				await sendInteractionReply(interaction, "You have joind the poll.");

				const participationRate = electionParticipants.size / lordsSize;
				if (electionActive) {
					if (
						(electionType === "Noble" &&
							participationRate >= NobleLordElectionSuccessThreadshold) ||
						(electionType === "Lord" &&
							participationRate >= LordKingElectionSuccessThreadshold)
					) {
						//If poll succeeded within voting ending time.
							ceaseElection(client, lastMessageId);
						return;
					} else {
						updateMessage(client, lastMessageId);
					}
				}
			} catch (err) {
				throw err;
			}
		}
	});
	eventEmitter.on("NotifyLordChannel", async (msg) => {
		try {
			let channel = await client.channels.fetch(process.env.CHANNELIDLORD);
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

async function startElection(client, lastMessageId, timeout) {
	electionTimeout = setTimeout(async () => {
		await handleElectionEnd(client, lastMessageId);
	}, timeout);
}

async function handleElectionEnd(client, lastMessageId) {
	const participationRate = electionParticipants.size / lordsSize;
	if (
		electionActive &&
		((electionType === "Noble" &&
			participationRate >= NobleLordElectionSuccessThreadshold) ||
			(electionType === "Lord" &&
				participationRate >= LordKingElectionSuccessThreadshold))
	) {
		let msg = "";
		const target = selectedElectionCandidates[electionInitiatorId];
		if (target) {
			if (electionType === "Noble") {
				eventEmitter.emit("changeRole", target, "Lord", true);
				msg = `Election successful! @${electionCandidate} has become a lord by @${electionInitiator}.`;
			}
			if (electionType === "Lord") {
				eventEmitter.emit("changeRole", target, "King", true);
				msg = `Election successful! @${electionCandidate} has become a king by @${electionInitiator}.`;
			}
		}
		eventEmitter.emit("NotifyLordChannel", msg);
	} else {
		const msg = `Election on @${electionCandidate} started by @${electionInitiator} has been failed.`;
		eventEmitter.emit("NotifyLordChannel", msg);
	}
	await resetComponents(client, lastMessageId);
}

async function ceaseElection(client, lastMessageId) {
	if (electionTimeout) {
		clearTimeout(electionTimeout);
		await handleElectionEnd(client, lastMessageId);
	}
}

function buildEminentWritModal(){
	const modal = new ModalBuilder()
		.setCustomId('EminentWritModal')
		.setTitle('Eminent Writ of Execution');

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
		const channel = await client.channels.fetch(process.env.CHANNELIDLORD);
		const messageToEdit = await channel.messages.fetch(lastMessageId);

		if (!electionActive) {
			const electionSelectMenu = await buildSelectMenu(
				client,
				["noble", "lord"],
				"ElectionSelectMenu", TextElectionSelectMenu
			);
			const actionRow_0 = new ActionRowBuilder().addComponents(
				electionSelectMenu
			);
			const actionRow_1 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(
					client, ["peasant", "scholar", "merchant","noble"], "SelectHuman", TextEminentWritTargetSelectMenu
				));
			const actionRow_2 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(
					client, ["knight"], "SelectKnight", TextEminentWritKnightSelectMenu
				));
			const buttonRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("Election")
				.setLabel(ButtonLabelElection)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(disableElection),
				new ButtonBuilder()
				.setCustomId(ButtonLabelEminentWrit)
				.setLabel("Writ")
				.setStyle(ButtonStyle.Primary)
			);
			const infoBtnRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("ShowWrits")
				.setLabel(ButtonLabelShowWrits)
				.setStyle(ButtonStyle.Secondary)
			);
			await messageToEdit.edit({
				content: initContent,
				components: [actionRow_0,actionRow_1,actionRow_2, buttonRow, infoBtnRow],
			});
		} else {
			const actionRow_0 = ActionRowBuilder.from(
				messageToEdit.components[0].toJSON()
			);
			const electionSelectMenu = StringSelectMenuBuilder.from(
				actionRow_0.components[0].toJSON()
			)
				.setDisabled(true)
				.setPlaceholder(electionCandidate);
			actionRow_0.components[0] = electionSelectMenu;
			const actionRow_1 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(
					client, ["peasant", "scholar", "merchant","noble"], "SelectHuman", TextEminentWritTargetSelectMenu
				));
			const actionRow_2 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(
					client, ["knight"], "SelectKnight",TextEminentWritKnightSelectMenu
				));
			const buttonRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("Vote")
				.setLabel(ButtonLabelElectionVote)
				.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
				.setCustomId("EminentWrit")
				.setLabel(ButtonLabelEminentWrit)
				.setStyle(ButtonStyle.Primary)
			);
			const infoBtnRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("ShowWrits")
				.setLabel(ButtonLabelShowWrits)
				.setStyle(ButtonStyle.Secondary)
			);
			await messageToEdit.edit({
				content:
				initContent +
				`\n@${electionInitiator} started election. Let's vote for ${electionType} @${electionCandidate}. (Joined ${electionParticipants.size} / ${lordsSize}.)`,
				components: [actionRow_0,actionRow_1,actionRow_2, buttonRow,infoBtnRow],
			});
		}
	} catch (err) {
		showErrorMsg(err);
	}
}

async function messageLordCommands(client) {
	let channel = null;
	try {
		channel = await client.channels.fetch(process.env.CHANNELIDLORD);
	} catch (err) {
		showErrorMsg(err);
		return;
	}

	try {
		const electionSelectMenu = await buildSelectMenu(
			client,
			["noble", "lord"],
			"ElectionSelectMenu", TextElectionSelectMenu
		);
		const actionRow_0 = new ActionRowBuilder().addComponents(
			electionSelectMenu
		);
		const actionRow_1 = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(
				client, ["peasant", "scholar", "merchant", "noble"], "SelectHuman", TextEminentWritTargetSelectMenu
			));
		const actionRow_2 = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(
				client, ["knight"], "SelectKnight", TextEminentWritKnightSelectMenu
			));
		const buttonRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("Election")
			.setLabel(ButtonLabelElection)
			.setStyle(ButtonStyle.Primary)
			.setDisabled(disableElection),
			new ButtonBuilder()
			.setCustomId("EminentWrit")
			.setLabel(ButtonLabelEminentWrit)
			.setStyle(ButtonStyle.Primary)
		);
		const infoBtnRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("ShowWrits")
			.setLabel(ButtonLabelShowWrits)
			.setStyle(ButtonStyle.Secondary)
		);
		const message = await channel.send({
			content: initContent,
			components: [actionRow_0,actionRow_1,actionRow_2,buttonRow,infoBtnRow],
		});
		return message;
	} catch (err) {
		showErrorMsg(err);
	}
}

async function resetComponents(client, lastMessageId) {
	try {
		selectedElectionCandidates = {};
		electionActive = false;
		electionInitiator = null;
		electionInitiatorId = null;
		electionCandidate = null;
		electionCandidateId = null;
		electionParticipants.clear();
		lordsSize = 0;
		lords = [];
		electionType = "";
		await updateMessage(client, lastMessageId);
	} catch (err) {
		throw err;
	}
}

module.exports = { setupLordBotEvents, messageLordCommands };
