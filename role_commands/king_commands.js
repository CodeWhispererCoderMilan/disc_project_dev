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
	SiegeCoolDown,
	SiegeCost,
	RoleChangeMessageDisplayTime,
	RoyalWritCost,
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
	MinimumKingSize,
	MinimumKnightToKingSiegeRatio
} = require("../game_config.json");
const { eventEmitter } = require("../functions/eventEmitter.js");
const { DBUpdateXP, isThresholdOpen } = require("../apis/firebase/querys");

let selectedHumans = {};
let selectedKnights = {};
let selectedKings = {};
let kings = [];
let kingSize = 0;
let knights = [];
let numberOfKnights = 0;
let knightsSize = 0;
let siegeParticipantsSize = 0;
let siegeInitiatorId = null;
let siegeInitiator = null;
let siegeTargetId = null;
let siegeTarget = null;
let siegeActive = false;
let disableSiege = true;
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
	
		if (siegeActive && hadRoleBeforeKing) {
			if (member.id === siegeInitiatorId) {
				const message = "The role of the initiator has been changed.";
				eventEmitter.emit("NotifyKingChannel", message);
				eventEmitter.emit("siegeResult", message, "early");
				await resetComponents(client, lastMessageId);
			} else if (member.id === siegeTargetId) {
				const message = "The role of the target has been changed.";
				eventEmitter.emit("NotifyKingChannel", message);
				eventEmitter.emit("siegeResult", message, "early");
				await resetComponents(client, lastMessageId);
			}
		}	

		if( hadRoleBeforeKing || hadRoleBeforeKnight ){
			try{
				if(hadRoleBeforeKing ){
					const guild = await client.guilds.fetch(process.env.GUILDID);
					kings = guild.members.cache.filter((member) =>
						member.roles.cache.has(process.env.ROLEID_KINGS)
					);
					kingSize = kings.size;
					eventEmitter.emit("UpdateKingSize", kingSize, member);
					if(kingSize < MinimumKingSize && !isThresholdOpen(11)){
						eventEmitter.emit("OpenXpThresholdKing");
					}

				}
				if(hadRoleBeforeKnight ){
					const guild = await client.guilds.fetch(process.env.GUILDID);
					knights = guild.members.cache.filter((member) =>
						member.roles.cache.has(process.env.ROLEID_KNIGHT)
					);
					numberOfKnights = knights.size;
				}	
				if(numberOfKnights/kingSize > MinimumKnightToKingSiegeRatio && disableSiege === true){
					disableSiege = false;
				}
				if(numberOfKnights/kingSize < MinimumKnightToKingSiegeRatio && disableSiege === false){
					disableSiege = true;
				}
				if(!siegeActive && (hadRoleBeforeKing)) 
					await updateMessage(client, lastMessageId);
			}catch(err){
				showErrorMsg(err);
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
			await updateMessage(client, lastMessageId);
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

		if (siegeActive && hadRoleBeforeKing) {
			if (newMember.id === siegeInitiatorId) {
				const message = "The role of the initiator has been changed.";
				eventEmitter.emit("NotifyKingChannel", message);
				eventEmitter.emit("siegeResult", message, "early");
				await resetComponents(client, lastMessageId);
			} else if (newMember.id === siegeTargetId) {
				const message = "The role of the target has been changed.";
				eventEmitter.emit("NotifyKingChannel", message);
				eventEmitter.emit("siegeResult", message, "early");
				await resetComponents(client, lastMessageId);
			}
		}	

		if( hadRoleBeforeKing || hasRoleNowKing || hadRoleBeforeKnight || hasRoleNowKnight){
			try{
				if(hadRoleBeforeKing || hasRoleNowKing){
					const guild = await client.guilds.fetch(process.env.GUILDID);
					kings = guild.members.cache.filter((member) =>
						member.roles.cache.has(process.env.ROLEID_KINGS)
					);
					kingSize = kings.size;
					eventEmitter.emit("UpdateKingSize", kingSize, newMember);
					if(kingSize < MinimumKingSize && !isThresholdOpen(11)){
						eventEmitter.emit("OpenXpThresholdKing");
					}
					if(kingSize > MinimumKingSize && isThresholdOpen(11)){
						eventEmitter.emit("CloseXpThresholdKnight");
					}
				}
				if(hadRoleBeforeKnight || hasRoleNowKnight){
					const guild = await client.guilds.fetch(process.env.GUILDID);
					knights = guild.members.cache.filter((member) =>
						member.roles.cache.has(process.env.ROLEID_KNIGHT)
					);
					numberOfKnights = knights.size;
				}	
				if(numberOfKnights/kingSize > MinimumKnightToKingSiegeRatio && disableSiege === true){
					disableSiege = false;
				}
				if(numberOfKnights/kingSize < MinimumKnightToKingSiegeRatio && disableSiege === false){
					disableSiege = true;
				}
				if(!siegeActive && (hasRoleNowKing || hadRoleBeforeKing)) 
					await updateMessage(client, lastMessageId);
			}catch(err){
				showErrorMsg(err);
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
			if(hadRoleBeforeKnight){
				for(let userId in selectedKnights){
					if(selectedKnights[userId] && selectedKnights[userId].id == oldMember.id){
						selectedKnights[userId] = null;
					}
				}
			}
			await updateMessage(client, lastMessageId);
		}

	});
	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return;
		const userId=interaction.user.id;

		if (interaction.customId === "SelectWritHuman") {
			let selectedUserId = interaction.values[0];
			try {
				await interaction.deferUpdate();
				selectedWritHumans[userId] = await interaction.guild.members.cache.get(selectedUserId);
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
				const userXP = await CacheGetUserXP(userId);
				if (userXP < RoyalWritCost) {
					await sendInteractionReply(interaction, `Not enough XP (current XP: ${userXP})`)
				} else {
					const cooldown = await CacheGetCooldown("RoyalWrit", userId);
					if (cooldown)
						await sendInteractionReply(interaction, "Royal Writ is on cooldown and cannot be used.");
					else {
						const modal = buildRoyalWritModal();
						await interaction.showModal(modal);
					}
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "RoyalWritModal"){
			try{
				const writMessage = interaction.fields.getTextInputValue('messageToKnight');
				await CacheSetWrit(3, userId, selectedKnights[userId].id, selectedWritHumans[userId].id, 0, writMessage);
				const userXP = await CacheGetUserXP(userId);
				await DBUpdateXP(userId, RoyalWritCost, client);
				await CacheSetCooldown("highWrit", userId, RoyalWritCooldown);
				await sendInteractionReply(interaction, `Royal Writ of execution succesfully emitted! (XP left: ${userXP - RoyalWritCost})`);
			}catch(err){
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "ShowWrits") {
			await handleShowWrits(interaction);
		}

		if (interaction.customId === "SelectDegradation") {
			let selectedKnightId = interaction.values[0];
			selectedKnights[userId] = await interaction.guild.members.cache.get(
				selectedKnightId
			);
			await interaction.deferUpdate();
		}
		if (interaction.customId === "SelectKnight") {
			let selectedKnightId = interaction.values[0];
			selectedHumans[userId] = await interaction.guild.members.cache.get(
				selectedKnightId
			);
			await interaction.deferUpdate();
		}
		if (interaction.customId === "SelectKing") {
			try {
				let selectedKingId = interaction.values[0];
				selectedKings[userId] = await interaction.guild.members.cache.get(
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
						`Not enough XP (current XP: ${userXP})`
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
						eventEmitter.emit(
							"changeRole",
							selectedKnights[userId],
							"Merchant",
							false
						);
						const targetUsername = selectedKnights[userId].user.username;
						selectedKnights[userId] = null;
						await DBUpdateXP(userId, -DegradationCost, client);
						await CacheSetCooldown(
							"degradationKnight",
							userId,
							DegradationCooldown
						);
						eventEmitter.emit(
							"DegradationComplete",
							targetUsername,
							interaction.user.username
						);
						const XPLeft = parseInt(userXP) - parseInt(DegradationCost);
						await sendInteractionReply(
							interaction,
							`(${XPLeft} XP left) Degradation  successful. \n${targetUsername} has been reduced to merchant`
						);
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
						`Not enough XP (current XP: ${userXP})`
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
						const targetUsername = selectedHumans[userId].user.username;
						selectedHumans[userId] = null;
						await DBUpdateXP(userId, -KnightCost, client);
						await CacheSetCooldown("knight", userId, KnightCooldown);
						eventEmitter.emit(
							"KnightComplete",
							targetUsername,
							interaction.user.username
						);
						const XPLeft = parseInt(userXP) - parseInt(KnightCost);
						await sendInteractionReply(
							interaction,
							`(${XPLeft} XP left) ${targetUsername} has been knighted`
						);
					}
				}
			} catch (err) {
				showErrorMsg(err);
			}
		}
		if (interaction.customId === "Siege") {
			try {
				if (!selectedKings[userId]) {
					await sendInteractionReply(interaction, "No king selected");
					return;
				}

				const userXP = await CacheGetUserXP(userId);
				if (userXP < SiegeCost) {
					await sendInteractionReply(
						interaction,
						`Not enough XP (current XP: ${userXP})`
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

				siegeInitiatorId = userId;
				siegeInitiator = interaction.user.username;
				siegeActive = true;
				siegeTarget = selectedKings[userId].user.username;
				siegeTargetId = selectedKings[userId].user.id;

				if (lastMessageId) {
					// Set cooldown
					await CacheSetCooldown("Siege", userId, SiegeCoolDown);
					updateMessage(client, lastMessageId);
				}

				eventEmitter.emit("siegeStarted", siegeInitiator, siegeTarget);
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
		"coronationComplete",
		async (kingUsername, initiatorUsername) => {
			try {
				const channel = await client.channels.fetch(process.env.CHANNELIDKING);
				const tmpMessage = await channel.send(
					`Coronation successfully! ${kingUsername} has become a king by ${initiatorUsername}.`
				);
				setTimeout(() => {
					tmpMessage.delete().catch(showErrorMsg);
				}, 30000);
			} catch (err) {
				showErrorMsg(err);
			}
		}
	);
	eventEmitter.on(
		"heirSuccessionComplete",
		async (heirUsername, initiatorUsername) => {
			try {
				const channel = await client.channels.fetch(process.env.CHANNELIDKING);
				const tmpMessage = await channel.send(
					`Hail the new Emperor! ${heirUsername} heir to ${initiatorUsername} has taken the throne,`
				);
				setTimeout(() => {
					tmpMessage.delete().catch(showErrorMsg);
				}, 30000);
			} catch (err) {
				showErrorMsg(err);
			}
		}
	);
	eventEmitter.on(
		"FirstEnthronementComplete",
		async (emperorUsername) => {
			try {
				const channel = await client.channels.fetch(process.env.CHANNELIDKING);
				const tmpMessage = await channel.send(
					`Hail our first Emperor! ${emperorUsername} The Progenitor, has taken the throne.`
				);
				setTimeout(() => {
					tmpMessage.delete().catch(showErrorMsg);
				}, 30000);
			} catch (err) {
				showErrorMsg(err);
			}
		}
	);
	eventEmitter.on("SiegeFinished", async (siegeParticipants, knights) => {
		try {
			const success = siegeParticipants >= knights / kingSize;
			let message = "";
			if (success) {
				eventEmitter.emit(
					"changeRole",
					selectedKings[siegeInitiatorId],
					"Poop",
					false
				);
				message =
					"Siege succeded! " +
					siegeTarget +
					" has become a poop by " +
					siegeInitiator +
					".";
			} else {
				message =
					"Siege on " +
					siegeTarget +
					" initiated by " +
					siegeInitiator +
					" has been failed.";
			}
			if (siegeActive) {
				eventEmitter.emit("NotifyKingChannel", message);
				eventEmitter.emit("siegeResult", message, "normal");
			}

			await resetComponents(client, lastMessageId);
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on(
		"KnightParticipatedOnSiege",
		async (siegeParticipants, knights) => {
			try {
				siegeParticipantsSize = siegeParticipants;
				knightsSize = knights;
				await updateMessage(client, lastMessageId);
			} catch (err) {
				showErrorMsg(err);
			}
		}
	);
	eventEmitter.on("SiegeInitiatorRoleChanged", async () => {
		try {
			const message = "The role of the initiator has been changed.";
			eventEmitter.emit("siegeResult", message, "early");
			eventEmitter.emit("NotifyKingChannel", message);

			await resetComponents(client, lastMessageId);
		} catch (err) {
			showErrorMsg(err);
		}
	});
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
		const channel = await client.channels.fetch(process.env.CHANNELIDKING);
		const messageToEdit = await channel.messages.fetch(lastMessageId);

		if (!siegeActive) {
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
				.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
				.setCustomId("Knight")
				.setLabel(ButtonLabelKnight)
				.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
				.setCustomId("Siege")
				.setLabel(ButtonLabelSiege)
				.setStyle(ButtonStyle.Danger)
				.setDisabled(disableSiege),
				new ButtonBuilder()
				.setCustomId("RoyalWrit")
				.setLabel(ButtonLabelRoyalWrit)
				.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
				.setCustomId("ShowWrits")
				.setLabel(ButtonLabelShowWrits)
				.setStyle(ButtonStyle.Secondary)
			);
			await messageToEdit.edit({
				content: initContent,
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
				.setPlaceholder(siegeTarget);
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
			if (knightsSize > 0) {
				content =
					initContent +
					`\n@${siegeInitiator} initiated a siege to downgrade ${siegeTarget}. (Joined ${siegeParticipantsSize} / ${knightsSize})`;
			} else {
				content =
					initContent +
					`\n@${siegeInitiator} initiated a siege to downgrade ${siegeTarget}.`;
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

async function messageKingCommands(client) {
	let channel = null;
	try {
		channel = await client.channels.fetch(process.env.CHANNELIDKING);
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
			.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
			.setCustomId("Knight")
			.setLabel(ButtonLabelKnight)
			.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
			.setCustomId("Siege")
			.setLabel(ButtonLabelSiege)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disableSiege),
			new ButtonBuilder()
			.setCustomId("RoyalWrit")
			.setLabel(ButtonLabelRoyalWrit)
			.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
			.setCustomId("ShowWrits")
			.setLabel(ButtonLabelShowWrits)
			.setStyle(ButtonStyle.Secondary)

		);
		return await channel.send({
			content: initContent,
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

async function resetComponents(client, lastMessageId) {
	try {
		siegeActive = false;
		selectedHumans = {};
		selectedKnights = {};
		selectedKings = {};
		siegeInitiator = "";
		siegeTarget = "";
		siegeParticipantsSize = 0;
		knightsSize = 0;
		await updateMessage(client, lastMessageId);
	} catch (err) {
		throw err;
	}
}

module.exports = { setupKingBotEvents, messageKingCommands };
