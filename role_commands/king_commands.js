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
	messageAllHumanChannels
} = require("../functions/botActions");
const {
	CacheGetUserXP,
	CacheGetCooldown,
	CacheSetCooldown,
	CacheGetWriterWrits,
	CacheSetWrit
} = require("../apis/redis/redisCache");
const {
	DegradationCost,
	DegradationCooldown,
	KnightCost,
	KnightCooldown,
	SiegeCooldown,
	SiegeCost,
	SiegeTime,
	RoleChangeMessageDisplayTime,
	RoyalWritCooldown,
	TextKingMessageContent,
	TextDegradationRoyalWritSelectMenu,
	TextKnightSelectMenu,
	TextSiegeKingSelectMenu,
	TextRoyalWritTargetSelectMenu,
	ButtonLabelDegradation,
	ButtonLabelRoyalWrit,
	ButtonLabelKnight,
	ButtonLabelSiege,
	ButtonLabelShowWrits,
} = require("../game_config.json");
const { eventEmitter } = require("../functions/eventEmitter.js");
const { DBUpdateXP, changeRole } = require("../apis/firebase/querys");
const gameState = require("../game_state.js");
let selectedHumans = {};
let selectedKnights = {};
let selectedKings = {};
const selectedWritHumans = {};


const initContent =TextKingMessageContent;
	
function showErrorMsg(err) {
	console.error("ERROR: king_commands.js", err);
}

async function setupKingBotEvents(client, lastMessageId) {
	client.on("guildMemberRemove", async (member) => {
		const hadRoleBeforeKing = member.roles.cache.has(
			process.env.ROLEID_KING
		);
		const hadRoleBeforeKnight = member.roles.cache.has(
			process.env.ROLEID_KNIGHT
		);
		const hadRoleBeforePeasant = member.roles.cache.has(process.env.ROLEID_PEASANT);
		const hadRoleBeforeScholar = member.roles.cache.has(process.env.ROLEID_SCHOLAR);
		const hadRoleBeforeMerchant = member.roles.cache.has(process.env.ROLEID_MERCHANT);
		const hadRoleBeforeNoble = member.roles.cache.has(process.env.ROLEID_NOBLE);
		const hadRoleBeforeLord = member.roles.cache.has(process.env.ROLEID_LORD);
	
		if (gameState.isSiegeActive() && hadRoleBeforeKing) {
			if (member.id === gameState.getSiegeInitiatorId()) {
				const message = "The siege has ceased as the role of the initiator has been changed.";
				gameState.clearSiegeTimeout();
				await resetSiege(client, lastMessageId);	
				eventEmitter.emit("siegeResult", message);
				await NotifyKingChannel(client, message);
			} else if (member.id === gameState.getSiegeTargetId()) {
				const message = "The siege has ceased as the role of the target has been changed.";
				gameState.clearSiegeTimeout();
				await resetSiege(client, lastMessageId);
				eventEmitter.emit("siegeResult", message);
				await NotifyKingChannel(client, message);
			}
		}	

		if(hadRoleBeforeKing) {
			for(let userId in selectedKings){
				if(selectedKings[userId] && selectedKings[userId].id == member.id){
					selectedKings[userId] = null;
				}
			}
		}		
		if (gameState.isSiegeActive() && hadRoleBeforeKnight) {
			if (gameState.isSiegeParticipant(member.id)) {
				try {
					gameState.removeSiegeParticipant(member.id);
				} catch (err) {
					showErrorMsg(err);
				}
			}
		}


		if ( hadRoleBeforePeasant || hadRoleBeforeScholar || hadRoleBeforeMerchant||
			hadRoleBeforeNoble || hadRoleBeforeKnight ||hadRoleBeforeLord) {
			for(let userId in selectedWritHumans){
				if(selectedWritHumans[userId] && selectedWritHumans[userId].id === member.id){
					selectedWritHumans[userId] = null;
				}
			}
			if(hadRoleBeforeKnight){
				for(let userId in selectedKnights){
					if(selectedKnights[userId] && selectedKnights[userId].id == member.id){
						selectedKnights[userId] = null;
					}
				}
			}
			else await updateMessage(client, lastMessageId);
		}
		if (gameState.isSiegeActive() &&(hadRoleBeforeKnight || hadRoleBeforeKing)){
			try {
				const siegeRatio = gameState.getRoleSize("Knight")/gameState.getRoleSize("King");
				const siegeSuccess =
					gameState.getSiegeParticipantsSize >= siegeRatio;
				if (siegeSuccess) {
					await ceaseSiege(client, lastMessageId);
					return;
				} else {
					await updateMessage(client, lastMessageId);
					eventEmitter.emit("UpdateSiegeMessageKnight");
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}

	});

	client.on("guildMemberUpdate", async (oldMember, newMember) => {
		const hadRoleBeforeKing = oldMember.roles.cache.has(
			process.env.ROLEID_KING
		);
		const hasRoleNowKing = newMember.roles.cache.has(
			process.env.ROLEID_KING
		);
		const hadRoleBeforeKnight = oldMember.roles.cache.has(
			process.env.ROLEID_KNIGHT
		);
		const hasRoleNowKnight = newMember.roles.cache.has(
			process.env.ROLEID_KNIGHT
		);

		if (gameState.isSiegeActive() && hadRoleBeforeKing) {
			if (newMember.id === gameState.getSiegeInitiatorId()) {
				const message = "The siege has ceased as the role of the initiator has been changed.";
				gameState.clearSiegeTimeout();
				await resetSiege(client, lastMessageId);
				await NotifyKingChannel(client, message);
				eventEmitter.emit("siegeResult", message);
			} else if (newMember.id === gameState.getSiegeTargetId()) {
				const message = "The siege has ceased as the role of the target has been changed.";
				gameState.clearSiegeTimeout();
				await resetSiege(client, lastMessageId);
				await NotifyKingChannel(client, message);
				eventEmitter.emit("siegeResult", message);
			}
		}	

		if (oldMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
			oldMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
			oldMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
			oldMember.roles.cache.has(process.env.ROLEID_NOBLE) ||
			hadRoleBeforeKnight ||
			oldMember.roles.cache.has(process.env.ROLEID_LORD) ||
			newMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
			newMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
			newMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
			newMember.roles.cache.has(process.env.ROLEID_NOBLE) ||
			newMember.roles.cache.has(process.env.ROLEID_LORD) ||
			hasRoleNowKnight) {
			for(let userId in selectedWritHumans){
				if(selectedWritHumans[userId] && selectedWritHumans[userId].id === oldMember.id){
					selectedWritHumans[userId] = null;
				}
			}
			await updateMessage(client, lastMessageId);
		}
		if(hadRoleBeforeKnight){
			for(let userId in selectedKnights){
				if(selectedKnights[userId] && selectedKnights[userId].id == oldMember.id){
					selectedKnights[userId] = null;
				}
			}
		}
		if (gameState.isSiegeActive() && hadRoleBeforeKnight) {
			if (gameState.isSiegeParticipant(newMember.id)) {
				try {
					gameState.removeSiegeParticipant(newMember.id);
				} catch (err) {
					showErrorMsg(err);
				}
			}
		}

		if (
			 gameState.isSiegeActive() &&
			(hadRoleBeforeKnight ||
				hasRoleNowKnight ||
				hadRoleBeforeKing ||
				hasRoleNowKing)
		) {
				try {

					if (gameState.isSiegeActive()) {
						const siegeParticipantsSize = gameState.getSiegeParticipantsSize();
						const siegeRatio = gameState.getRoleSize("Knight") / gameState.getRoleSize("King");
						const siegeSuccess =
							siegeParticipantsSize >= siegeRatio;
						if (siegeSuccess) {
							await ceaseSiege(client, lastMessageId);
							return;
						} else {
							await updateMessage(client, lastMessageId);
							eventEmitter.emit("UpdateSiegeMessageKnight");
						}
					}
				} catch (err) {
					showErrorMsg(err);
				}
		}
		if (
			!gameState.isSiegeActive() &&
			(hadRoleBeforeKnight ||
				hasRoleNowKnight ||
				hadRoleBeforeKing ||
				hasRoleNowKing)){
			try{
				await updateMessage(client, lastMessageId);
			}catch(err){
				showErrorMsg(err);
			}
		}


	});
	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return;
		const userId=interaction.user.id;

		if (interaction.customId === "SelectWritHuman") {
			let selectedUserId = interaction.values[0];
			try {
				await interaction.deferUpdate();
				selectedWritHumans[userId] = await interaction.guild.members.fetch(selectedUserId);
			} catch (err) {
				showErrorMsg(err);
			}
		}


		if (interaction.customId === "RoyalWrit") {
			try {

				if (!selectedWritHumans[userId] || !selectedKnights[userId]){
					await sendInteractionReply(interaction, "No knight or target selected.");
					return;
				}
				const cooldown = await CacheGetCooldown("RoyalWrit", userId);
				if (cooldown){
					await sendInteractionReply(interaction, "Royal Writ is on cooldown and cannot be used.");
					return;
				}
				if (selectedWritHumans[userId].id === selectedKnights[userId].id) {
					await sendInteractionReply(interaction, "You cannot target the same person as both knight and target.");
					return;
				}else {
					const modal = buildRoyalWritModal();
					await interaction.showModal(modal);
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "RoyalWritModal"){
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
				await CacheSetWrit(3, userId, selectedKnights[userId].id, selectedWritHumans[userId].id, 0, writMessage, writAmount);
				await DBUpdateXP(userId, -writAmount, client);
				await CacheSetCooldown("highWrit", userId, RoyalWritCooldown);
				await sendInteractionReply(interaction, `Royal Writ of execution succesfully emitted! (drops left: ${userXP - writAmount})`);
			}catch(err){
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "ShowWrits") {
			await handleShowWrits(interaction);
		}

		if (interaction.customId === "SelectDegradation") {
			let selectedKnightId = interaction.values[0];
			selectedKnights[userId] = await interaction.guild.members.fetch(
				selectedKnightId
			);
			await interaction.deferUpdate();
		}
		if (interaction.customId === "SelectKnight") {
			let selectedKnightId = interaction.values[0];
			selectedHumans[userId] = await interaction.guild.members.fetch(
				selectedKnightId
			);
			await interaction.deferUpdate();
		}
		if (interaction.customId === "SelectKing") {
			try {
				let selectedKingId = interaction.values[0];
				selectedKings[userId] = await interaction.guild.members.fetch(
					selectedKingId
				);
				await interaction.deferUpdate();
			} catch (error) {
				showErrorMsg(error);
			}
		}

		if (interaction.customId === "DegradationKnight") {
			try {
				if (!selectedKnights[userId]) {
					await sendInteractionReply(interaction, `No knight selected`);
					return;
				}
				const userXP = await CacheGetUserXP(userId);
				if (userXP < DegradationCost) {
					await sendInteractionReply(
						interaction,
						`Not enough drops (current drops: ${userXP})`
					);
					return;
				} else {
					const cooldown = await CacheGetCooldown("degradationKnight", userId);
					if (cooldown) {
						await sendInteractionReply(
							interaction,
							"Degradation is on cooldown and cannot be used"
						);
						return;
					} else {
						await changeRole(
							selectedKnights[userId],
							"Merchant",
							false
						);
						const targetId = selectedKnights[userId].id;
						selectedKnights[userId] = null;
						await DBUpdateXP(userId, -DegradationCost, client);
						await CacheSetCooldown(
							"degradationKnight",
							userId,
							DegradationCooldown
						);
						const XPLeft = parseInt(userXP) - parseInt(DegradationCost);
						await sendInteractionReply(
							interaction,
							`(${XPLeft} drops left) Degradation  successful. \n<@${targetId}> has been reduced to merchant`
						);
						await messageChannel(clinet, process.env.CHANNELID_MARKET,`Knight <@${targetId}> is now a dropless merchant.`);
						await messageChannel(clinet, process.env.CHANNELID_BARRACKS,`Knight <@${targetId}> lost his rank, degraded by King <@${userId}>.`);
					}
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "Knight") {
			try {
				if (!selectedHumans[userId]) {
					await sendInteractionReply(
						interaction,
						`no peasant, scholar or merchant selected...`
					);
					return;
				}
				const userXP = await CacheGetUserXP(userId);
				if (userXP < KnightCost) {
					await sendInteractionReply(
						interaction,
						`Not enough drops (current drops: ${userXP})`
					);
					return;
				} else {
					const cooldown = await CacheGetCooldown("knight", userId);
					if (cooldown) {
						await sendInteractionReply(
							interaction,
							"Knight is on cooldown and cannot be used"
						);
						return;
					} else {
						eventEmitter.emit("changeRole", selectedHumans[userId],"Knight",true);
						const targetId = selectedHumans[userId].id;
						selectedHumans[userId] = null;
						await DBUpdateXP(userId, -KnightCost, client);
						await CacheSetCooldown("knight", userId, KnightCooldown);
						const XPLeft = parseInt(userXP) - parseInt(KnightCost);
						await sendInteractionReply(
							interaction,
							`(${XPLeft} drops left) ${targetId} has been knighted`
						);
						await messageAllHumanChannels(clinet, `<@${targetId}> has been knighted by King <@${userId}>, may his servile fashion guide his cuts.`);
					}
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "Siege") {
			try {
				if(gameState.getDisableSiege()) {
					await sendInteractionReply(interaction, "Siege is disabled, not enough knights to siege a king");
					return;
				}
				if(gameState.isSiegeActive()) {
					await sendInteractionReply(interaction, "Another siege is underway, attacks amidst ongoing turmoil are of stagnant character.");
					return;
				}
				if (!selectedKings[userId]) {
					await sendInteractionReply(interaction, "No king selected");
					return;
				}

				const userXP = await CacheGetUserXP(userId);
				if (userXP < SiegeCost) {
					await sendInteractionReply(
						interaction,
						`Not enough drops (drops: ${userXP})`
					);
					return;
				}
				if (selectedKings[userId].user.id === userId) {
					await sendInteractionReply(
						interaction,
						"You cannot target yourself."
					);
					return;
				}

				const cooldown = await CacheGetCooldown("Siege", userId);
				if (cooldown) {
					await sendInteractionReply(interaction, "Siege is on cooldown");
					return;
				}
				await startSiege(interaction.member, selectedKings[userId], client, lastMessageId);

				await sendInteractionReply(
					interaction,
					"Siege initiated, waiting for knights to join your siege."
				);
			} catch (err) {
				showErrorMsg(err);
			}
		}
	});


	
	eventEmitter.on(
		"FirstEnthronementComplete",
		async (emperorId) => {
			try {
				const channel = await client.channels.fetch(process.env.CHANNELIDKING);
				const tmpMessage = await channel.send(
					`Hail our first Emperor! <@${emperorId}> The Progenitor, has taken the throne.`
				);
				setTimeout(() => {
					tmpMessage.delete().catch(showErrorMsg);
				}, 30000);
			} catch (err) {
				showErrorMsg(err);
			}
		}
	);
	eventEmitter.on("SiegeFinished", async () => {
		try {
			if (!gameState.isSiegeActive()) {
				return;
			}
			const siegeRatio = gameState.getRoleSize("Knight") / gameState.getRoleSizeSize("King");
			const siegeParticipantsSize = gameState.getSiegeParticipantsSize();
			console.log(`Siege participants: ${siegeParticipantsSize} Needed for success: ${siegeRatio}`);	
			const success = siegeParticipantsSize >= siegeRatio;
			let message = "";
			siegeInitiator = gameState.getSiegeInitiator();
			siegeTarget = gameState.getSiegeTarget();

			if (success) {
				await changeRole(
					selectedKings[siegeInitiator.id],
					"Poop",
					false
				);
				message =
					`<@${siegeInitiator.id}>'s siege upon <@${siegeTarget.user.id}>'s domain ended in victory. Heaven's favor shimmers above as
					<@${siegeTarget.user.id}> falls to the sewers.`;
			} else {
				message = `<@${siegeInitiator.id}>'s siege upon <@${siegeTarget.user.id}>'s domain has failed. Such folly does not go unnoticed as it ripples through the stream...`;
					
			}
			await NotifyKingChannel(client, message);
			gameState.clearSiegeTimeout();
			await resetSiege(client, lastMessageId);
			eventEmitter.emit("siegeResult", message);
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on(
		"KnightParticipatedOnSiege",
		async (userId) => {
			try {	
				gameState.addSiegeParticipant(userId);
				const siegeParticipantSize = gameState.getSiegeParticipantsSize();
				const knightsSize = gameState.getRoleSize("Knight");
				const kingsSize = gameState.getRoleSize("King");
				const siegeSuccess = siegeParticipantSize >= knightsSize / kingsSize;
				if (siegeSuccess) {
					await ceaseSiege(client, lastMessageId);
					return;
				} else {
					await updateMessage(client, lastMessageId);
					eventEmitter.emit("UpdateSiegeMessageKnight");
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
	);

	eventEmitter.on("NotifyKingChannel", async (content) => {
		try {
			let channel = await client.channels.fetch(process.env.CHANNELIDKING);
			const message = await channel.send({
				content,
			});
			setTimeout(async () => {
				await message.delete().catch(console.error);
			}, RoleChangeMessageDisplayTime);
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("UpdateKingMessageIfNoSiegeOngoing", async () => {
		try {
			if (!gameState.isSiegeActive()) await updateMessage(client, lastMessageId);
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("ServerStatusChange", async () => {
		try{
			await updateMessage(client, lastMessageId);
		}catch(err){
			showErrorMsg(err);
		}
	});
}
function buildRoyalWritModal(){
	const modal = new ModalBuilder()
		.setCustomId('RoyalWritModal')
		.setTitle('Royal Writ of Execution');

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
		const channel = await client.channels.fetch(process.env.CHANNELIDKING);
		const messageToEdit = await channel.messages.fetch(lastMessageId);
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";
		if (!gameState.isSiegeActive()) {
			const degradationSelectMenu = new ActionRowBuilder().addComponents(
				await buildSelectMenu(client, ["knight"], "SelectDegradation", TextDegradationRoyalWritSelectMenu)
			);
			const knightSelectMenu = new ActionRowBuilder().addComponents(
				await buildSelectMenu(
					client,
					["peasant", "scholar", "merchant"],
					"SelectKnight", TextKnightSelectMenu
				)
			);
			const kingSelectMenu = new ActionRowBuilder().addComponents(
				await buildSelectMenu(client, ["king"], "SelectKing", TextSiegeKingSelectMenu)
			);
			const actionRow_3 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(
					client, ["peasant", "scholar", "merchant","noble",
						"knight","lord"], "SelectWritHuman",TextRoyalWritTargetSelectMenu
				));
			const btnRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("DegradationKnight")
				.setLabel(ButtonLabelDegradation)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("Knight")
				.setLabel(ButtonLabelKnight)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("Siege")
				.setLabel(ButtonLabelSiege)
				.setStyle(ButtonStyle.Danger)
				.setDisabled(gameState.getDisableSiege() || gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("RoyalWrit")
				.setLabel(ButtonLabelRoyalWrit)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("ShowWrits")
				.setLabel(ButtonLabelShowWrits)
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(gameState.isServerDown())
			);
			await messageToEdit.edit({
				content:serverText+"\n"+ initContent,
				components: [
					degradationSelectMenu,
					knightSelectMenu,
					kingSelectMenu,
					actionRow_3,
					btnRow,
				],
			});
		} else {

			const degradationSelectMenu = new ActionRowBuilder().addComponents(
				await buildSelectMenu(client, ["knight"], "SelectDegradation", TextDegradationRoyalWritSelectMenu)
			);
			const knightSelectMenu = new ActionRowBuilder().addComponents(
				await buildSelectMenu(
					client,
					["peasant", "scholar", "merchant"],
					"SelectKnight", TextKnightSelectMenu
				)
			);
			const actionRow_2 = ActionRowBuilder.from(
				messageToEdit.components[2].toJSON()
			);
			const actionRow_3 = new ActionRowBuilder()
				.addComponents(await buildSelectMenu(
					client, ["peasant", "scholar", "merchant","noble",
						"knight","lord"], "SelectWritHuman", TextRoyalWritTargetSelectMenu
				));
			const kingSelectMenu = StringSelectMenuBuilder.from(
				actionRow_2.components[0].toJSON()
			)
				.setDisabled(true)
				.setPlaceholder(gameState.getSiegeTargetUsername());
			actionRow_2.components[0] = kingSelectMenu;
			const btnRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("DegradationKnight")
				.setLabel(ButtonLabelDegradation)
				.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
				.setCustomId("Knight")
				.setLabel(ButtonLabelKnight)
				.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
				.setCustomId("Siege")
				.setLabel(ButtonLabelSiege)
				.setStyle(ButtonStyle.Danger)
				.setDisabled(true),
				new ButtonBuilder()
				.setCustomId("RoyalWrit")
				.setLabel(ButtonLabelRoyalWrit)
				.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
				.setCustomId("ShowWrits")
				.setLabel(ButtonLabelShowWrits)
				.setStyle(ButtonStyle.Secondary)
			);
			let content = "";
			const siegeInitiatorId = gameState.getSiegeInitiatorId();
			const siegeTargetId = gameState.getSiegeTargetId();
			const siegeParticipantsSize = gameState.getSiegeParticipantsSize();
			const knightsSize = gameState.getRoleSize("Knight");
			if (knightsSize > 0) {
				content =
					initContent +
					`\nKing <@${siegeInitiatorId}> initiated a siege against King <@${siegeTargetId}>'s domain. (Joined ${siegeParticipantsSize} / ${knightsSize})`;
			} else {
				content =
					initContent +
					`\nKing <@${siegeInitiatorId}> initiated a siege to downgrade <@${siegeTargetId}>.`;
			}

			await messageToEdit.edit({
				content,
				components: [degradationSelectMenu, knightSelectMenu, actionRow_2, actionRow_3, btnRow],
			});
		}
	} catch (err) {
		showErrorMsg(err);
	}
}
async function NotifyKingChannel(client, content){
	try {
		let channel = await client.channels.fetch(process.env.CHANNELIDKING);
		const message = await channel.send({
			content,
		});
		setTimeout(async () => {
			await message.delete().catch(console.error);
		}, RoleChangeMessageDisplayTime);
	} catch (err) {
		showErrorMsg(err);
	}
}
async function messageKingCommands(client) {
	let channel = null;
	try {
		channel = await client.channels.fetch(process.env.CHANNELIDKING);
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";
		const degradationSelectMenu = new ActionRowBuilder().addComponents(
			await buildSelectMenu(client, ["knight"], "SelectDegradation", TextDegradationRoyalWritSelectMenu)
		);
		const knightSelectMenu = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				["peasant", "scholar", "merchant"],
				"SelectKnight", TextKnightSelectMenu
			)
		);
		const kingSelectMenu = new ActionRowBuilder().addComponents(
			await buildSelectMenu(client, ["king"], "SelectKing", TextSiegeKingSelectMenu)
		);
		const actionRow_3 = new ActionRowBuilder()
			.addComponents(await buildSelectMenu(
				client, ["peasant", "scholar", "merchant","noble",
					"knight","lord"], "SelectWritHuman",TextRoyalWritTargetSelectMenu
			));
		
		
		const btnRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("DegradationKnight")
			.setLabel(ButtonLabelDegradation)
			.setStyle(ButtonStyle.Primary)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("Knight")
			.setLabel(ButtonLabelKnight)
			.setStyle(ButtonStyle.Primary)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("Siege")
			.setLabel(ButtonLabelSiege)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.getDisableSiege() || gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("RoyalWrit")
			.setLabel(ButtonLabelRoyalWrit)
			.setStyle(ButtonStyle.Primary)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("ShowWrits")
			.setLabel(ButtonLabelShowWrits)
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(gameState.isServerDown())

		);
		return await channel.send({
			content: serverText+'\n'+initContent,
			components: [
				degradationSelectMenu,
				knightSelectMenu,
				kingSelectMenu,
				actionRow_3,
				btnRow
			],
		});
	} catch (err) {
		showErrorMsg(err);
	}
}
async function startSiege(siegeInitiator, siegeTarget, client, lastMessageId) {
	 
	gameState.setSiegeTarget(siegeTarget);
	gameState.setSiegeInitiator(siegeInitiator);
	gameState.setSiegeActive(true);
	await updateMessage(client, lastMessageId);
	const siegeTimeout = setTimeout(async () => {
		await handleSiegeEnd(client, lastMessageId);
	}, SiegeTime);
	gameState.setSiegeTimeout(siegeTimeout);
	eventEmitter.emit("siegeStarted");
	messageChannel(clinet, process.env.CHANNELID_BARRACKS,`King <@${siegeInitiator.id}> has launched a siege of King <@${siegeTarget.id}>'s fortress. Knights may join to canonize the siege.`);
	messageChannel(clinet, process.env.CHANNELID_ROYAL_CASTLE,`King <@${siegeInitiator.id}> has launched a siege of King <@${siegeTarget.id}>'s fortress. Will swords gather to reflect A God Upon Another or the folly drowned below?`);

}

async function handleSiegeEnd(client, lastMessageId) {
	try {
			if (!gameState.isSiegeActive()) {
				return;
			}
			const siegeRatio = gameState.getRoleSize("Knight") / gameState.getRoleSize("King");
			const siegeParticipantsSize = gameState.getSiegeParticipantsSize();
			const success = siegeParticipantsSize >= siegeRatio;
			let message = "";
			const siegeInitiatorId = gameState.getSiegeInitiatorId();
			const targetMember = selectedKings[siegeInitiatorId];
			const siegeTargetId = gameState.getSiegeTargetId();
			await resetSiege(client, lastMessageId);
			if (success) {
				await changeRole(
					targetMember,
					"Poop",
					false
				);
				message =
					`King <@${siegeInitiatorId}>'s siege upon King <@${siegeTargetId}>'s domain ended in victory. Heaven's favor shimmers above as <@${siegeTargetId}> falls to the sewers.`;
			} else {
				message =
					`King <@${siegeTargetId}> fortress was steadfast against King  <@${siegeInitiatorId}>'s siege. Such folly does not go unnoticed as it ripples through the stream.`;
			}
			await messageAllHumanChannels(client, message);
			eventEmitter.emit("siegeResult");
	} catch (err) {
		showErrorMsg(err);
	}
}

async function ceaseSiege(client, lastMessageId) {
	const siegeTimeout = gameState.getSiegeTimeout();
	if (siegeTimeout) gameState.clearSiegeTimeout();
	await handleSiegeEnd(client, lastMessageId);

}
async function resetSiege(client, lastMessageId) {
	try {
		gameState.setSiegeActive(false);
		selectedHumans = {};
		selectedKnights = {};
		selectedKings = {};
		gameState.setSiegeInitiator(null);
		gameState.setSiegeTarget(null);
		gameState.clearSiegeParticipants();
		gameState.removeSiegeTimeout();
		await updateMessage(client, lastMessageId);
	} catch (err) {
		throw err;
	}
}

module.exports = { setupKingBotEvents, messageKingCommands };
