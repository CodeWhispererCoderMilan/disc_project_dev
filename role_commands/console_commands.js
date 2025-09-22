const { eventEmitter } = require("../functions/eventEmitter.js");

const{
	SlashCommandBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	SelectMenuBuilder,
	StringSelectMenuBuilder
} = require("discord.js");

const {
	checkAndApplyMissedXPBoost,
	scheduledXpBoost,
	grantAstralRealmAccess,
	sendInteractionReply
} = require("../functions/botActions");
const {
	DBAddUser,
	DBRemoveUser,
	DBClearFestering,
	DBSetRole,
	DBResetXP,
	changeRole,
	openThreshold
} = require("../apis/firebase/querys.js");
const {
	CacheIsPoopBeingFestered,
	CacheGetFesteringTarget,
	CacheGetCooldown,
	CacheSetCooldown,
	CacheGetUserXP
} = require("../apis/redis/redisCache.js");
const {
	RevolutionFirstPhaseTime,
	RevolutionSecondPhaseTime,
	RevolutionKillKnight,
	RevolutionKillNoble,
	RevolutionKillLord,
	RevolutionKillKing,
	RevolutionKillEmperor,
	RevolutionEmperorElectionTime,
	RevolutionKnightWeight,
	RevolutionCooldown,
	CoupCooldown,
	CoupKillNoble,
	CoupKillLord,
	CoupKillKing,
	CoupKillEmperor,
	CoupFirstPhaseTime,
	CoupSecondPhaseTime,
	ScholarAstralRealmCooldown,
	EmperorAstralRealmCooldown,
	CheckXpCooldown,
	TextConsoleMessageContent,
	ButtonLabelCheckXP,
	ButtonLabelDivination,
	REVOLUTIONTHRESHOLD,
	REVOLUTIONTHRESHOLD2,
	COUPTHRESHOLD,
	MinimumHigherRoleSizeForRevolution,
	MinimumHigherRoleSizeForCoup,
	MinimumHigherRoleRatioForRevolution,
	MinimumHigherRoleRatioForCoup,
	MinimumKnightSizeForCoup
} = require("../game_config.json");

const gameState = require("../game_state.js");

const changeroleCommand = new SlashCommandBuilder()
	.setName("changerole")
	.setDescription("Force change a user's role")
	.addUserOption(opt => opt.setName("user").setDescription("Target user").setRequired(true))
	.addStringOption(opt => opt.setName("role").setDescription("New role name").setRequired(true))
	.addBooleanOption(opt => opt.setName("keep_xp").setDescription("Preserve XP (default false)"));




const content = TextConsoleMessageContent;

function showErrorMsg(err) {
	console.error("ERROR: console_commands.js", err);
}

async function setupConsoleBotEvents(client, lastMessageId) {
	
	handleHigherRoleSizeChange();

	eventEmitter.on("startXpBoost&RevolutonStates", async () => {
		const guild = await client.guilds.fetch(process.env.GUILDID);
		await guild.members.fetch();
		const peasants = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_PEASANT)
		);
		gameState.setRoleSize("Peasant", peasants.size);
		const scholars = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_SCHOLAR)
		);
		gameState.setRoleSize("Scholar", scholars.size);
		const merchants = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_MERCHANT)
		);
		gameState.setRoleSize("Merchant", merchants.size);
		const knights = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_KNIGHT)
		);
		gameState.setRoleSize("Knight", knights.size);
		const lords = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_LORD)
		);
		gameState.setRoleSize("Lord", lords.size);
		const kings = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_KING)
		);
		gameState.setRoleSize("King", kings.size);
		const nobles = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_NOBLE)
		);
		gameState.setRoleSize("Noble", nobles.size);
		const emperors = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_EMPEROR)
		);
		gameState.setRoleSize("Emperor", emperors.size);
		const peopleCount = guild.memberCount - 16;
		console.log(`Merchant count: ${merchants.size}`);
		console.log(`People count: ${peopleCount}\n HigherRoleRatio: ${gameState.getHigherRoleSize() / peopleCount}`);
		gameState.setPlayerCount(peopleCount);
		handleHigherRoleSizeChange();

		console.log(
			`Proceeding to update XP missed in downtime`
		);
		let timeUntilNextBoost = 0;
		try {
			timeUntilNextBoost = await checkAndApplyMissedXPBoost(client);
		} catch (err) {
			console.error(`DB: An error occured: ${err.message}`);
			throw err;
		}
		try {
			await scheduledXpBoost(timeUntilNextBoost, client);
		}catch (error) {
			console.error(`DB: An error occurred: ${err.message}`);
			throw err;
		}
	});
	client.application.commands.create(changeroleCommand, process.env.GUILDID);
	client.on("guildMemberUpdate", async (oldMember, newMember)=>{
		const hadRoleBeforePeasant = oldMember.roles.cache.has(
			process.env.ROLEID_PEASANT
		);
		const hasRoleNowPeasant = newMember.roles.cache.has(
			process.env.ROLEID_PEASANT
		);
		const hadRoleBeforeScholar = oldMember.roles.cache.has(
			process.env.ROLEID_SCHOLAR
		);
		const hasRoleNowScholar = newMember.roles.cache.has(
			process.env.ROLEID_SCHOLAR
		);	
		const hadRoleBeforeMerchant = oldMember.roles.cache.has(
			process.env.ROLEID_MERCHANT
		);
		const hasRoleNowMerchant = newMember.roles.cache.has(
			process.env.ROLEID_MERCHANT
		);
		const hadRoleBeforeKnight = oldMember.roles.cache.has(
			process.env.ROLEID_KNIGHT
		);
		const hasRoleNowKnight = newMember.roles.cache.has(
			process.env.ROLEID_KNIGHT
		);
		const hadRoleBeforePoop = oldMember.roles.cache.has(
			process.env.ROLEID_POOP
		);
		const hadRoleBeforeLord = oldMember.roles.cache.has(
			process.env.ROLEID_LORD
		);
		const hasRoleNowLord = newMember.roles.cache.has(
			process.env.ROLEID_LORD
		);
		const hadRoleBeforeKing = oldMember.roles.cache.has(
			process.env.ROLEID_KING
		);
		const hasRoleNowKing = newMember.roles.cache.has(
			process.env.ROLEID_KING
		);
		const hadRoleBeforeNoble = oldMember.roles.cache.has(
			process.env.ROLEID_NOBLE
		);
		const hasRoleNowNoble = newMember.roles.cache.has(
			process.env.ROLEID_NOBLE
		);
		const hadRoleBeforeEmperor = oldMember.roles.cache.has(
			process.env.ROLEID_EMPEROR
		);
		const hasRoleNowEmperor = newMember.roles.cache.has(
			process.env.ROLEID_EMPEROR
		);
		const hasRoleNowPoop = newMember.roles.cache.has(
			process.env.ROLEID_POOP
		);
		const hadRoleBeforeMaggot = oldMember.roles.cache.has(
			process.env.ROLEID_MAGGOT
		);
		const hasRoleNowMaggot = newMember.roles.cache.has(
			process.env.ROLEID_MAGGOT
		);
		const hadRoleBeforeRat = oldMember.roles.cache.has(
			process.env.ROLEID_RAT
		);
		const hasRoleNowRat = newMember.roles.cache.has(
			process.env.ROLEID_RAT
		);
		const hadRoleBeforeCockroach = oldMember.roles.cache.has(
			process.env.ROLEID_COCKROACH
		);
		const hasRoleNowCockroach = newMember.roles.cache.has(
			process.env.ROLEID_COCKROACH
		);
		const hadRoleBeforeSubhuman = oldMember.roles.cache.has(
			process.env.ROLEID_SUBHUMAN
		);
		const hasRoleNowSubhuman = newMember.roles.cache.has(
			process.env.ROLEID_SUBHUMAN
		);
		const guild = await client.guilds.fetch(process.env.GUILDID);
		await guild.members.fetch();
		const oldPeopleCount = gameState.getPlayerCount();
		const peopleCount = guild.memberCount - 16;
		console.log(`People count: ${peopleCount}`);
		let updatedRevolutionAndCoupMessages = false;
		gameState.setPlayerCount(peopleCount);
		
		const hadOrHasRevolutionRole = hadRoleBeforePeasant || hasRoleNowPeasant || hadRoleBeforeScholar || hasRoleNowScholar ||
			hadRoleBeforeMerchant || hasRoleNowMerchant || hadRoleBeforeKnight || hasRoleNowKnight ||
			hadRoleBeforeLord || hasRoleNowLord || hadRoleBeforeKing || hasRoleNowKing ||
			hadRoleBeforeNoble || hasRoleNowNoble || hadRoleBeforeEmperor || hasRoleNowEmperor;
		switch (hadOrHasRevolutionRole) {
			case hadRoleBeforePeasant || hasRoleNowPeasant:
				const peasants = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_PEASANT)
				);
				gameState.setRoleSize("Peasant", peasants.size);
				await handleHigherRoleSizeChange();
				if (hadRoleBeforePeasant && gameState.isRevolutionActive() 
					&& !gameState.isCoupActive()){
					const wasParticipant = gameState.removeRevolutionParticipant(newMember.id);
					if(wasParticipant){
						updateRevolutionAndCoupMessages();
						updatedRevolutionAndCoupMessages = true;
					}
				}
				break;
			case hadRoleBeforeScholar || hasRoleNowScholar: 
				const scholars = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_SCHOLAR)
				);
				gameState.setRoleSize("Scholar", scholars.size);
				handleHigherRoleSizeChange();
				if (hadRoleBeforeScholar && gameState.isRevolutionActive() &&
					!gameState.isCoupActive()){
					const wasParticipant = gameState.removeRevolutionParticipant(newMember.id);
					if(wasParticipant){
						updateRevolutionAndCoupMessages();
						updatedRevolutionAndCoupMessages = true;
					}				}
				break;
			case hadRoleBeforeMerchant || hasRoleNowMerchant:
				const merchants = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_MERCHANT)
				);
				gameState.setRoleSize("Merchant", merchants.size);
				handleHigherRoleSizeChange();
				if (hadRoleBeforeMerchant && gameState.isRevolutionActive() &&
					!gameState.isCoupActive()){
					const wasParticipant = gameState.removeRevolutionParticipant(newMember.id);
					if(wasParticipant){
						updateRevolutionAndCoupMessages();
						updatedRevolutionAndCoupMessages = true;
					}							}
				break;
			case hadRoleBeforeKnight || hasRoleNowKnight:
				const knights = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_KNIGHT)
				);
				gameState.setRoleSize("Knight", knights.size);
				handleHigherRoleSizeChange();
				if (hadRoleBeforeKnight && gameState.isRevolutionActive()){
					const wasParticipant = gameState.removeRevolutionParticipant(newMember.id);
					if(wasParticipant){
						updateRevolutionAndCoupMessages();
						updatedRevolutionAndCoupMessages = true;
					}			
				}
				break;
			case hadRoleBeforeLord || hasRoleNowLord:
				const lords = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_LORD)
				);
				gameState.setRoleSize("Lord", lords.size);
				handleHigherRoleSizeChange();
				if (hadRoleBeforeLord && gameState.isRevolutionActive()){
					gameState.removeRevolutionParticipant(newMember.id);
				}
				break;
			case hadRoleBeforeKing || hasRoleNowKing:
				const kings = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_KING)
				);
				gameState.setRoleSize("King", kings.size);
				handleHigherRoleSizeChange();
				if (hadRoleBeforeKing && gameState.isRevolutionActive())
					gameState.removeRevolutionParticipant(newMember.id);
				break;
			case hadRoleBeforeNoble || hasRoleNowNoble:
				const nobles = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_NOBLE)
				);
				gameState.setRoleSize("Noble", nobles.size);
				handleHigherRoleSizeChange();
				if (hadRoleBeforeNoble && gameState.isRevolutionActive())
					gameState.removeRevolutionParticipant(newMember.id);
				break;
			case hadRoleBeforeEmperor || hasRoleNowEmperor:
				const emperors = guild.members.cache.filter((member) =>
				member.roles.cache.has(process.env.ROLEID_EMPEROR)
				);
				gameState.setRoleSize("Emperor", emperors.size);
				handleHigherRoleSizeChange();
				if (hadRoleBeforeEmperor && gameState.isRevolutionActive())
					gameState.removeRevolutionParticipant(newMember.id);
				break;
			default:
				handleHigherRoleSizeChange();
		}
		if(gameState.isRevolutionActive()){
			checkAndFailRevolution();
		}
		if(gameState.isRevolutionActive() && !updatedRevolutionAndCoupMessages && oldPeopleCount != peopleCount){
			updateRevolutionAndCoupMessages();
		}
	});
	client.on("guildMemberRemove", async (member) => {
		const guild = await client.guilds.fetch(process.env.GUILDID);
		await guild.members.fetch();

		const hadRoleBeforePeasant = member.roles.cache.has(
			process.env.ROLEID_PEASANT
		);	
		const hadRoleBeforeScholar = member.roles.cache.has(
			process.env.ROLEID_SCHOLAR
		);	
		const hadRoleBeforeMerchant = member.roles.cache.has(
			process.env.ROLEID_MERCHANT
		);	
		const hadRoleBeforeKnight = member.roles.cache.has(
			process.env.ROLEID_KNIGHT
		);	
		const hadRoleBeforeLord = member.roles.cache.has(
			process.env.ROLEID_LORD
		);
		const hadRoleBeforeKing = member.roles.cache.has(
			process.env.ROLEID_KING
		);
		const hadRoleBeforeNoble = member.roles.cache.has(
			process.env.ROLEID_NOBLE
		);
		const hadRoleBeforeEmperor = member.roles.cache.has(
			process.env.ROLEID_EMPEROR
		);
		const isFesteredByMaggot = await CacheIsPoopBeingFestered(member.id);
		if (isFesteredByMaggot) {
			await DBClearFestering(isFesteredByMaggot.maggotId);
			console.log(
				`Succesfully removed festering data removed member poop with id ${member.id}`
			);
		}
		const isFesterMaggot = await CacheGetFesteringTarget(member.id);
		if (isFesterMaggot) {
			await DBClearFestering(member.id);
			console.log(
				`Succesfully removed festering data removed member maggot with id ${member.id}`
			);
		}
		try {
			await DBRemoveUser(member);
		} catch (error) {
			console.error(
				`An error occurred: ${error.message}, couldn't remove ${member.user.username} from the DB`
			);
		}
		const oldPeopleCount = gameState.getPlayerCount();
		const peopleCount = guild.memberCount - 16;
		let updatedRevolutionAndCoupMessages = false;
		gameState.setPlayerCount(peopleCount);
		console.log(`People count: ${peopleCount}`);
		const hadRevolutionRole = hadRoleBeforePeasant || hadRoleBeforeScholar || hadRoleBeforeMerchant ||
			hadRoleBeforeKnight ||	hadRoleBeforeLord || hadRoleBeforeKing ||
			hadRoleBeforeNoble || hadRoleBeforeEmperor;
		switch (hadRevolutionRole) {
			case hadRoleBeforePeasant :
				const peasants = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_PEASANT)
				);
				gameState.setRoleSize("Peasant", peasants.size);
				await handleHigherRoleSizeChange();
				if (gameState.isRevolutionActive() && !gameState.isCoupActive()){
					const wasParticipant = gameState.removeRevolutionParticipant(member.id);
					if(wasParticipant){
						updateRevolutionAndCoupMessages();
						updatedRevolutionAndCoupMessages = true;
					}			
				}
				break;
			case hadRoleBeforeScholar: 
				const scholars = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_SCHOLAR)
				);
				gameState.setRoleSize("Scholar", scholars.size);
				handleHigherRoleSizeChange();
				if (gameState.isRevolutionActive() && !gameState.isCoupActive()){
					const wasParticipant = gameState.removeRevolutionParticipant(member.id);
					if(wasParticipant){
						updateRevolutionAndCoupMessages();
						updatedRevolutionAndCoupMessages = true;
					}			
				}
				break;
			case hadRoleBeforeMerchant:
				const merchants = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_MERCHANT)
				);
				gameState.setRoleSize("Merchant", merchants.size);
				handleHigherRoleSizeChange();
				if (gameState.isRevolutionActive() && !gameState.isCoupActive()){
					const wasParticipant = gameState.removeRevolutionParticipant(member.id);
					if(wasParticipant){
						updateRevolutionAndCoupMessages();
						updatedRevolutionAndCoupMessages = true;
					}		
				}
				break;
			case hadRoleBeforeKnight :
				const knights = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_KNIGHT)
				);
				gameState.setRoleSize("Knight", knights.size);
				handleHigherRoleSizeChange();
				if (gameState.isRevolutionActive()){
					const wasParticipant = gameState.removeRevolutionParticipant(member.id);
					if(wasParticipant){
						updateRevolutionAndCoupMessages();
						updatedRevolutionAndCoupMessages = true;
					}			
				}
				break;
			case hadRoleBeforeLord:
				const lords = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_LORD)
				);
				gameState.setRoleSize("Lord", lords.size);
				handleHigherRoleSizeChange();
				if (gameState.isRevolutionActive())
					gameState.removeRevolutionParticipant(member.id);
				break;
			case hadRoleBeforeKing:
				const kings = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_KING)
				);
				gameState.setRoleSize("King", kings.size);
				handleHigherRoleSizeChange();
				if (gameState.isRevolutionActive())
					gameState.removeRevolutionParticipant(member.id);
				break;
			case hadRoleBeforeNoble:
				const nobles = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_NOBLE)
				);
				gameState.setRoleSize("Noble", nobles.size);
				handleHigherRoleSizeChange();
				if (gameState.isRevolutionActive())
					gameState.removeRevolutionParticipant(member.id);
				break;
			case hadRoleBeforeEmperor:
				const emperors = guild.members.cache.filter((member) =>
					member.roles.cache.has(process.env.ROLEID_EMPEROR)
				);
				gameState.setRoleSize("Emperor", emperors.size);
				handleHigherRoleSizeChange();
				if (gameState.isRevolutionActive())
					gameState.removeRevolutionParticipant(member.id);
				break;
			default:
				handleHigherRoleSizeChange();
		}
		if(gameState.isRevolutionActive()){
			checkAndFailRevolution();
		}
		if(gameState.isRevolutionActive() && !updatedRevolutionAndCoupMessages && oldPeopleCount != peopleCount){
			updateRevolutionAndCoupMessages();
		}
	});
	client.on("guildMemberAdd", async (member) => {
		try {
			await member.roles.add(
				member.guild.roles.cache.find((r) => r.name === "Poop")
			);
			await DBAddUser(member);
			const guild = await client.guilds.fetch(process.env.GUILDID);
			gameState.setPlayerCount(guild.memberCount - 16);
			handleHigherRoleSizeChange();

			if(gameState.isRevolutionActive()) checkAndFailRevolution();
			const channel = await client.channels.fetch(process.env.CHANNELIDSEWERS);
			if (!channel) {
				throw {
					name: "ChannelNotFound",
					message: `Channel with ID "${process.env.CHANNELIDSEWERS}" not found`,
				};
			}
			await channel.send(`welcome to the sewers, ${member.user.username}!`);
		} catch (error) {
			console.error(`An error occurred: ${error.message}`);
		}
	});

	client.on("interactionCreate", async (interaction) => {

		if (interaction.isChatInputCommand() &&
			interaction.commandName === "changerole") {
			try {
				const target = interaction.options.getMember("user");
				const roleName = interaction.options.getString("role");
				const keepXP = interaction.options.getBoolean("keep_xp") || false;

				if (!target || !roleName) {
					await interaction.reply({ content: "Missing user or role", ephemeral: true });
					return;
				}
				await handleAdminRoleChange(client, interaction, target.id, roleName, keepXP);	
			} catch (err) {
				console.error("Error in /changerole command:", err);
				await interaction.reply({ content: "Error while processing role change.", ephemeral: true });
			}
		}
		if (!interaction.isButton()) return;
		if(interaction.customId === "CheckXP"){
			try{
				const userId = interaction.user.id;
				const cooldown = await CacheGetCooldown("CheckXP", userId);
				if(cooldown){
					await sendInteractionReply(
						interaction,
						"You can only check your drops so often..."
					);
					return;

				}
				const userXP = await CacheGetUserXP(userId);
				await CacheSetCooldown("CheckXP", userId, CheckXpCooldown);
				await sendInteractionReply(interaction, `You currently have ${userXP} drops`);
			}catch(err){
				showErrorMsg(err);
			}
		}
		if(interaction.customId == "Divination"){
			try{
				const userId = interaction.user.id;
				const hasRoleScholar = await interaction.member.roles.cache.has(process.env.ROLEID_SCHOLAR);
				const hasRoleEmperor = await interaction.member.roles.cache.has(process.env.ROLEID_EMPEROR);
				if(!hasRoleScholar && !hasRoleEmperor){
					await sendInteractionReply(
						interaction,
						"Only Emperors and Scholars can enter the Astral Realm"
					);
					return;
				}
				let divinationType;
				if(hasRoleEmperor){
					divinationType = "emperor"
				}else{
					divinationType = "scholar"	
				}
				const cooldown = await CacheGetCooldown("AstralRealm", userId);
				if (cooldown) {
					await sendInteractionReply(
						interaction,
						"Your spirit is not yet ready to reenter the astral realm."
					);
					return;
				}
				const success = await grantAstralRealmAccess(interaction.member, client, divinationType);
				if (success) {
					if(divinationType === "scholar"){
						await CacheSetCooldown("AstralRealm", userId, ScholarAstralRealmCooldown);
						await sendInteractionReply(
							interaction,
							"You have been granted temporary access to the astral realm. As a scholar you can only listen."
						);
					}else{
						await CacheSetCooldown("AstralRealm", userId, EmperorAstralRealmCooldown);
						await sendInteractionReply(
							interaction,
							"You have been granted temporary access to the astral realm. As devine emperor, you can speak to the gods."
						);
					}
				} else {
					await sendInteractionReply(
						interaction,
						"Failed to grant access to the astral realm."
					);
				}
			}catch(err){
				showErrorMsg(err);
			}
		}
	});

	// Send message to the royal castle
	eventEmitter.on("sendMessageToRoyalCastle", async (memberId, message) => {
		try {
			const guild = await client.guilds.fetch(process.env.GUILDID);
			if (!guild) {
				console.error("Guild not found");
				return;
			}
			const member = await guild.members.fetch(memberId);
			if (!member) {
				console.error("Member not found");
				return;
			}
			const roaylCastleChannel = await client.channels.fetch(
				process.env.CHANNELIDROYALCASTLE
			);
			roaylCastleChannel.send(`${member.user.username}: ${message}`);
		} catch (err) {
			throw err;
		}
	});

	eventEmitter.on("StartRevolution", async (intiatorId, targetId, roleName) => {
		try {
			gameState.setRevolutionActive(true);
			changeRevolutionStatus(roleName,intiatorId, targetId);
			await CacheSetCooldown("Revolution", "Global", RevolutionCooldown);
			eventEmitter.emit("RevolutionStarted");
			setTimeout(async () => {
				await handleFirstPhaseRevolutionEnd(client);
			}, RevolutionFirstPhaseTime);
		} catch (err) {
			throw err;
		} 
	});

	eventEmitter.on("StartCoup", async (intiatorId,targetId) => {
		try {
			gameState.setRevolutionActive(true);
			gameState.setStruggleMethod("Coup");
			changeRevolutionStatus("Knight", intiatorId, targetId);
			await CacheSetCooldown("Coup", "Global", CoupCooldown);
			eventEmitter.emit("CoupStarted");
			setTimeout(async () => {
				await handleFirstPhaseRevolutionEnd(client);
			}, CoupFirstPhaseTime);
		} catch (err) {
			throw err;
		}
	});

	eventEmitter.on("AddRevolutionParticipant", (roleName, userId, targetId) => {
		try {
			changeRevolutionStatus(roleName, userId, targetId);
			updateRevolutionAndCoupMessages();

		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("RemoveRevolutionParticipant", (userId) => {
		try {
			gameState.removeRevolutionParticipant(userId);
			checkAndFailRevolution();
			updateRevolutionAndCoupMessages();
		} catch (err) {
			showErrorMsg(err);
		}
	});
	eventEmitter.on("ServerStatusChange", async () => {
		try{
			await updateMessage(client, lastMessageId);
		} catch(err){
			console.error(err);
		}
	});

}

function changeRevolutionStatus(roleName, userId, targetId){
	try {
		gameState.addRevolutionParticipant(roleName, userId, targetId);
		const revolutionarySize = gameState.getRevolutionarySize();
		const peopleSize = gameState.getPeopleSize();
		const coupActive = gameState.isCoupActive();
		checkAndFailRevolution();
	} catch (err) {
		throw err;
	}
}
function checkAndFailRevolution() {
	const revolutionarySize = gameState.getRevolutionarySize();
	const peopleSize = gameState.getPeopleSize();
	const coupActive = gameState.isCoupActive();
	const revolutionSecondPhase = gameState.isRevolutionSecondPhase();
	const struggleMethod = gameState.getStruggleMethod();
	const emperorElectionActive = gameState.isEmperorElectionActive();
	if (revolutionSecondPhase && !emperorElectionActive) {
		let success = revolutionarySize / peopleSize >= REVOLUTIONTHRESHOLD2;
		console.log("Revolution second phase check success value: ", success);
		if (coupActive)
			success = revolutionarySize / peopleSize >= COUPTHRESHOLD;

		if (!success) {
			clearTimeout(revolutionTimeout);
			gameState.resetRevolution();
			eventEmitter.emit(`${struggleMethod}Finished`);
			notifyRevolutionResult(
				`${struggleMethod} failed because of insufficient number of participants.`
			);
			return;
		}
	}

}
function handleHigherRoleSizeChange(){

	const higherRoleSize = gameState.getHigherRoleSize(); 
	const disableRevolution = gameState.getDisableRevolution();
	const disableCoup = gameState.getDisableCoup();
	const knightSize = gameState.getRoleSize("Knight");
	const playerCount = gameState.getPlayerCount();

	if (((higherRoleSize >= MinimumHigherRoleSizeForRevolution) &&
		(higherRoleSize/playerCount >= MinimumHigherRoleRatioForRevolution)) &&
		disableRevolution === true){
		gameState.setDisableRevolution(false);
		eventEmitter.emit("EnableRevolution");
	}else if(((higherRoleSize < MinimumHigherRoleSizeForRevolution) ||
		(higherRoleSize/playerCount < MinimumHigherRoleRatioForRevolution))
		&& disableRevolution === false){
		gameState.setDisableRevolution(true);
		eventEmitter.emit("DisableRevolution");
	}

	if ((higherRoleSize >= MinimumHigherRoleSizeForCoup) &&
		(higherRoleSize/playerCount >= MinimumHigherRoleRatioForCoup)  &&
		(knightSize >=MinimumKnightSizeForCoup) && disableCoup === true){
		gameState.setDisableCoup(false);
		eventEmitter.emit("EnableCoup");
	}else if(((higherRoleSize < MinimumHigherRoleSizeForCoup) ||
		(higherRoleSize/playerCount < MinimumHigherRoleRatioForCoup) ||
		(knightSize < MinimumKnightSizeForCoup))
		&& disableCoup === false){
		gameState.setDisableCoup(true);
		eventEmitter.emit("DisableCoup");
	}
	console.log(`HigherRoleSize: ${higherRoleSize}  PlayerCount: ${playerCount}  HigherRoleRatio: ${higherRoleSize/playerCount}  DisableRevolution: ${disableRevolution}  DisableCoup: ${disableCoup}`);

}
async function handleFirstPhaseRevolutionEnd(client) {
	let revolutionarySize = gameState.getRevolutionarySize();
	let peopleSize = gameState.getPeopleSize();
	let coupActive = gameState.isCoupActive();
	const struggleMethod = gameState.getStruggleMethod();
	let success = revolutionarySize / peopleSize >= REVOLUTIONTHRESHOLD;
	if (coupActive) success = revolutionarySize / peopleSize > COUPTHRESHOLD;
	if (success) {
		gameState.setRevolutionSecondPhase(true);
		checkAndFailRevolution();
		eventEmitter.emit(`${struggleMethod}MovedToSecondPhase`);
		if (coupActive) {
			revolutionTimeout = setTimeout(async () => {
				await handleSecondPhaseRevolutionEnd(client);
			}, CoupSecondPhaseTime);
		} else {
			revolutionTimeout = setTimeout(async () => {
				await handleSecondPhaseRevolutionEnd(client);
			}, RevolutionSecondPhaseTime);
		}
	} else {
		gameState.resetRevolution();
		eventEmitter.emit(`${struggleMethod}Finished`);
		notifyRevolutionResult(`${struggleMethod} Failed. The unrest is but a simmer`);

	}
}


async function handleSecondPhaseRevolutionEnd(client) {
	const revolutionParticipants = gameState.getRevolutionParticipants();
	const civilParticipants = gameState.getCivilParticipants();
	const knightParticipants = gameState.getKnightParticipants();
	const coupActive = gameState.isCoupActive();
	for(const participant of revolutionParticipants){
		const targetId = participant.targetId;
		console.log(`revolution ParticipantId: ${participant.userId}  targetId: ${targetId}`);
		if(!gameState.checkSelectedRevolutionTarget(targetId)){
			let targetedNumber = 0;
			for(const civilParticipant of civilParticipants) {
				if (targetId === civilParticipant.targetId) targetedNumber++;
			}
			for(const knightParticipant of knightParticipants) {
				if (targetId === knightParticipant.targetId) {
					if (coupActive) targetedNumber++;
					else targetedNumber += RevolutionKnightWeight;
				}
			}
			gameState.addSelectedRevolutionTarget(targetId, targetedNumber);
		}
	}
	let isEmperorDead = false;
	const targets = gameState.getSelectedRevolutionTargets();
	const struggleMethod = gameState.getStruggleMethod();
	for (const target of targets){
		let killTarget = false;
		console.log(`Revolution targetId: ${target.targetId}  targetCount: ${target.targetCount}`);
		const guild = await client.guilds.fetch(process.env.GUILDID);
		await guild.members.fetch();
		const member = await guild.members.fetch(target.targetId);
		if (coupActive) {
			if (
				member.roles.cache.has(
					process.env.ROLEID_NOBLE
				) &&
				target.targetCount >= CoupKillNoble
			)
				killTarget = true;
			else if (
				member.roles.cache.has(
					process.env.ROLEID_LORD
				) &&
				target.targetCount >= CoupKillLord
			)
				killTarget = true;
			else if (
				member.roles.cache.has(
					process.env.ROLEID_KING
				) &&
				target.targetCount >= CoupKillKing
			)
				killTarget = true;
			else if (
				member.roles.cache.has(
					process.env.ROLEID_EMPEROR
				) &&
				target.targetCount >= CoupKillEmperor
			) {
				killTarget = true;
				isEmperorDead = true;
			}
		} else {
			if (
				member.roles.cache.has(
					process.env.ROLEID_KNIGHT
				) &&
				target.targetCount >= RevolutionKillKnight
			)
				killTarget = true;
			else if (
				member.roles.cache.has(
					process.env.ROLEID_NOBLE
				) &&
				target.targetCount >= RevolutionKillNoble
			)
				killTarget = true;
			else if (
				member.roles.cache.has(
					process.env.ROLEID_LORD
				) &&
				target.targetCount >= RevolutionKillLord
			)
				killTarget = true;
			else if (
				member.roles.cache.has(
					process.env.ROLEID_KING
				) &&
				target.targetCount >= RevolutionKillKing
			)
				killTarget = true;
			else if (
				member.roles.cache.has(
					process.env.ROLEID_EMPEROR
				) &&
				target.targetCount >= RevolutionKillEmperor
			) {
				killTarget = true;
				isEmperorDead = true;
			}
		}

		if (killTarget) {
			await changeRole( member, "Poop", false);

			await notifyRevolutionResult(
				`@${member.user.username} has fallen below the waves of the ${struggleMethod}.`
			);
		}
	};

	if (isEmperorDead) {
		gameState.setEmperorElectionActive(true);
		gameState.resetRevolutionParticipants();
		gameState.resetRevolutionTargets();
		eventEmitter.emit("RevolutionMovedInEmperorElection");
		notifyRevolutionResult("The emperor is dead, voting for Heaven's Favour new vessel has begun.");
		setTimeout(async () => {
			await handleEmperorElectionEnd(client);
		}, RevolutionEmperorElectionTime);
	} else {
		gameState.resetRevolution();
		eventEmitter.emit(`${struggleMethod}Finished`);
		notifyRevolutionResult(`${struggleMethod} Complete.`);
	}
}

async function handleEmperorElectionEnd(client) {
	const emperorElectionParticipants = gameState.getRevolutionParticipants();
	const civilParticipants = gameState.getCivilParticipants();
	const knightParticipants = gameState.getKnightParticipants();
	const struggleMethod = gameState.getStruggleMethod();
	const refinedCandidates = {};
	let maximumVotes = 0;
	for(const participant of emperorElectionParticipants){
		const candidateId = participant.targetId;
		if(!gameState.checkSelectedRevolutionTarget(candidateId)){
			let voteCount = 0;
			for(const civilParticipant of civilParticipants) {
				if (candidateId === civilParticipant.targetId) voteCount++;
			}
			for(const knightParticipant of knightParticipants) {
				if (candidateId === knightParticipant.targetId) {
					voteCount += RevolutionKnightWeight;
				}
			}
			gameState.addSelectedRevolutionTarget(candidateId, voteCount);
			if(voteCount > maximumVotes) {
				maximumVotes = voteCount;
			}
		}
	}
	const initialCandidates = gameState.getSelectedRevolutionTargets();
	for(const candidate of initialCandidates) {
		if (candidate.targetCount != maximumVotes) {
			gameState.removeRevolutionTarget(candidate.targetId);		
		}	
	}


	const candidates = gameState.getSelectedRevolutionTargets();
	const finalCandidatesCount = candidates.size;
	if (finalCandidatesCount === 1) {
		const target = [...candidates][0];
		const guild = await client.guilds.fetch(process.env.GUILDID);
		await guild.members.fetch();
		const targetMember = await guild.members.fetch(target.targetId);
		await changeRole( targetMember, "Emperor", true);
		gameState.resetRevolution();
		eventEmitter.emit("ElectionEnthronement", targetMember.user.username);
		eventEmitter.emit(`${struggleMethod}Finished`);
		notifyRevolutionResult(`${targetMember.user.username} has been elected Emperor. Order has been restored to Griefhem`);

	} else if (finalCandidatesCount > 1) {
		gameState.resetRevolutionParticipants();
		gameState.resetRevolutionTargets();
		const emperorReelectionSelectMenu = await buildEmperorReelectionTargetSelectMenu(client, candidates);
		eventEmitter.emit("RevolutionMovedInEmperorReelection", emperorReelectionSelectMenu);
		notifyRevolutionResult(
			`${finalCandidatesCount} candidates have same votes. Starting reelection...`
		);
		setTimeout(async () => {
			await handleEmperorElectionEnd(client);
		}, RevolutionEmperorElectionTime);
	} else {
		if(gameState.getEmperorElectionRoleSize() === 0){
			gameState.resetRevolution();
			eventEmitter.emit(`${struggleMethod}Finished`);
			eventEmitter.emit("EmperorElectionNoCandidates");
			notifyRevolutionResult(`No one is eligible to be elected as emperor. The struggle has ended in chaos. A worhy emperor will spring forth soon enough.`);
			return;
		}
		notifyRevolutionResult(
			`No one participated in election! Let's vote a new emperor.`
		);
		gameState.resetRevolutionParticipants();
		gameState.resetRevolutionTargets();
		eventEmitter.emit("RevolutionMovedInEmperorElection");
		setTimeout(async () => {
			await handleEmperorElectionEnd(client);
		}, RevolutionEmperorElectionTime);
	}
}

async function notifyRevolutionResult(message) {
	eventEmitter.emit("NotifyPeasantChannel", message);
	eventEmitter.emit("NotifyKnightChannel", message);
	eventEmitter.emit("NotifyMerchantChannel", message);
	eventEmitter.emit("NotifyScholarChannel", message);

}


async function handleAdminRoleChange(client, interaction, targetId, roleName, keepXP) {

	if (!interaction.member.permissions.has("ADMINISTRATOR")) {
		return message.reply("You do not have permission to use this command.");
	}
	const guild = await client.guilds.fetch(process.env.GUILDID);
	if (!guild) {
		console.error("Guild not found");
		return;
	}
	const member = await guild.members.fetch(targetId);
	const role = await guild.roles.cache.some(
		(role) => role.name === roleName
	);
	if (!role && !member) {
		interaction.reply("role or member ID does not exist");
		return;
	}
	await changeRole( member, roleName, keepXP);
	interaction.reply(`Role changed to ${roleName} for ${member.user.username}.`);
}
async function updateRevolutionAndCoupMessages(){
	const coupActive = gameState.isCoupActive();
	if(!coupActive)eventEmitter.emit("UpdateRevolutionMessage");
	else eventEmitter.emit("UpdateCoupMessage");
}


async function buildEmperorReelectionTargetSelectMenu(client, candidates) {
	try{
		const guild = await client.guilds.fetch(process.env.GUILDID);
		await guild.members.fetch();
		const targets = candidates;
		const options = [];
		for (const target of targets) {
			try {
				const member = await guild.members.fetch(target.targetId);
				options.push({
					label: member.user.username,
					value: target.targetId
				});
			} catch (err) {
				console.error(`Failed to fetch member with ID ${target.targetId}:`, err);
			}
		}

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId("SelectEmperorCandidate")
			.setPlaceholder("Choose an Emperor")
			.setDisabled(options.length === 0)
			.addOptions(
				options.length > 0
				? options
				: [{ label: "No targets available", value: "none", default: true, disabled: true }]
			);
		return new ActionRowBuilder().addComponents(selectMenu);
	}catch (err) {
		showErrorMsg(err);
		return null;
	}
}
async function updateMessage(client, lastMessageId) {
	try{	
		const channel = await client.channels.fetch(
			process.env.CHANNELIDCONSOLE
		);
		const messageToEdit = await channel.messages.fetch(lastMessageId);

		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";
		const buttonRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("CheckXP")
			.setLabel(ButtonLabelCheckXP)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("Divination")
			.setLabel(ButtonLabelDivination)
			.setStyle(ButtonStyle.Primary)
			.setDisabled(gameState.isServerDown())
		);
		await messageToEdit.edit({
			content: serverText + '\n' + content,
			components: [buttonRow],
		});
	}catch (err) {
		showErrorMsg(err);
	}
}

async function messageConsoleCommands(client) {
	try {	
		const guild = await client.guilds.fetch(process.env.GUILDID);
		gameState.setPlayerCount(guild.memberCount - 16);
		const channel = await client.channels.fetch(process.env.CHANNELIDCONSOLE);
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";
		const buttonRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("CheckXP")
			.setLabel(ButtonLabelCheckXP)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("Divination")
			.setLabel(ButtonLabelDivination)
			.setStyle(ButtonStyle.Primary)
			.setDisabled(gameState.isServerDown())
		);

		const message = await channel.send({
			content: serverText+ '\n'  + content,
			components: [buttonRow],
		});
		return message;	

	} catch (err) {
		showErrorMsg(err);
	}
}



module.exports = { setupConsoleBotEvents, messageConsoleCommands}
