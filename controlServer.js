import {
  Events,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { exec } from "child_process";
import dotenv from "dotenv";
dotenv.config();
import fs from "fs";

const CONTROL_GUILD_ID = process.env.CONTROL_GUILD_ID;
const OWNER_ID = process.env.OWNER_ID;
const CONTROL_CHANNEL_NAMES = process.env.CONTROL_CHANNEL_NAMES
  ? process.env.CONTROL_CHANNEL_NAMES.split(",").map((n) => n.trim())
  : [];

const resolvedChannels = {}; // { channelName: { id, name, channelObj } }
let envVars = "";

const controlServer = {
  async init(client, allcommands) {
    // ========== ON BOT READY ==========
    client.once("ready", async () => {
      try {
        const guild = await client.guilds.fetch(CONTROL_GUILD_ID);
        const channels = await guild.channels.fetch();

        for (const name of CONTROL_CHANNEL_NAMES) {
          const match = [...channels.values()].find(
            (ch) =>
              ch &&
              ch.type === ChannelType.GuildText &&
              ch.name.toLowerCase() === name.toLowerCase()
          );

          if (match) {
            resolvedChannels[name.toLowerCase()] = {
              id: match.id,
              name: match.name,
              channelObj: match,
            };

            if (name.toLowerCase() === "config") {
              await sendConfigEmbed(match);
            }
          } else {
            console.warn(`⚠️ Channel "${name}" not found in guild.`);
          }
        }
      } catch (err) {
        console.error("❌ Error resolving control channels:", err);
      }
    });

    // ========== COMMAND HANDLING ==========
    client.on(Events.MessageCreate, async (message) => {
      if (
        message.author.bot ||
        !message.guild ||
        message.guild.id !== CONTROL_GUILD_ID ||
        !Object.values(resolvedChannels).some(
          (c) => c.id === message.channel.id
        )
      ) {
        return;
      }

      const [cmd, ...args] = message.content.trim().split(" ");

      if (cmd.toLowerCase() === "!status") {
        return message.reply("✅ Agent-CC is online and ready.");
      }

      if (cmd.toLowerCase() === "!say") {
        const text = args.join(" ");
        if (text) {
          await message.channel.send(text);
        } else {
          await message.reply("⚠️ You must provide a message.");
        }
      }

      if (cmd.toLowerCase() === "!deleteall") {
        const text = args.join(" ");
        const count = parseInt(text);
        if (isNaN(count) || count <= 0) {
          return message.reply(
            "⚠️ Provide a valid number of messages to delete."
          );
        }

        const safeCount = count > 100 ? 100 : count; // Discord API limit is 100 messages at a time
        try {
          const messages = await message.channel.messages.fetch({
            limit: safeCount,
          });
          await message.channel.bulkDelete(messages, true);
          message.channel
            .send(`🧹 Deleted ${safeCount} messages.`)
            .then((msg) => setTimeout(() => msg.delete(), 3000));
        } catch (err) {
          console.error("❌ Error deleting messages:", err);
          message.reply("❌ Couldn't delete messages. Missing permissions?");
        }
      }
    });

    // ========== BUTTON INTERACTIONS ==========
    client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isButton()) {
        const isFromControl = Object.values(resolvedChannels).some(
          (c) => c.id === interaction.channelId
        );
        if (!isFromControl) return;

        const { customId, user } = interaction;

        // ----- CONFIG CATEGORY VIEWS -----
        if (customId === "config_general") {
          const embed = new EmbedBuilder()
            .setTitle("⚙️ General Settings")
            .setDescription("Configure basic bot behaviors here.")
            .setColor("Blurple");

          return interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
          });
        }

        if (customId === "config_permissions") {
          const embed = new EmbedBuilder()
            .setTitle("🔒 Permissions")
            .setDescription("Manage who can access what commands.")
            .setColor("Blurple");

          return interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
          });
        }

        if (customId === "config_labels") {
          const embed = new EmbedBuilder()
            .setTitle("📛 Labels")
            .setDescription("Set custom tags, names, or system labels.")
            .setColor("Blurple");

          return interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
          });
        }

        // ----- SYSTEM: RESTART CONFIRMATION -----
        if (customId === "restart_bot") {
          if (user.id !== OWNER_ID) {
            return interaction.reply({
              content: "🚫 You don't have permission to restart the bot.",
              flags: MessageFlags.Ephemeral,
            });
          }

          const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("confirm_restart")
              .setLabel("✅ Confirm Restart")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId("cancel_restart")
              .setLabel("❌ Cancel")
              .setStyle(ButtonStyle.Secondary)
          );

          const confirmEmbed = new EmbedBuilder()
            .setTitle("⚠️ Confirm Restart")
            .setDescription("Are you sure you want to restart the bot?")
            .setColor("Orange");

          return interaction.reply({
            embeds: [confirmEmbed],
            components: [confirmRow],
            flags: MessageFlags.Ephemeral,
          });
        }

        // ----- SYSTEM: ACTUALLY RESTART -----
        if (customId === "confirm_restart") {
          if (user.id !== OWNER_ID) {
            return interaction.reply({
              content: "🚫 You can't confirm this action.",
              flags: MessageFlags.Ephemeral,
            });
          }

          await interaction.update({
            content: "♻️ Restarting bot via PM2...",
            embeds: [],
            components: [],
          });

          exec("pm2 restart discordbot", (error, stdout, stderr) => {
            if (error) console.error(`❌ Restart error: ${error.message}`);
            if (stderr) console.error(`⚠️ Restart stderr: ${stderr}`);
          });
        }

        // ----- CANCEL RESTART -----
        if (customId === "cancel_restart") {
          await interaction.update({
            content: "❌ Restart cancelled.",
            embeds: [],
            components: [],
          });
        }

        // ----- SYSTEM: UPDATE BOT -----
        if (customId === "pull_changes") {
          // Check if the user has permission (optional but HIGHLY recommended)
          const allowedUserIds = [process.env.OWNER_ID];
          if (!allowedUserIds.includes(interaction.user.id)) {
            return interaction.reply({
              content: "🚫 You don't have permission to update the bot.",
              flags: MessageFlags.Ephemeral,
            });
          }

          await interaction.reply({
            content: "🔄 Pulling changes and updating the bot...",
            flags: MessageFlags.Ephemeral,
          });

          exec(
            "git pull && npm install && pm2 restart discordbot",
            (err, stdout, stderr) => {
              if (err) {
                console.error("Update error:", err);
                return interaction.followUp({
                  content: `❌ Update failed:\n\`\`\`${stderr}\`\`\``,
                  flags: MessageFlags.Ephemeral,
                });
              }

              interaction.followUp({
                content: `✅ Update complete:\n\`\`\`${stdout}\`\`\``,
                flags: MessageFlags.Ephemeral,
              });
            }
          );
        }

        if (customId === "guilds_info") {
          const guilds = client.guilds.cache.map(
            (g) =>
              "**" +
              g.name +
              "** `" +
              g.id +
              "`" +
              "~ Members: " +
              g.memberCount
          );
          const embed = new EmbedBuilder()
            .setTitle("📊 Guilds Info")
            .setDescription(guilds.join("\n") || "No guilds found.")
            .setColor("Green");

          return interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
          });
        }

        if (customId === "registered_commands") {
          const commands = allcommands.map(
            (cmd) => `**${cmd.commandName1}**: ${cmd.description}`
          );

          const embed = new EmbedBuilder()
            .setTitle("📜 Registered Commands")
            .setDescription(commands?.join("\n") || "No commands registered.")
            .setColor("Green");

          return interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
          });
        }

        if (customId === "config_env") {
          if (user.id !== OWNER_ID) {
            return interaction.reply({
              content:
                "🚫 You don't have permission to manage environment variables.",
              flags: MessageFlags.Ephemeral,
            });
          }

          envVars = fs.readFileSync(".env", "utf8");

          const embed = new EmbedBuilder()
            .setTitle("🌍 Environment Variables")
            .setDescription(envVars || "No environment variables set.")
            .setColor("Blurple");
          const actionierRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("edit_env")
              .setLabel("Edit")
              .setStyle(ButtonStyle.Danger)
          );

          return interaction.reply({
            embeds: [embed],
            components: [actionierRow],
            flags: MessageFlags.Ephemeral,
          });
        }

        if (customId === "edit_env") {
          const modal = new ModalBuilder()
            .setCustomId("edit_env_modal")
            .setTitle("Edit Environment Variable");


          const input = new TextInputBuilder()
            .setCustomId("env_content")
            .setLabel("Paste updated .env content")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setValue(envVars);

          const actionRow = new ActionRowBuilder().addComponents(input);
          modal.addComponents(actionRow);

          await interaction.showModal(modal);
        }

        if (customId === "stop_bot") {
          if (user.id !== OWNER_ID) {
            return interaction.reply({
              content: "🚫 You don't have permission to stop the bot.",
              flags: MessageFlags.Ephemeral,
            });
          }

          await interaction.reply({
            content: "🛑 Stopping bot via PM2...",
            flags: MessageFlags.Ephemeral,
          });

          exec("pm2 stop discordbot", (error, stdout, stderr) => {
            if (error) {
              console.error(`❌ Stop error: ${error.message}`);
              return interaction.followUp({
                content: `❌ Stop failed:\n\`\`\`${stderr}\`\`\``,
                flags: MessageFlags.Ephemeral,
              });
            }

            interaction.followUp({
              content: `✅ Bot stopped successfully:\n\`\`\`${stdout}\`\`\``,
              flags: MessageFlags.Ephemeral,
            });
          });
        }

        if (customId === "guilds_invites") {
          const invitesInfo = await Promise.all(
            client.guilds.cache.map(async (guild) => {
              try {
                const textChannel = guild.channels.cache.find(
                  (c) => c.type === 0 && c.viewable
                );

                if (!textChannel) {
                  return `❌ **${guild.name}** — No valid channel for invite.`;
                }

                const invite = await textChannel.createInvite({
                  maxAge: 0,
                  maxUses: 0,
                  unique: true,
                  reason: "Requested by control panel",
                });

                return `✅ **${guild.name}** — [Invite Link](https://discord.gg/${invite.code})`;
              } catch (err) {
                return `⚠️ **${guild.name}** — Error: ${err.message}`;
              }
            })
          );

          const embed = new EmbedBuilder()
            .setTitle("🔗 Guild Invite Links")
            .setDescription(invitesInfo.join("\n"))
            .setColor("Blue");

          return interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      // ----- HANDLE MODAL SUBMISSION -----
      if (
        interaction.isModalSubmit() &&
        interaction.customId === "edit_env_modal"
      ) {
        if (interaction.user.id !== OWNER_ID) {
          return interaction.reply({
            content: "🚫 You're not authorized to edit the environment.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const updatedEnv = interaction.fields.getTextInputValue("env_content");

        try {
          // Optional backup
          fs.writeFileSync(".env.bak", fs.readFileSync(".env", "utf8"));
          fs.writeFileSync(".env", updatedEnv);

          await interaction.reply({
            content: "✅ `.env` updated successfully. Restart if needed.",
            flags: MessageFlags.Ephemeral,
          });

          exec("pm2 restart discordbot", (err, stdout, stderr) => {
            if (err) console.error("Restart error:", err);
          });
        } catch (err) {
          console.error("❌ ENV write error:", err);
          await interaction.reply({
            content: "❌ Failed to update `.env`. Check logs.",
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    });

    // ========== CONFIG EMBED SENDER ==========
    async function sendConfigEmbed(channel) {
      try {
        // 🧹 Clear all messages (up to 100 at a time, can loop if needed)
        const messages = await channel.messages.fetch({ limit: 100 });
        if (messages.size > 0) {
          await channel.bulkDelete(messages, true); // true ignores old messages
        }

        const configEmbed = new EmbedBuilder()
          .setTitle("🛠 Bot Configuration & Actions")
          .setDescription("Select a category to manage the bot's settings.")
          .setColor("Blue");

        const configRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("config_general")
            .setLabel("⚙️ General Settings")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("config_permissions")
            .setLabel("🔒 Permissions")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("config_env")
            .setLabel("🌍 Environment Variables")
            .setStyle(ButtonStyle.Danger)
        );

        const systemRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("restart_bot")
            .setLabel("🔄 Restart Bot")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId("pull_changes")
            .setLabel("⬆️ Update")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("stop_bot")
            .setLabel("🛑 Stop Bot")
            .setStyle(ButtonStyle.Danger)
        );

        const infoRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("guilds_info")
            .setLabel("📊 Guilds Info")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("registered_commands")
            .setLabel("📜 Registered Commands")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("guilds_invites")
            .setLabel("🔗 Server Invites")
            .setStyle(ButtonStyle.Success)
        );

        await channel.send({
          embeds: [configEmbed],
          components: [configRow, systemRow, infoRow],
        });
      } catch (err) {
        console.error(
          `❌ Failed to send config embed to #${channel.name}:`,
          err
        );
      }
    }
  },
};

export default controlServer;
