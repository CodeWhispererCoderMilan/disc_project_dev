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
    	messageAllHumanChannels,
    	messageChannel,
} = require("../functions/botActions");
const {
	CacheGetCooldown,
	CacheSetCooldown,
	CacheGetUserXP,
	CacheGetWriterWrits,
	CacheSetWrit,
    	CacheGetUsersByRoles
} = require("../apis/redis/redisCache");
const {
	NobleLordElectionTime,
	LordKingElectionTime,
	NobleLordElectionSuccessThreshold,
	LordKingElectionSuccessThreshold,
	LordElectionCooldown,
	RoleChangeMessageDisplayTime,
	EminentWritCooldown,
	TextLordMessageContent,
	TextEminentWritKnightSelectMenu,
	TextEminentWritTargetSelectMenu,
	TextElectionSelectMenu,
	TextExileSelectMenu,
	ButtonLabelExile,
	ExileCooldown,
	ExileCost,
	ButtonLabelEminentWrit,
	ButtonLabelElection,
	ButtonLabelElectionVote,
	ButtonLabelShowWrits,
	MinimumLordSize,
	MinimumLordSizeForElection
} = require("../game_config.json");
const { eventEmitter } = require("../functions/eventEmitter.js");
const { DBUpdateXP, isThresholdOpen, changeRole, openThreshold, closeThreshold } = require("../apis/firebase/querys");
const gameState = require("../game_state");


let selectedElectionCandidates = {};
let selectedExileUsers = {};
let electionInitiatorId = null;
let electionInitiator = null;
let electionCandidateId = null;
let electionCandidate = null;
let electionActive = false;
let electionParticipants = new Set();
let electionTimeout;
let electionType = "";
let disableElection = true;

const selectedHumans = {};
const selectedKnights = {};

const initContent = TextLordMessageContent;

function showErrorMsg(err) {
	console.error("ERROR: lord_commands.js", err);
}

async function setupLordBotEvents(client, lastMessageId) {

	client.on("guildMemberRemove", async (member) => {
		const hadRoleBeforeNoble = member.roles.cache.has(
			process.env.ROLEID_NOBLE
		);
		const hadRoleBeforeLord = member.roles.cache.has(
			process.env.ROLEID_LORD,
		);
		const hadRoleBeforePeasant = member.roles.cache.has(process.env.ROLEID_PEASANT);
		const hadRoleBeforeScholar = member.roles.cache.has(process.env.ROLEID_SCHOLAR);
		const hadRoleBeforeMerchant = member.roles.cache.has(process.env.ROLEID_MERCHANT);
		const hadRoleBeforeKnight = member.roles.cache.has(process.env.ROLEID_KNIGHT);	
		const hadRoleBeforeSubhuman = member.roles.cache.has(process.env.ROLEID_SUBHUMAN); 
		if (hadRoleBeforePeasant || hadRoleBeforeScholar || hadRoleBeforeMerchant ||
			hadRoleBeforeNoble ||hadRoleBeforeKnight || hadRoleBeforeSubhuman
		) {
			if(member.id != electionCandidateId) await updateMessage(client, lastMessageId);
			for(let userId of selectedHumans){
				if(selectedHumans[userId] && selectedHumans[userId].id === member.id){
					selectedHumans[userId] = null;
				}
			}
			for(let userId of selectedKnights){
				if(selectedKnights[userId] && selectedKnights[userId].id === member.id){
					selectedKnights[userId] = null;
				}
			}
		}

		if (electionActive && hadRoleBeforeLord ) {
			if(electionParticipants.has(member.id)){
				try {
					selectedElectionCandidates[member.id] = null;
					electionParticipants.delete(member.id);

					const participationRate = electionParticipants.size / gameState.getRoleSize("Lord");

					if (member.id === electionInitiatorId) {
						const msg = `<@${electionInitiatorId}>, who summoned the great council, is no longer a lord. The election is void.`;
						eventEmitter.emit("NotifyLordChannel", msg);
						electionActive = false;
						await ceaseElection(client, lastMessageId);
						return;
					} else if (
						electionType === "Noble" &&
						participationRate >= NobleLordElectionSuccessThreshold
					) {
						ceaseElection(client, lastMessageId);
						return;
					} else if (
						electionType === "Lord" &&
						participationRate >= LordKingElectionSuccessThreshold
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
			if(member.id === electionCandidateId){
				try {
					const msg = `The role of the election candidate @${electionCandidateId} has changed. The election is void.`;
					eventEmitter.emit("NotifyLordChannel", msg);
					electionActive = false;
					await ceaseElection(client, lastMessageId);
					return;
				} catch (e) {
					showErrorMsg(e);
				}
			}
		}
		if (electionActive && hadRoleBeforeLord) {
			if(!member.id === electionCandidateId && !electionParticipants.has(member.id)){	
				try {
					const participationRate = electionParticipants.size / gameState.getRoleSize("Lord");
					if (
						electionType === "Noble" &&
						participationRate >= NobleLordElectionSuccessThreshold
					) {
						ceaseElection(client, lastMessageId);
					} else if (
						electionType === "Lord" &&
						participationRate >= LordKingElectionSuccessThreshold
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
			oldMember.roles.cache.has(process.env.ROLEID_SUBHUMAN) ||
			newMember.roles.cache.has(process.env.ROLEID_SUBHUMAN) ||
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

		if (electionActive && hadRoleBeforeLord ) {
			if(electionParticipants.has(newMember.id)){
				try {
					selectedElectionCandidates[newMember.id] = null;
					electionParticipants.delete(newMember.id);

					const participationRate =
						electionParticipants.size / gameState.getRoleSize("Lord");

					if (newMember.id === electionInitiatorId) {
						const msg = `<@${electionInitiatorId}>, who summoned the great council, is no longer a lord. The election is void.`;
						eventEmitter.emit("NotifyLordChannel", msg);
						electionActive = false;
						await ceaseElection(client, lastMessageId);
						return;
					} else if (
						electionType === "Noble" &&
						participationRate >= NobleLordElectionSuccessThreshold
					) {
						ceaseElection(client, lastMessageId);
						return;
					} else if (
						electionType === "Lord" &&
						participationRate >= LordKingElectionSuccessThreshold
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
		if (electionActive && (hadRoleBeforeNoble || hadRoleBeforeLord) 
			&& newMember.id === electionCandidateId){
				try {
					const msg = `The role of the election candidate <@${electionCandidateId}> has changed. The election is void.`;
					eventEmitter.emit("NotifyLordChannel", msg);
					electionActive = false;
					await ceaseElection(client, lastMessageId);
					return;
				} catch (e) {
					showErrorMsg(e);
				}
		}
		if (electionActive && (hadRoleBeforeLord || hasRoleNowLord)) {
			if(!newMember.id === electionCandidateId &&!electionParticipants.has(newMember.id)){	
				try {
					const participationRate =
						electionParticipants.size / gameState.getRoleSize("Lord");
					if (
						electionType === "Noble" &&
						participationRate >= NobleLordElectionSuccessThreshold
					) {
						ceaseElection(client, lastMessageId);
					} else if (
						electionType === "Lord" &&
						participationRate >= LordKingElectionSuccessThreshold
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

		if (interaction.customId === "SelectExile") {
			let selectedUserId = interaction.values[0];
			try {
				await interaction.deferUpdate();
				selectedExileUsers[userId] = await interaction.guild.members.fetch(selectedUserId);

			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "Exile") {
			try {

				if (!selectedExileUsers[userId]){
					await sendInteractionReply(interaction, `No peasant, scholar or merchant selected...`)
					return;
				}
				const userXP = await CacheGetUserXP(userId);
				if (userXP < ExileCost) {
					await sendInteractionReply(interaction, `Not enough drops(current drops: ${userXP})`);
					return;
				} else {
					const cooldown = await CacheGetCooldown("exile", userId);
					if (cooldown){
						await sendInteractionReply(interaction,
							"Exile is on cooldown and cannot be used");
						return;
					}
					await interaction.deferReply({ephemeral: true});
					const targetId = selectedExileUsers[userId].user.id;
					await changeRole( selectedExileUsers[userId], 'Sub-human', false);
					await messageAllHumanChannels(client, `<@${targetId}>'s words fly up,
						Their thoughts remain below,
						Words without thoughts never to Heaven go.

						Exiled to the forest by Lord <@${userId}>.`);
					await messageChannel(client, process.env.CHANNELID_FOREST,
						`<@${targetId}> fell out of Lord <@${userId}>'s graces.
						They wander the forest as a sub-human, the comfort upstream renders them weak amongst their newfound kin.`);
					selectedExileUsers[userId] = null;
					await DBUpdateXP(userId, -ExileCost, client);
					await CacheSetCooldown("exile", userId, ExileCooldown);
					eventEmitter.emit("ExileComplete", targetId, userId);
					const XPLeft = parseInt(userXP) - parseInt(ExileCost);
					await sendInteractionReply(interaction, `(${XPLeft} drops left) You've exiled <@${targetId}> beyond the forest, stripping them of their humanity.`);
				}
			}catch (err) {
				showErrorMsg(err);
			}
		}
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

		if (interaction.customId === "EminentWrit") {
			try {

				if (!selectedHumans[userId] || !selectedKnights[userId]){
					await sendInteractionReply(interaction, "No knight or target selected.");
					return;
				}
				const cooldown = await CacheGetCooldown("eminentWrit", userId);
				if (cooldown)
					await sendInteractionReply(interaction, "Eminent Writ is on cooldown and cannot be used.");
				else {
					const modal = buildEminentWritModal();
					await interaction.showModal(modal);
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "EminentWritModal"){
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
				await CacheSetWrit(2, userId, selectedKnights[userId].id, selectedHumans[userId].id, 0, writMessage, writAmount);
				await DBUpdateXP(userId, -writAmount, client);
				await CacheSetCooldown("eminentWrit", userId, EminentWritCooldown);
				await sendInteractionReply(interaction, `Eminent Writ of execution succesfully emitted! (drops left: ${userXP - writAmount})`);
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
					await interaction.guild.members.fetch(candidateId);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "Election") {

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
					if(gameState.getRoleSize("Lord") < MinimumLordSizeForElection){
						await sendInteractionReply(interaction,
							`There must be at least ${MinimumLordSizeForElection} lords for an election to be held. Current number of lords: ${gameState.getRoleSize("Lord")}`);
						return;
					}
					
					await updateMessage(client, lastMessageId);
					if (electionType === "Noble")
						await startElection(client, lastMessageId, NobleLordElectionTime);
					else await startElection(client, lastMessageId, LordKingElectionTime);

					await sendInteractionReply(
						interaction,
						"Election started, waiting for other lords to join."
					);
					let voteType = electionType === "Noble" ? "Lord" : "King";

					await messageChannel(
						client,
						process.env.CHANNELID_GREAT_COUNCIL,
						`<@${interaction.user.id}> has summoned the council by proposing <@${electionCandidateId}> be ${voteType}. An election is underway.`
					);

					const participationRate =
						electionParticipants.size / gameState.getRoleSize("Lord");
					if (
						electionType === "Noble" &&
						participationRate >= NobleLordElectionSuccessThreshold
					) {
						ceaseElection(client, lastMessageId);
						return;
					} else if (
						electionType === "Lord" &&
						participationRate >= LordKingElectionSuccessThreshold
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
				let voteType = electionType === "Noble" ? "Lord" : "King";
				await messageChannel(client, process.env.CHANNELID_GREAT_COUNCIL,`<@${interaction.user.id}> has voted in favor of <@${electionCandidateId}> becoming a ${voteType}.`);
				const participationRate = electionParticipants.size / gameState.getRoleSize("Lord");
				if (electionActive) {
					if (
						(electionType === "Noble" &&
							participationRate >= NobleLordElectionSuccessThreshold) ||
						(electionType === "Lord" &&
							participationRate >= LordKingElectionSuccessThreshold)
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

	eventEmitter.on("UpdateLordMessageIfNoElectionOngoing", async () => {
		try {
			if (!electionActive) await updateMessage(client, lastMessageId);
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("NotifyLordChannel", async (msg) => {
		try {
			let channel = await client.channels.fetch(process.env.CHANNELIDLORD);
			const message = await channel.send({
				content: msg,
			});
			setTimeout(async () => {
				await message.delete().catch(showErrorMsg);
			}, RoleChangeMessageDisplayTime);
		} catch (err) {
			throw err;
		}
	});
	eventEmitter.on("ServerStatusChange", async () => {
		try{
			await updateMessage(client, lastMessageId);
		}catch(err){
			showErrorMsg(err);
		}
	});
	eventEmitter.on("ExileComplete", async (subHumanId, initiatorId) => {
		try {
			const channel = await client.channels.fetch(process.env.CHANNELIDLORD);
			const tmpMessage = await channel.send(`<@${subHumanId}> has been exiled by <@${initiatorId}>.`);
			setTimeout(async () => {
				await tmpMessage.delete().catch(showErrorMsg);
			}, 30000);
		} catch (err) {
			showErrorMsg(err);
		}
	});

}

async function startElection(client, lastMessageId, timeout) {
	electionTimeout = setTimeout(async () => {
		await handleElectionEnd(client, lastMessageId);
	}, timeout);
}

async function handleElectionEnd(client, lastMessageId) {
	const wasActive = electionActive;
	electionActive = false; 	
	const participationRate = electionParticipants.size / gameState.getRoleSize("Lord");
	let voteType = electionType === "Noble" ? "Lord" : "King";
	if (
		wasActive &&
		((electionType === "Noble" &&
			participationRate >= NobleLordElectionSuccessThreshold) ||
			(electionType === "Lord" &&
				participationRate >= LordKingElectionSuccessThreshold))
	) {
		let msg = "";
		const target = selectedElectionCandidates[electionInitiatorId];
		if (target) {
			if (electionType === "Noble") {
				await changeRole(target, "Lord", true);
				msg = `<@${electionCandidateId}> has been blessed with lordhood by The Two Gods through the service one has to another, through the great council.`;
			}
			if (electionType === "Lord") {
				await changeRole(target, "King", true);
				msg = `<@${electionCandidateId}> has been anointed king in drizlling drops by the great council, by the subservient watch of our lords. May his deluge run out into the stream.`;
			}
		}
		eventEmitter.emit("NotifyLordChannel", `<@${electionInitiatorId}>'s election of <@${electionCandidateId}> as ${voteType} was successful.`);
		await messageAllHumanChannels(client, msg);
	} else {
		const msg = ` <@${electionInitiatorId}> dull attempt to make <@${electionCandidateId}> ${voteType} has failed, reflecting his stagnant whims.`;
		eventEmitter.emit("NotifyLordChannel", `<@${electionInitiatorId}>'s election of <@${electionCandidateId}> as ${voteType} has failed.`);
		await messageChannel(client, process.env.CHANNELID_GREAT_COUNCIL, msg);
	}
	await CacheSetCooldown("Election", electionInitiatorId, LordElectionCooldown);
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
		const channel = await client.channels.fetch(process.env.CHANNELIDLORD);
		const messageToEdit = await channel.messages.fetch(lastMessageId);
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";

		if (!electionActive) {

			const actionRow_0 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(
					client,
					["peasant", "scholar", "merchant"], 
					"SelectExile",TextExileSelectMenu
				));
			const electionSelectMenu = await buildSelectMenu(
				client,
				["noble", "lord"],
				"ElectionSelectMenu", TextElectionSelectMenu
			);
			const actionRow_1 = new ActionRowBuilder().addComponents(
				electionSelectMenu
			);
			const actionRow_2 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(
					client, ["peasant", "scholar", "merchant","noble"], "SelectHuman", TextEminentWritTargetSelectMenu
				));
			const actionRow_3 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(
					client, ["knight"], "SelectKnight", TextEminentWritKnightSelectMenu
				));
			const buttonRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("Exile")
				.setLabel(ButtonLabelExile)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("Election")
				.setLabel(ButtonLabelElection)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.getDisableElection() || gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("EminentWrit")
				.setLabel(ButtonLabelEminentWrit)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("ShowWrits")
				.setLabel(ButtonLabelShowWrits)
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(gameState.isServerDown())
			);			

			await messageToEdit.edit({
				content: serverText + '\n' + initContent,
				components: [actionRow_0, actionRow_1, actionRow_2, actionRow_3, buttonRow],
			});
		} else {
			const actionRow_0 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(client, ["peasant", "scholar", "merchant"], "SelectExile",TextExileSelectMenu));
			const actionRow_1 = ActionRowBuilder.from(
				messageToEdit.components[1].toJSON()
			);
			const electionSelectMenu = StringSelectMenuBuilder.from(
				actionRow_1.components[0].toJSON()
			)
				.setDisabled(true)
				.setPlaceholder(electionCandidate);
			actionRow_1.components[0] = electionSelectMenu;
			const actionRow_2 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(
					client, ["peasant", "scholar", "merchant","noble"], "SelectHuman", TextEminentWritTargetSelectMenu
				));
			const actionRow_3 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(
					client, ["knight"], "SelectKnight",TextEminentWritKnightSelectMenu
				));
			const buttonRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("Exile")
				.setLabel(ButtonLabelExile)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("Vote")
				.setLabel(ButtonLabelElectionVote)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("EminentWrit")
				.setLabel(ButtonLabelEminentWrit)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("ShowWrits")
				.setLabel(ButtonLabelShowWrits)
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(gameState.isServerDown())
			);
			let voteType = electionType === "Noble" ? "Lord" : "King";
			await messageToEdit.edit({
				content:
				serverText + '\n' +
				initContent +
				`\n <@${electionInitiatorId}> summoned the great council, proposing the election of <@${electionCandidateId}> as ${voteType}. (Joined ${electionParticipants.size} / ${gameState.getRoleSize("Lord")}.)`,
				components: [actionRow_0,actionRow_1,actionRow_2,actionRow_3, buttonRow],
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
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";
		const actionRow_0 = new ActionRowBuilder().addComponents(
			await buildSelectMenu(client, ["peasant", "scholar", "merchant"], "SelectExile", TextExileSelectMenu));

		const electionSelectMenu = await buildSelectMenu(
			client,
			["noble", "lord"],
			"ElectionSelectMenu", TextElectionSelectMenu
		);		
		const actionRow_1 = new ActionRowBuilder().addComponents(
			electionSelectMenu
		);
		const actionRow_2 = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(
				client, ["peasant", "scholar", "merchant", "noble"], "SelectHuman", TextEminentWritTargetSelectMenu
			));
		const actionRow_3 = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(
				client, ["knight"], "SelectKnight", TextEminentWritKnightSelectMenu
			));
		const buttonRow = new ActionRowBuilder().addComponents(		
			new ButtonBuilder()
			.setCustomId("Exile")
			.setLabel(ButtonLabelExile)
			.setStyle(ButtonStyle.Primary)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("Election")
			.setLabel(ButtonLabelElection)
			.setStyle(ButtonStyle.Primary)
			.setDisabled(gameState.getDisableElection() || gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("EminentWrit")
			.setLabel(ButtonLabelEminentWrit)
			.setStyle(ButtonStyle.Primary)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("ShowWrits")
			.setLabel(ButtonLabelShowWrits)
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(gameState.isServerDown())
		);
		const message = await channel.send({
			content:serverText + '\n' +  initContent,
			components: [actionRow_0,actionRow_1,actionRow_2, actionRow_3, buttonRow],
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
		electionType = "";
		await updateMessage(client, lastMessageId);
	} catch (err) {
		throw err;
	}
}

module.exports = { setupLordBotEvents, messageLordCommands };
