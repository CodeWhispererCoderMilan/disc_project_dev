const { eventEmitter } = require("../functions/eventEmitter.js");
const {
  buildSelectMenu,
  sendInteractionReply,
} = require("../functions/botActions");
const {
  CacheGetUserXP,
  CacheSetCooldown,
  CacheGetCooldown,
  CacheGetKnightWrits,
  CacheCheckActiveWrit,
  CacheUpdateWritStatus,
  CacheCheckAndUpdateUserWrits,
} = require("../apis/redis/redisCache");
const { DBUpdateXP } = require("../apis/firebase/querys.js");
const {
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const {
  CutDownCost,
  CutDownCooldown,
  HighWritReward,
  EminentWritReward,
  RoyalWritReward,
  ImperialWritReward,
  SiegeTime,
  RoleChangeMessageDisplayTime,
} = require("../game_config.json");

let knights = [];
let knightsSize = 0;
let kingsSize = 1;
let siegeInitiatorUsername = null;
let siegeTargetName = null;
let siegeActive = false;
let siegeParticipants = new Set();
let siegeTimeout;
let selectedTargets = {};

const initContent =
  "Test message to Knight.\n" +
  "**Abilities:**\n" +
  "- **Cut down**: Description goes here.\n" +
  "- **Writ**: Description goes here.\n" +
  "- **Join Siege**: Siege a king to make him a poop.";

function showErrorMsg(err) {
  console.error("ERROR: knight_commands.js", err);
}

async function setupKnightBotEvents(client, lastMessageId) {
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    if (
      oldMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
      oldMember.roles.cache.has(process.env.ROLEID_SCHOLAR) ||
      oldMember.roles.cache.has(process.env.ROLEID_MERCHANT) ||
      oldMember.roles.cache.has(process.env.ROLEID_NOBLE) ||
      oldMember.roles.cache.has(process.env.ROLEID_LORD) ||
      oldMember.roles.cache.has(process.env.ROLEID_KING)
    ) {
      await CacheCheckAndUpdateUserWrits(oldMember.id);
      for (let userId in selectedTargets) {
        if (
          selectedTargets[userId] &&
          selectedTargets[userId].id === oldMember.id
        ) {
          delete selectedTargets[userId];
          console.log(
            `Removed ${oldMember.user.username} from Cut Dowm targets`
          );
        }
      }
    }
    if (
      oldMember.roles.cache.has(process.env.ROLEID_PEASANT) ||
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
      newMember.roles.cache.has(process.env.ROLEID_KING)
    ) {
      await updateSelectMenu(client, lastMessageId);
    }

    const hadRoleBeforeKnight = oldMember.roles.cache.has(
      process.env.ROLEID_KNIGHT
    );
    const hasRoleNowKnight = newMember.roles.cache.has(
      process.env.ROLEID_KNIGHT
    );

    if (siegeActive && hadRoleBeforeKnight && !hasRoleNowKnight) {
      if (siegeParticipants.has(newMember.id)) {
        try {
          siegeParticipants.delete(newMember.id);
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
          knightsSize = knights.size;
          const kings = guild.members.cache.filter((member) =>
            member.roles.cache.has(process.env.ROLEID_KING)
          );
          kingsSize = kings.size;

          const channel = await client.channels.fetch(
            process.env.CHANNELIDKNIGHT
          );
          const messageToEdit = await channel.messages.fetch(lastMessageId);
          let content;
          if (siegeActive) {
            content =
              initContent +
              `\nKing @${siegeInitiatorUsername} initiated a siege. Join siege to downgrade ${siegeTargetName}. (Joined ${siegeParticipants.size} / ${knightsSize}.)`;
            const success = siegeParticipants.size >= knightsSize / kingsSize;
            if (success) {
              siegeActive = false;
              ceaseSiege(client, messageToEdit);
              return;
            }
            eventEmitter.emit(
              "KnightParticipatedOnSiege",
              siegeParticipants.size,
              knightsSize
            );
          }

          await messageToEdit.edit({
            content,
          });
        } catch (err) {
          showErrorMsg(err);
        }
      }
    }
  });
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
    const userId = interaction.user.id;
    if (interaction.customId === "SelectCutDown") {
      let selectedTargetId = interaction.values[0];
      try {
        selectedTargets[userId] = await interaction.guild.members.cache.get(
          selectedTargetId
        );
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
        const requiresWrit =
          targetRoles.has(process.env.ROLEID_KNIGHT) ||
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
          else if (hasWrit3 && !targetRoles.has(process.env.ROLEID_KING))
            validWrit = 3;
          else if (
            hasWrit2 &&
            !targetRoles.has(process.env.ROLEID_LORD) &&
            !targetRoles.has(process.env.ROLEID_KING)
          )
            validWrit = 2;

          if (!validWrit) {
            await sendInteractionReply(
              interaction,
              "Target only available with appropriate writ"
            );
            return;
          }

          // Execute writ
          await executeCutDown(
            interaction,
            userId,
            targetId,
            userXP,
            validWrit,
            client
          );
        } else {
          // No writ required
          const activeWrit = await CacheCheckActiveWrit(userId, targetId);
          if (activeWrit) {
            await executeCutDown(
              interaction,
              userId,
              targetId,
              userXP,
              activeWrit
            );
          } else {
            if (userXP < CutDownCost) {
              await sendInteractionReply(
                interaction,
                `Not enough XP (current XP: ${userXP})`
              );
              return;
            }
            await DBUpdateXP(userId, -CutDownCost, client);
            await performCutDown(interaction, targetId);
            await sendInteractionReply(
              interaction,
              `(${
                userXP - CutDownCost
              } XP left) Cut Down successful with no writ`
            );
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

    if (interaction.customId === "JoinSiege") {
      try {
        if (!siegeActive) {
          await sendInteractionReply(
            interaction,
            "There is no active siege to join."
          );
          return;
        }

        const userId = interaction.user.id;

        if (siegeParticipants.has(userId)) {
          await sendInteractionReply(
            interaction,
            "You've already joined this siege."
          );
          return;
        }

        siegeParticipants.add(userId);
        await sendInteractionReply(interaction, "You have joind the siege.");

        const channel = await client.channels.fetch(
          process.env.CHANNELIDKNIGHT
        );
        const messageToEdit = await channel.messages.fetch(lastMessageId);
        const success = siegeParticipants.size >= knightsSize / kingsSize;
        if (siegeActive && success) {
          siegeActive = false;
          ceaseSiege(client, messageToEdit);
          return;
        } else {
          const editedContent =
            initContent +
            `\nKing @${siegeInitiatorUsername} initiated a siege. Join siege to downgrade ${siegeTargetName}. (Joined ${siegeParticipants.size} / ${knightsSize}.)`;

          await messageToEdit.edit({ content: editedContent });
          eventEmitter.emit(
            "KnightParticipatedOnSiege",
            siegeParticipants.size,
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
        siegeActive = true;
        siegeInitiatorUsername = initiatorUsername;
        siegeTargetName = targetName;

        const messageToEdit = await channel.messages.fetch(lastMessageId);
        const content =
          initContent +
          `\nKing @${initiatorUsername} initiated a siege. Join siege to downgrade ${targetName}.`;
        const existingComponents = messageToEdit.components.map((component) =>
          ActionRowBuilder.from(component.toJSON())
        );
        const btnRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("CutDown")
            .setLabel("Cut Down")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("JoinSiege")
            .setLabel("Join Siege")
            .setStyle(ButtonStyle.Primary)
        );
        existingComponents[1] = btnRow;
        await messageToEdit.edit({
          content,
          components: existingComponents,
        });

        startSiege(client, messageToEdit, SiegeTime);
      }
    } catch (err) {
      showErrorMsg(err);
    }
  });
  eventEmitter.on("siegeResult", async (message, status) => {
    try {
      if (status === "early") {
        const channel = await client.channels.fetch(
          process.env.CHANNELIDKNIGHT
        );
        const messageToEdit = await channel.messages.fetch(lastMessageId);
        ceaseSiege(client, messageToEdit);
      }
      eventEmitter.emit("NotifyKnightChannel", message);
    } catch (err) {
      showErrorMsg(err);
    }
  });
  eventEmitter.on("NotifyKnightChannel", async (content) => {
    try {
      let channel = await client.channels.fetch(process.env.CHANNELIDKNIGHT);
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

async function startSiege(client, messageToEdit, timeout) {
  siegeTimeout = setTimeout(async () => {
    await handleSiegeEnd(client, messageToEdit);
  }, timeout);
}

async function handleSiegeEnd(client, messageToEdit) {
  siegeActive = false;
  eventEmitter.emit("SiegeFinished", siegeParticipants.size, knightsSize);
  eventEmitter.emit("NotifyKnightChannel", "Siege finished.");
  await resetComponents(client, messageToEdit);
}

// Function to trigger the siege early
async function ceaseSiege(client, messageToEdit) {
  if (siegeTimeout) {
    clearTimeout(siegeTimeout); // Clear the original timeout
    await handleSiegeEnd(client, messageToEdit); // Manually trigger siege logic
  }
}

async function handleShowWrits(interaction) {
  try {
    const knightId = interaction.user.id;
    const writs = await CacheGetKnightWrits(knightId);

    if (writs.length === 0) {
      await sendInteractionReply(interaction, "You have no active writs.");
      return;
    }

    const writDescriptions = writs.map((writ, index) => {
      return `${index + 1}. Type: ${getWritType(writ.writType)}, Target: <@${
        writ.targetId
      }>, Status: ${getWritStatus(writ.writStatus)}, Message: ${
        writ.writMessage
      }`;
    });

    const response = `Your active writs:\n\n${writDescriptions.join("\n")}`;

    await sendInteractionReply(interaction, response);
  } catch (error) {
    console.error("Error in handleShowWrits:", error);
    await sendInteractionReply(
      interaction,
      "An error occurred while fetching your writs."
    );
  }
}
function getWritType(writType) {
  switch (writType) {
    case 1:
      return "High";
    case 2:
      return "Eminent";
    case 3:
      return "Royal";
    case 4:
      return "Imperial";
    default:
      throw new Error("Invalid writ type");
  }
}
function getWritStatus(status) {
  switch (status) {
    case 0:
      return "to be executed";
    case 1:
      return "Executed";
    case 2:
      return "Failed";
    case 3:
      return "Anulled, knight or target have changed roles";
    default:
      showErrorMsg("Writ status incorrect");
  }
}

async function executeCutDown(interaction, userId, targetId, userXP, client) {
  const cooldown = await CacheGetCooldown("cutdown", userId);
  if (cooldown) {
    await sendInteractionReply(
      interaction,
      "Cut Down is on cooldown and cannot be used"
    );
    return;
  }

  // Get all active writs for this knight and target
  const activeWrits = await CacheGetKnightWrits(userId);
  const relevantWrits = activeWrits.filter(
    (writ) => writ.targetId === targetId && writ.writStatus === 0
  );

  if (relevantWrits.length === 0) {
    // No writs found, proceed with normal Cut Down
    if (userXP < CutDownCost) {
      await sendInteractionReply(
        interaction,
        `Not enough XP (current XP: ${userXP})`
      );
      return;
    }
    await DBUpdateXP(userId, -CutDownCost, client);
    await performCutDown(interaction, targetId);
    await sendInteractionReply(
      interaction,
      `(${userXP - CutDownCost} XP left) Cut Down successful with no writ`
    );
    return;
  }

  // Calculate total XP reward
  let totalXpReward = 0;
  for (const writ of relevantWrits) {
    let xpReward;
    switch (writ.writType) {
      case 1:
        xpReward = HighWritReward;
        break;
      case 2:
        xpReward = EminentWritReward;
        break;
      case 3:
        xpReward = RoyalWritReward;
        break;
      case 4:
        xpReward = ImperialWritReward;
        break;
      default:
        showErrorMsg("Writ type incorrect");
    }
    totalXpReward += xpReward;

    // Update writ status
    await CacheUpdateWritStatus(
      writ.writType,
      writ.writerId,
      userId,
      targetId,
      1
    );
  }

  // Apply XP reward and perform Cut Down
  await DBUpdateXP(userId, totalXpReward, client);
  await CacheSetCooldown("cutdown", userId, CutDownCooldown);
  await performCutDown(interaction, targetId);

  const newXP = parseInt(userXP) + totalXpReward;
  const writDetails = relevantWrits
    .map((writ) => `type ${writ.writType}`)
    .join(", ");
  await sendInteractionReply(
    interaction,
    `(${newXP} XP) Cut Down successful. Executed ${relevantWrits.length} writ(s): ${writDetails}. Total reward: ${totalXpReward} XP`
  );
}
async function performCutDown(interaction, targetId) {
  const target = await interaction.guild.members.fetch(targetId);
  eventEmitter.emit("changeRole", target, "Poop");
  eventEmitter.emit(
    "CutDownComplete",
    target.user.username,
    interaction.user.username
  );
}

async function updateSelectMenu(client, lastMessageId) {
  try {
    const channel = await client.channels.fetch(process.env.CHANNELIDKNIGHT);
    const messageToEdit = await channel.messages.fetch(lastMessageId);
    const selectMenu = await buildSelectMenu(
      client,
      ["peasant", "scholar", "merchant", "noble", "lord", "king"],
      "SelectCutDown"
    );
    const actionRow_0 = new ActionRowBuilder().addComponents(selectMenu);
    const existingComponents = messageToEdit.components.map((component) =>
      ActionRowBuilder.from(component.toJSON())
    );
    existingComponents[0] = actionRow_0;

    if (siegeActive) {
      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("CutDown")
          .setLabel("Cut Down")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("JoinSiege")
          .setLabel("Join Siege")
          .setStyle(ButtonStyle.Primary)
      );
      existingComponents[1] = btnRow;
    } else {
      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("CutDown")
          .setLabel("Cut Down")
          .setStyle(ButtonStyle.Primary)
      );
      existingComponents[1] = btnRow;
    }

    await messageToEdit.edit({
      content: messageToEdit.content,
      components: existingComponents,
    });
  } catch (err) {
    showErrorMsg(err);
  }
}

async function messageKnightCommands(client) {
  let channel = null;
  try {
    channel = await client.channels.fetch(process.env.CHANNELIDKNIGHT);
    const cutDownSelectMenu = new ActionRowBuilder().addComponents(
      await buildSelectMenu(
        client,
        ["peasant", "scholar", "merchant", "noble", "lord", "king"],
        "SelectCutDown"
      )
    );
    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("CutDown")
        .setLabel("Cut Down")
        .setStyle(ButtonStyle.Primary)
    );
    const infoBtnRow = new ActionRowBuilder().addComponents(
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

async function resetComponents(client, messageToEdit) {
  try {
    siegeActive = false;
    siegeInitiatorUsername = "";
    siegeTargetName = "";
    siegeParticipants.clear();
    knightsSize = 1;
    knights = [];

    const cutDownSelectMenu = new ActionRowBuilder().addComponents(
      await buildSelectMenu(
        client,
        ["peasant", "scholar", "merchant", "noble", "lord", "king"],
        "SelectCutDown"
      )
    );
    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("CutDown")
        .setLabel("Cut Down")
        .setStyle(ButtonStyle.Primary)
    );
    const infoBtnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ShowWrits")
        .setLabel("Read yer writs")
        .setStyle(ButtonStyle.Danger)
    );

    await messageToEdit.edit({
      content: initContent,
      components: [cutDownSelectMenu, btnRow, infoBtnRow],
    });
  } catch (err) {
    throw err;
  }
}

module.exports = { setupKnightBotEvents, messageKnightCommands };
