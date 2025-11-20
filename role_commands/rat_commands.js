const { eventEmitter } = require("../functions/eventEmitter.js");
const gameState = require("../game_state.js");
const {
	messageChannel,
	sendInteractionReply,
	buildSelectMenu,
} = require("../functions/botActions");
const {
	CacheGetUserXP,
	CacheGetCooldown,
	CacheSetCooldown,
    CacheGetUsersByRoles,
} = require("../apis/redis/redisCache");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const {
	NibbleCost,
	NibbleCooldown,
	PlagueCooldown,
	PlagueFirstPhaseTime,
	PlagueSecondPhaseTime,
	PlagueKillSubhuman,
	PlagueKillPeasant,
	PlagueKillScholar,
	PlagueKillMerchant,
	PlagueKillKnight,
	RoleChangeMessageDisplayTime,
	TextRatMessageContent,
	ButtonLabelNibble,
	ButtonLabelPlague,
	ButtonLabelJoinPlague,
	TextNibbleSelectMenu,
	TextPlagueTargetSelectMenu,
	PLAGUETHRESHOLD
} = require("../game_config.json");
const { DBUpdateXP, changeRole } = require("../apis/firebase/querys");

const initContent = TextRatMessageContent;

function showErrorMsg(err) {
	console.error("ERROR: rat_commands.js", err);
}


let selectedTargets = {};
let plagueParticipants = {};
let selectedPlagueTargets = {};
let plagueInitiator = null;
let plagueInitiatorId = null;
let plagueTimeout;
let plagueActive = false;
let secondPhase = false;
let rats = [];
let ratsSize = 0;

async function setupRatBotEvents(client, lastMessageId) {
	  client.on("guildMemberRemove", async (member) => {
		  try {
			  const hadRoleBeforeRat = member.roles.cache.has(
				  process.env.ROLEID_RAT
			  );
			  const hadRoleBeforeCockroach = member.roles.cache.has(
				  process.env.ROLEID_COCKROACH
			  );
			  const hadRoleBeforeMaggot = member.roles.cache.has(
				  process.env.ROLEID_MAGGOT
			  );		
			  const hadRoleBeforeSubhuman = member.roles.cache.has(
				  process.env.ROLEID_SUBHUMAN
			  );
			  const hadRoleBeforePeasant = member.roles.cache.has(
				  process.env.ROLEID_PEASANT
			  );
			  const hadRoleBeforeMerchant = member.roles.cache.has(
				  process.env.ROLEID_MERCHANT
			  );
			  const hadRoleBeforeScholar = member.roles.cache.has(
				  process.env.ROLEID_SCHOLAR
			  );
			  const hadRoleBeforeKnight = member.roles.cache.has(
				  process.env.ROLEID_KNIGHT
			  );
			  // If member was plague participant
			  if (hadRoleBeforeRat && plagueActive) {
				  rats = await CacheGetUsersByRoles(["rat"]);
				  ratsSize = rats.length;

				  if (
					  Object.keys(plagueParticipants).findIndex(
						  (key) => key === member.id
					  ) > -1
				  ) {
					  delete plagueParticipants[member.id];
					  if (secondPhase) {
						  if (Object.keys(plagueParticipants).length < PLAGUETHRESHOLD) {
							  ceasePlague(client, lastMessageId);
						  }else{ 
							  await updateMessage(client, lastMessageId);
						  }
					  }

				  }
				  await updateMessage(client, lastMessageId);
			  }

			  if (hadRoleBeforeMaggot || hadRoleBeforeCockroach) {
				  for (let userId in selectedTargets) {
					  if (selectedTargets[userId] && selectedTargets[userId].id === member.id) {
						  selectedTargets[userId] = null;
					  }
				  }
				  await updateMessage(client, lastMessageId);
			  }

			  // Clear from plague targets if they were selected
			  if (hadRoleBeforeSubhuman ||
				  hadRoleBeforePeasant ||
				  hadRoleBeforeMerchant ||
				  hadRoleBeforeScholar ||
				  hadRoleBeforeKnight ) {
				  for (let userId in selectedPlagueTargets) {
					  if (selectedPlagueTargets[userId] && selectedPlagueTargets[userId].id === member.id) {
						  selectedPlagueTargets[userId] = null;
					  }
				  }
				  await updateMessage(client, lastMessageId);
			  }
		  } catch (err) {
			  showErrorMsg(err);
		  }
	  });
	client.on("guildMemberUpdate", async (oldMember, newMember) => {
		const hadRoleBeforeRat = oldMember.roles.cache.has(process.env.ROLEID_RAT);
		const hadRoleBeforeMaggot = oldMember.roles.cache.has(
			process.env.ROLEID_MAGGOT
		);
		const hadRoleBeforeCockroach = oldMember.roles.cache.has(
			process.env.ROLEID_COCKROACH
		);
		const hadRoleBeforeSubhuman = oldMember.roles.cache.has(
			process.env.ROLEID_SUBHUMAN
		);
		const hadRoleBeforePeasant = oldMember.roles.cache.has(
			process.env.ROLEID_PEASANT
		);
		const hadRoleBeforeMerchant = oldMember.roles.cache.has(
			process.env.ROLEID_MERCHANT
		);
		const hadRoleBeforeScholar = oldMember.roles.cache.has(
			process.env.ROLEID_SCHOLAR
		);
		const hadRoleBeforeKnight = oldMember.roles.cache.has(
			process.env.ROLEID_KNIGHT
		);
		const hasRoleNowRat = newMember.roles.cache.has(process.env.ROLEID_RAT);
		const hasRoleNowMaggot = newMember.roles.cache.has(
			process.env.ROLEID_MAGGOT
		);
		const hasRoleNowCockroach = newMember.roles.cache.has(
			process.env.ROLEID_COCKROACH
		);
		const hasRoleNowSubhuman = newMember.roles.cache.has(
			process.env.ROLEID_SUBHUMAN
		);
		const hasRoleNowPeasant = newMember.roles.cache.has(
			process.env.ROLEID_PEASANT
		);
		const hasRoleNowMerchant = newMember.roles.cache.has(
			process.env.ROLEID_MERCHANT
		);
		const hasRoleNowScholar = newMember.roles.cache.has(
			process.env.ROLEID_SCHOLAR
		);
		const hasRoleNowKnight = newMember.roles.cache.has(
			process.env.ROLEID_KNIGHT
		);

		if (plagueActive && hadRoleBeforeRat) {

			rats = await CacheGetUsersByRoles(["rat"]);
			ratsSize = rats.length;		

			if (
				Object.keys(plagueParticipants).findIndex(
					(key) => key === newMember.id
				) > -1
			) {
				delete plagueParticipants[newMember.id];
				if (secondPhase) {
					if (Object.keys(plagueParticipants).length < PLAGUETHRESHOLD) {
						ceasePlague(client, lastMessageId);
						return;
					}
				}

				await updateMessage(client, lastMessageId);
			}
		}

		if (hadRoleBeforeMaggot || hadRoleBeforeCockroach) {
			for (let userId in selectedTargets) {
				if (
					selectedTargets[userId] &&
					selectedTargets[userId].id === oldMember.id
				) {
					delete selectedTargets[userId];
					console.log(
						`Removed ${oldMember.user.username} from Nibble selectedTargets`
					);
				}
			}
			await updateMessage(client, lastMessageId);
		}
		if (plagueActive && hasRoleNowRat) {
			rats = await CacheGetUsersByRoles(["rat"]);
			ratsSize = rats.length;

			await updateMessage(client, lastMessageId);
		}
		if (
			hadRoleBeforeSubhuman ||
			hadRoleBeforePeasant ||
			hadRoleBeforeMerchant ||
			hadRoleBeforeScholar ||
			hadRoleBeforeKnight ||
			hasRoleNowCockroach ||
			hasRoleNowMaggot ||
			hasRoleNowSubhuman ||
			hasRoleNowPeasant ||
			hasRoleNowMerchant ||
			hasRoleNowScholar ||
			hasRoleNowKnight
		) {
			for (let userId in selectedPlagueTargets) {
				if (selectedPlagueTargets[userId] &&
					selectedPlagueTargets[userId].id === newMember.id) {

					selectedPlagueTargets[userId] = null;
				}
			}
			await updateMessage(client, lastMessageId);
		}

	});

	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
		if (interaction.customId === "SelectNibbleUser") {
			const userId = interaction.user.id;
			let selectedTargetId = interaction.values[0];
			try {
				selectedTargets[userId] = await interaction.guild.members.fetch(
					selectedTargetId
				);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "SelectPlagueTarget") {
			const userId = interaction.user.id;
			let selectedTargetId = interaction.values[0];
			try {
				selectedPlagueTargets[userId] =
					await interaction.guild.members.fetch(selectedTargetId);
				await interaction.deferUpdate();
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "Nibble") {
			try {
				const userId = interaction.user.id;
				if (!selectedTargets[userId]) {
					await sendInteractionReply(
						interaction,
						`No maggot or rat selected...`
					);
					return;
				}
				const targetUsername = selectedTargets[userId].user.username;
				const targetId = selectedTargets[userId].id;
				const userXP = await CacheGetUserXP(userId);
				if (userXP < NibbleCost) {
					await sendInteractionReply(
						interaction,
						`Not enough drops (current drops: ${userXP})`
					);
					return;
				}
				const cooldown = await CacheGetCooldown("nibble", userId);
				if (cooldown) {
					await sendInteractionReply(
						interaction,
						"Nibble is on cooldown and cannot be used"
					);
					return;
				}  
				await changeRole(selectedTargets[userId], "Poop", false);
				await DBUpdateXP(userId, -NibbleCost, client);
				await CacheSetCooldown("nibble", userId, NibbleCooldown);
				eventEmitter.emit(
					"NibbleComplete",
					targetId,
					interaction.user.id
				);
				const XPLeft = parseInt(userXP) - parseInt(NibbleCost);
				await sendInteractionReply(
					interaction,
					`(${XPLeft} drops left) You've succesfuly eaten  <@${targetId}>.`
				);
				await messagePutridWaste(client,`<@${targetId}> was nibbled to bits by <@${userId}>, poor writhing maggot...`);
				selectedTargets[userId] = null;
			} catch (err) {
				showErrorMsg(err);
			}
		}

		if (interaction.customId === "Plague") {
			const userId = interaction.user.id;
			if (!selectedPlagueTargets[userId]) {
				await sendInteractionReply(interaction, "No member selected");
				return;
			}

			let cooldown;
			try {
				cooldown = await CacheGetCooldown("Plague", "Global");
			} catch (err) {
				showErrorMsg(err);
			}
			if (cooldown) {
				await sendInteractionReply(interaction, "Plague is on cooldown");
				return;
			}

			if (lastMessageId) {
				try {
					const target = selectedPlagueTargets[userId];
					plagueParticipants[userId] = {
						targetId: target.user.id,
						roles: target.roles.cache,
					};

					// Set cooldown
					await CacheSetCooldown("Plague", "Global", PlagueCooldown);

					rats = 	await CacheGetUsersByRoles(["rat"]);
					ratsSize = rats.length;
					plagueInitiator = interaction.user.username;
					plagueInitiatorId = userId;
					await startFirstPhasePlague(
						client,
						lastMessageId,
						PlagueFirstPhaseTime
					);

					await sendInteractionReply(
						interaction,
						`You have successfully initiated plague with target <@${target.id}>. Wait for the rats to join.`
					);
					await messagePutridWaste(client,`The  tunnels are ominously quiet besides a distant unison squeak, tiny clarions of heaven...`);
					await updateMessage(client, lastMessageId);
				} catch (err) {
					showErrorMsg(err);
				}
			}
		}

		if (interaction.customId === "JoinPlague") {
			const userId = interaction.user.id;
			if (!selectedPlagueTargets[userId]) {
				await sendInteractionReply(interaction, "No target selected");
				return;
			}

			if (
				Object.keys(plagueParticipants).findIndex((key) => key === userId) > -1
			) {
				await sendInteractionReply(
					interaction,
					"You've already joined the plague."
				);
				return;
			}

			const target = selectedPlagueTargets[userId];
			plagueParticipants[userId] = {
				targetId: target.user.id,
				roles: target.roles.cache,
			};

			await sendInteractionReply(
				interaction,
				`You have joined the plague with target <@${target.id}>.`
			);

			await updateMessage(client, lastMessageId);
		}
	});

	eventEmitter.on("NotifyRatChannel", async (msg) => {
		try {
			let channel = await client.channels.fetch(process.env.CHANNELIDRAT);
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
	eventEmitter.on('ServerStatusChange', async () => {
		try{
			await updateMessage(client, lastMessageId);
		} catch (err) {
			showErrorMsg(err);
		}
	});
}

async function messagePutridWaste (client, message){
	try {
		const putridWasteChannel = await client.channels.fetch(process.env.CHANNELID_PUTRID_WASTE);
		await putridWasteChannel.send(message);
	} catch (err) {
		showErrorMsg(err);
	}
}

async function startFirstPhasePlague(client, lastMessageId, timeout) {
	plagueActive = true;
	setTimeout(async () => {
		await handleFirstPhasePlagueEnd(client, lastMessageId);
	}, timeout);
}

async function handleFirstPhasePlagueEnd(client, lastMessageId) {
	if (Object.keys(plagueParticipants).length >= PLAGUETHRESHOLD) {
		const msg = `Heaven's Favor shines upon <@${plagueInitiatorId}>'s plague, its second phase begins.`;
		eventEmitter.emit("NotifyRatChannel", msg);
		await messagePutridWaste(client, `The clarions grows louder filling the tunnels with thick anticipation, a plague is underway...`);
		await startSecondPhasePlauge(client, lastMessageId, PlagueSecondPhaseTime);
	} else {
		const msg = `The plague initiated by arrogant <@${plagueInitiatorId}> failed...`;
		eventEmitter.emit("NotifyRatChannel", msg);
		await messagePutridWaste(client, `The squeaks disperse, <@${plagueInitiatorId}>'s plague has fallen short of Heaven's Favor. Proud rats shall be stripped of service...`);
		await resetComponents(client, lastMessageId);
	}
}

async function startSecondPhasePlauge(client, lastMessageId, timeout) {
	secondPhase = true;

	plagueTimeout = setTimeout(async () => {
		await handleSecondPhasePlagueEnd(client, lastMessageId);
	}, timeout);
}

async function handleSecondPhasePlagueEnd(client, lastMessageId) {
	const refinedTargets = {};
	await messagePutridWaste(client, `the plague pleases the gods, bathed in light, it sprouts far above the sewers. Many fall ill...`);
	Object.keys(plagueParticipants).forEach((userId) => {
		const targetId = plagueParticipants[userId].targetId;
		let targetedNumber = 1;
		Object.keys(plagueParticipants).forEach((otherUserId) => {
			const otherTargetId = plagueParticipants[otherUserId].targetId;
			if (userId !== otherUserId && targetId === otherTargetId)
				targetedNumber++;
		});
		refinedTargets[targetId] = {
			targetedNumber,
			roles: plagueParticipants[userId].roles,
		};
	});
	let killCount = 0;
	Object.keys(refinedTargets).forEach(async (targetId) => {
		let killTarget = false;
		let message;
		let channelId;	
		switch(true){
		case(	refinedTargets[targetId].roles.has(process.env.ROLEID_SUBHUMAN) &&
			refinedTargets[targetId].targetedNumber > PlagueKillSubhuman
		):
			killTarget = true;
			message = `Sub-human <@${targetId}> is dead.`;
			channelId = process.env.CHANNELID_DECREPIT_TUNNELS;
			break;
		
		case (
			refinedTargets[targetId].roles.has(process.env.ROLEID_PEASANT) &&
			refinedTargets[targetId].targetedNumber > PlagueKillPeasant
		):
			killTarget = true;
			message = `Peasant <@${targetId}> is dead.`;
			channelId = process.env.CHANNELID_FARMS;
			break;
		case(
			refinedTargets[targetId].roles.has(process.env.ROLEID_SCHOLAR) &&
			refinedTargets[targetId].targetedNumber > PlagueKillScholar
		):
			killTarget = true;
			message = `Scholar <@${targetId}> is dead.`;
			channelId = process.env.CHANNELID_LIBRARY;
			break;
		case(
			refinedTargets[targetId].roles.has(process.env.ROLEID_MERCHANT) &&
			refinedTargets[targetId].targetedNumber > PlagueKillMerchant
		):
			killTarget = true;
			message = `Merchant <@${targetId}> is dead.`;
			channelId = process.env.CHANNELID_MARKET;
			break;
		case(
			refinedTargets[targetId].roles.has(process.env.ROLEID_KNIGHT) &&
			refinedTargets[targetId].targetedNumber > PlagueKillKnight
		):
			killTarget = true;
			message = `Knight <@${targetId}> is dead.`;
			channelId = process.env.CHANNELID_BARRACKS;
			break;
		}
		if (killTarget) {
			killCount++;
			const guild = await client.guilds.fetch(process.env.GUILDID);
			const member = await guild.members.fetch(targetId);
			await changeRole(member, "Poop", false);
			await messageChannel(client, channelId,message);
			await messagePutridWaste(client, `Plagueridden <@${targetId}> is dead.`);
			eventEmitter.emit(
				"NotifyRatChannel",
				`<@${targetId}> has succumbed to the plague.`
			);
		}
	});
	await messagePutridWaste(client,
		`Plague washed over the land, rats have restored Heaven's Favor. Long live our glorious rodents!`
	);
	eventEmitter.emit("NotifyRatChannel", `Plague successfully cleansed the realm, ${killCount} are dead.`);
	await resetComponents(client, lastMessageId);
}

async function ceasePlague(client, lastMessageId) {
	if (plagueTimeout) {
		clearTimeout(plagueTimeout);
		eventEmitter.emit(
			"NotifyRatChannel",
			"Plague failed, too few rats."
		);
		await messagePutridWaste(client, `The squeaks disperse, <@${plagueInitiatorId}>'s plague has fallen short of Heaven's Favor. Proud rats shall be stripped of service...`);
		await resetComponents(client, lastMessageId);
	}
}

async function updateMessage(client, lastMessageId) {
	try {
		const channel = await client.channels.fetch(process.env.CHANNELIDRAT);
		const messageToEdit = await channel.messages.fetch(lastMessageId);
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";

		if (plagueActive) {
			const actionRow_0 = new ActionRowBuilder().addComponents(
				await buildSelectMenu(
					client,
					["maggot", "fly"],
					"SelectNibbleUser", TextNibbleSelectMenu
				)
			);
			const actionRow_1 = new ActionRowBuilder().addComponents(
				await buildSelectMenu(
					client,
					["sub-human", "peasant", "scholar", "merchant", "knight"],
					"SelectPlagueTarget", TextPlagueTargetSelectMenu
				)
			);
			const btnRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("Nibble")
				.setLabel(ButtonLabelNibble)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("JoinPlague")
				.setLabel(ButtonLabelJoinPlague)
				.setStyle(ButtonStyle.Danger)
				.setDisabled(gameState.isServerDown())
			);

			let content =
				initContent +
				`\n\n<@${plagueInitiatorId}> initiated a plague. Join plague with selected target. (Joined ${
					Object.keys(plagueParticipants).length
				} / ${ratsSize} rats.)`;
			if (secondPhase)
				content =
					initContent +
					`\n\n<@${plagueInitiatorId}>'s plague is spreading to its second phase. Join plague with selected target. (Joined ${
						Object.keys(plagueParticipants).length
					} / ${ratsSize} rats.)`;

			await messageToEdit.edit({
				content: serverText + '\n' + content,
				components: [actionRow_0, actionRow_1, btnRow],
			});
		} else {
			const actionRow_0 = new ActionRowBuilder().addComponents(
				await buildSelectMenu(
					client,
					["maggot", "fly"],
					"SelectNibbleUser", TextNibbleSelectMenu
				)
			);
			const actionRow_1 = new ActionRowBuilder().addComponents(
				await buildSelectMenu(
					client,
					["sub-human", "peasant", "scholar", "merchant", "knight"],
					"SelectPlagueTarget", TextPlagueTargetSelectMenu
				)
			);
			const btnRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
				.setCustomId("Nibble")
				.setLabel(ButtonLabelNibble)
				.setStyle(ButtonStyle.Primary)
				.setDisabled(gameState.isServerDown()),
				new ButtonBuilder()
				.setCustomId("Plague")
				.setLabel(ButtonLabelPlague)
				.setStyle(ButtonStyle.Danger)
				.setDisabled(gameState.isServerDown())
			);

			await messageToEdit.edit({
				content: serverText + '\n' + initContent,
				components: [actionRow_0, actionRow_1, btnRow],
			});
		}
	} catch (err) {
		showErrorMsg(err);
	}
}

async function messageRatCommands(client) {
	let channel = null;
	try {
		channel = await client.channels.fetch(process.env.CHANNELIDRAT);
		const serverText = gameState.isServerDown() ? "!!!!!!!!!!!!!!!!! SERVER IS DOWN !!!!!!!!!!!!!!!!!" : "";
		const selectMenu = new ActionRowBuilder().addComponents(
			await buildSelectMenu(client, ["maggot", "fly"], "SelectNibbleUser", TextNibbleSelectMenu)
		);

		const plagueSelectMenu = new ActionRowBuilder().addComponents(
			await buildSelectMenu(
				client,
				["sub-human", "peasant", "scholar", "merchant", "knight"],
				"SelectPlagueTarget", TextPlagueTargetSelectMenu
			)
		);

		const btnRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
			.setCustomId("Nibble")
			.setLabel(ButtonLabelNibble)
			.setStyle(ButtonStyle.Primary)
			.setDisabled(gameState.isServerDown()),
			new ButtonBuilder()
			.setCustomId("Plague")
			.setLabel(ButtonLabelPlague)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(gameState.isServerDown())
		);

		return await channel.send({
			content: serverText + '\n' + initContent,
			components: [selectMenu, plagueSelectMenu, btnRow],
		});
	} catch (err) {
		return console.error(err);
	}
}

async function resetComponents(client, lastMessageId) {
	try {
		selectedTargets = {};
		plagueParticipants = {};
		selectedPlagueTargets = {};
		plagueInitiator = null;
		plagueInitiatorId = null;
		plagueActive = false;
		secondPhase = false;
		await updateMessage(client, lastMessageId);
	} catch (err) {
		throw err;
	}
}

module.exports = { setupRatBotEvents, messageRatCommands };
