const {
	StringSelectMenuBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require("discord.js");
const {
	buildSelectMenu,
	sendInteractionReply,
} = require("../functions/botActions");
const {
	CacheGetCooldown,
	CacheSetCooldown,
} = require("../apis/redis/redisCache");
const {
 	MobFlayingTime,
  MobFlayingSuccessThreadshold,
  MobFlayingCoolDown,
  RoleChangeMessageDisplayTime,
} = require("../game_config.json");
const { eventEmitter } = require("../functions/eventEmitter.js");

let selectedTargets = {};
let peasants = [];
let peasantsSize = 1;
let mobFlayingInitiatorId = null;
let mobFlayingInitiatorUsername = null;
let mobFlayingTargetId = null;
let mobFlayingTargetName = null;
let mobFlayingActive = false;
let mobFlayingParticipants = new Set();
let mobFlayingTimeout;

const initContent =
	"Peasants can trigger a timed poll to strip a target of their role by selecting SUBHUMAN or PEASANT in a menu and clicking a button. If over 50% of participants join before the timer ends, the target's role is changed to POOP; otherwise, the attempt fails. A global cooldown is activated after each use.\n\n" +
	"**Abilities:**\n" +
	"- **Mob Flaying**: With more than 50% of peasants, you can make one sub-human or peasant to poop.";

function showErrorMsg(err) {
	console.error("ERROR: peasant_commands.js", err);
}

async function setupPeasantBotEvents(client, lastMessageId) {
	client.on("guildMemberUpdate", async (oldMember, newMember) => {
		const hadRoleBeforeSubHuman = oldMember.roles.cache.has(
			process.env.ROLEID_SUBHUMAN
		);
		const hasRoleNowSubhuman = newMember.roles.cache.has(
			process.env.ROLEID_SUBHUMAN
		);
		const hadRoleBeforePeasant = oldMember.roles.cache.has(
			process.env.ROLEID_PEASANT
		);
		const hasRoleNowPeasant = newMember.roles.cache.has(
			process.env.ROLEID_PEASANT
		);

   if (mobFlayingActive && hadRoleBeforePeasant && !hasRoleNowPeasant) {
      if (mobFlayingParticipants.has(newMember.id)) {
        try {
          selectedTargets[newMember.id] = null;
          mobFlayingParticipants.delete(newMember.id);
          const channel = await client.channels.fetch(
            process.env.CHANNELIDPEASANT
          );
          const messageToEdit = await channel.messages.fetch(lastMessageId);

          if (newMember.id === mobFlayingInitiatorId) {
            // If the initiator lost the role, reset the poll
            const msg = `The initiator ${mobFlayingInitiatorUsername} is no longer a peasant.`;
            eventEmitter.emit("NotifyPeasantChannel", msg);
            mobFlayingActive = false;
            await ceaseMobFlaying(client, messageToEdit);
            return;
          }
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }
    if (hadRoleBeforePeasant || hasRoleNowPeasant) {
      try {
        if (mobFlayingActive) {
          const guild = await client.guilds.fetch(process.env.GUILDID);
          await guild.members.fetch();
          peasants = guild.members.cache.filter((member) =>
            member.roles.cache.has(process.env.ROLEID_PEASANT)
          );
          peasantsSize = peasants.size;

          const channel = await client.channels.fetch(
            process.env.CHANNELIDPEASANT
          );
          const messageToEdit = await channel.messages.fetch(lastMessageId);
          const content =
            initContent +
            `\n@${mobFlayingInitiatorUsername} initiated mob flaying. Join to downgrade ${mobFlayingTargetName}. (Joined ${mobFlayingParticipants.size} / ${peasantsSize}.)`;
          const participationRate = mobFlayingParticipants.size / peasantsSize;
          if (participationRate >= MobFlayingSuccessThreadshold) {
            ceaseMobFlaying(client, messageToEdit);
            return;
          }
          await messageToEdit.edit({
            content,
          });
        }
      } catch (err) {
        showErrorMsg(err);
      }
    }
    if (
      hadRoleBeforePeasant ||
      hasRoleNowPeasant ||
      hadRoleBeforeSubHuman ||
      hasRoleNowSubhuman
    ) {
      if (lastMessageId) {
        try {
          await updateSelectMenu(client, lastMessageId);
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }
  });

	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

   if (interaction.customId === "TargetsSelectMenu") {
      const userId = interaction.user.id;
      let targetId = interaction.values[0];
      try {
        selectedTargets[userId] = await interaction.guild.members.cache.get(
          targetId
        );
        await interaction.deferUpdate();
      } catch (err) {
        showErrorMsg(err);
      }
    }

    if (interaction.customId === "MobFlaying") {
      const userId = interaction.user.id;
      peasants = interaction.guild.members.cache.filter((member) =>
        member.roles.cache.has(process.env.ROLEID_PEASANT)
      );
      peasantsSize = peasants.size;

      if (!selectedTargets[userId]) {
        await sendInteractionReply(interaction, "No member selected");
        return;
      }

      let cooldown;
      try {
        cooldown = await CacheGetCooldown("MobFlaying", userId);
      } catch (err) {
        showErrorMsg(err);
      }
      if (cooldown) {
        await sendInteractionReply(interaction, "Mob flaying is on cooldown");
        return;
      }

      if (selectedTargets[userId].user.id === userId) {
        await sendInteractionReply(interaction, "You cannot target yourself.");
        return;
      }

      mobFlayingInitiatorId = userId;
      mobFlayingInitiatorUsername = interaction.user.username;
      mobFlayingParticipants.add(userId);
      mobFlayingActive = true;
      mobFlayingTargetName = selectedTargets[userId].user.username;
      mobFlayingTargetId = selectedTargets[userId].user.id;

      const channel = await client.channels.fetch(process.env.CHANNELIDPEASANT);
      if (lastMessageId) {
        try {
          // Set cooldown
          await CacheSetCooldown("MobFlaying", userId, MobFlayingCoolDown);

          const messageToEdit = await channel.messages.fetch(lastMessageId);
          const actionRow_0 = ActionRowBuilder.from(
            messageToEdit.components[0].toJSON()
          );
          const targetsSelectMenu = StringSelectMenuBuilder.from(
            actionRow_0.components[0].toJSON()
          )
            .setDisabled(true)
            .setPlaceholder(selectedTargets[userId].user.username);
          actionRow_0.components[0] = targetsSelectMenu;

          const actionRow_1 = ActionRowBuilder.from(
            messageToEdit.components[1].toJSON()
          );
          const mobFlayingButton = ButtonBuilder.from(
            actionRow_1.components[0].toJSON()
          );
          mobFlayingButton.setDisabled(true);
          const joinMobFlayingButton = new ButtonBuilder()
            .setCustomId("JoinMobFlaying")
            .setLabel("Join Mob Flaying")
            .setStyle(ButtonStyle.Primary);
          actionRow_1.components[0] = mobFlayingButton;
          actionRow_1.components[1] = joinMobFlayingButton;

          const content =
            initContent +
            `\n@${mobFlayingInitiatorUsername} initiated mob flaying. Join to downgrade ${mobFlayingTargetName}. (Joined ${mobFlayingParticipants.size} / ${peasantsSize}.)`;
          await messageToEdit.edit({
            content,
            components: [actionRow_0, actionRow_1],
          });

          await startMobFlaying(client, messageToEdit, MobFlayingTime);

          await sendInteractionReply(
            interaction,
            "Mob flaying initiated, waiting for other peasants to join"
          );

          const participationRate = mobFlayingParticipants.size / peasantsSize;
          if (participationRate >= MobFlayingSuccessThreadshold) {
            ceaseMobFlaying(client, messageToEdit);
            return;
          }
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }
    if (interaction.customId === "JoinMobFlaying") {
      try {
        if (!mobFlayingActive) {
          await sendInteractionReply(
            interaction,
            "There is no active mob flaying to join."
          );
          return;
        }

        const userId = interaction.user.id;
        if (userId === mobFlayingInitiatorId) {
          await sendInteractionReply(
            interaction,
            "Once you initiated mob flaying, you don't need to join since you are alreday a participant."
          );
          return;
        }

        if (userId === mobFlayingTargetId) {
          await sendInteractionReply(
            interaction,
            "You cannot join mob flyaing on yourself."
          );
          return;
        }

        if (mobFlayingParticipants.has(userId)) {
          await sendInteractionReply(interaction, "You've already joined.");
          return;
        }

        mobFlayingParticipants.add(userId);
        await sendInteractionReply(interaction, "You have joind mob flaying.");

        const participationRate = mobFlayingParticipants.size / peasantsSize;
        const channel = await client.channels.fetch(
          process.env.CHANNELIDPEASANT
        );
        const messageToEdit = await channel.messages.fetch(lastMessageId);
        if (
          mobFlayingActive &&
          participationRate >= MobFlayingSuccessThreadshold
        ) {
          //If poll succeeded within voting ending time.
          ceaseMobFlaying(client, messageToEdit);
          return;
        } else {
          const editedContent =
            initContent +
            `\n@${mobFlayingInitiatorUsername} initiated a mob flaying. Join to downgrade ${mobFlayingTargetName}. (Joined ${mobFlayingParticipants.size} / ${peasantsSize}.)`;

          await messageToEdit.edit({ content: editedContent });
        }
      } catch (err) {
        throw err;
      }
    }
  });
  eventEmitter.on("NotifyPeasantChannel", async (msg) => {
    try {
      let channel = await client.channels.fetch(process.env.CHANNELIDPEASANT);
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

async function startMobFlaying(client, messageToEdit, timeout) {
  mobFlayingTimeout = setTimeout(async () => {
    await handleMobFlayingEnd(client, messageToEdit);
  }, timeout);
}

async function handleMobFlayingEnd(client, messageToEdit) {
  const participationRate = mobFlayingParticipants.size / peasantsSize;
  if (mobFlayingActive && participationRate >= MobFlayingSuccessThreadshold) {
    // If Timed poll is sucessful
    const target = selectedTargets[mobFlayingInitiatorId];
    if (target) eventEmitter.emit("changeRole", target, "Poop");
    const msg = `Mob flaying successful! @${mobFlayingTargetName} has become a poop by @${mobFlayingInitiatorUsername}.`;
    eventEmitter.emit("NotifyPeasantChannel", msg);
  } else {
    const msg = `Mob flaying on @${mobFlayingTargetName} initiated by @${mobFlayingInitiatorUsername} has been failed.`;
    eventEmitter.emit("NotifyPeasantChannel", msg);
  }
  await resetComponents(client, messageToEdit);
}

async function ceaseMobFlaying(client, messageToEdit) {
  if (mobFlayingTimeout) {
    clearTimeout(mobFlayingTimeout); // Clear the original timeout
    await handleMobFlayingEnd(client, messageToEdit); // Manually trigger poll logic
  }
}

async function updateSelectMenu(client, lastMessageId) {
  try {
    const channel = await client.channels.fetch(process.env.CHANNELIDPEASANT);
    const messageToEdit = await channel.messages.fetch(lastMessageId);
    const selectMenu = await buildSelectMenu(
      client,
      ["peasant", "subhuman"],
      "TargetsSelectMenu"
    );
    if (mobFlayingActive)
      selectMenu.setDisabled(true).setPlaceholder(mobFlayingTargetName);
    const actionRow_0 = new ActionRowBuilder().addComponents(selectMenu);

    const existingComponents = messageToEdit.components.map((component) =>
      ActionRowBuilder.from(component.toJSON())
    );
    existingComponents[0] = actionRow_0;

    if (!mobFlayingActive) {
      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("MobFlaying")
          .setLabel("Mob Flaying")
          .setStyle(ButtonStyle.Danger)
      );
      existingComponents[1] = buttonRow;
    }

    await messageToEdit.edit({
      components: existingComponents,
    });
  } catch (err) {
    showErrorMsg(err);
  }
}

async function messagePeasantCommands(client) {
	let channel = null;
	try {
		channel = await client.channels.fetch(process.env.CHANNELIDPEASANT);
	} catch (err) {
		showErrorMsg(err);
		return;
	}

  try {
    const selectMenuSubhumanPeasants = await buildSelectMenu(
      client,
      ["peasant", "subhuman"],
      "TargetsSelectMenu"
    );
    const row_subhuman_peasant_select = new ActionRowBuilder().addComponents(
      selectMenuSubhumanPeasants
    );
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("MobFlaying")
        .setLabel("Mob Flaying")
        .setStyle(ButtonStyle.Danger)
    );

		const message = await channel.send({
			content: initContent,
			components: [row_subhuman_peasant_select, buttonRow],
		});
		return message;
	} catch (err) {
		showErrorMsg(err);
	}
}

async function resetComponents(client, messageToEdit) {
  try {
    mobFlayingActive = false;
    mobFlayingInitiatorUsername = null;
    mobFlayingInitiatorId = null;
    mobFlayingTargetName = null;
    mobFlayingTargetId = null;
    selectedTargets = {};
    mobFlayingParticipants.clear();
    peasantsSize = 1;
    peasants = [];

		const actionRow_0 = ActionRowBuilder.from(
			messageToEdit.components[0].toJSON()
		);

    const targetsSelectMenu = await buildSelectMenu(
      client,
      ["peasant", "subhuman"],
      "TargetsSelectMenu"
    );

    actionRow_0.components[0] = targetsSelectMenu;

    // Reset poll button
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("MobFlaying")
        .setLabel("Mob Flaying")
        .setStyle(ButtonStyle.Danger)
    );

		await messageToEdit.edit({
			content: initContent,
			components: [actionRow_0, buttonRow],
		});
	} catch (err) {
		throw err;
	}
}

module.exports = { setupPeasantBotEvents, messagePeasantCommands };
