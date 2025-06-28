import {
    Events,
    ChannelType,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    EmbedBuilder,
} from "discord.js";
import { exec } from "child_process";
import dotenv from "dotenv";
dotenv.config();

const CONTROL_GUILD_ID = process.env.CONTROL_GUILD_ID;
const OWNER_ID = process.env.OWNER_ID;
const CONTROL_CHANNEL_NAMES = process.env.CONTROL_CHANNEL_NAMES
    ? process.env.CONTROL_CHANNEL_NAMES.split(",").map((n) => n.trim())
    : [];

const resolvedChannels = {}; // { channelName: { id, name, channelObj } }

const controlServer = {
    async init(client) {
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
                !Object.values(resolvedChannels).some((c) => c.id === message.channel.id)
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
                const count = parseInt(args[0]);
                if (isNaN(count) || count <= 0) {
                    return message.reply("⚠️ Provide a valid number of messages to delete.");
                }

                const safeCount = Math.min(count, 100);
                try {
                    const messages = await message.channel.messages.fetch({ limit: safeCount + 1 });
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
            if (!interaction.isButton()) return;

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

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (customId === "config_permissions") {
                const embed = new EmbedBuilder()
                    .setTitle("🔒 Permissions")
                    .setDescription("Manage who can access what commands.")
                    .setColor("Blurple");

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (customId === "config_labels") {
                const embed = new EmbedBuilder()
                    .setTitle("📛 Labels")
                    .setDescription("Set custom tags, names, or system labels.")
                    .setColor("Blurple");

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // ----- SYSTEM: RESTART CONFIRMATION -----
            if (customId === "restart_bot") {
                if (user.id !== OWNER_ID) {
                    return interaction.reply({
                        content: "🚫 You don't have permission to restart the bot.",
                        ephemeral: true,
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
                    ephemeral: true,
                });
            }

            // ----- SYSTEM: ACTUALLY RESTART -----
            if (customId === "confirm_restart") {
                if (user.id !== OWNER_ID) {
                    return interaction.reply({
                        content: "🚫 You can't confirm this action.",
                        ephemeral: true,
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
                    console.log(`✅ Restart stdout: ${stdout}`);
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
        });

        // ========== CONFIG EMBED SENDER ==========
        async function sendConfigEmbed(channel) {
            try {
                // 🧹 Clear all messages (up to 100 at a time, can loop if needed)
                const messages = await channel.messages.fetch({ limit: 100 });
                if (messages.size > 0) {
                    await channel.bulkDelete(messages, true); // true ignores old messages
                    console.log(`🧼 Cleared ${messages.size} messages in #${channel.name}`);
                }

                const configEmbed = new EmbedBuilder()
                    .setTitle("🛠 Bot Configuration")
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
                        .setCustomId("config_labels")
                        .setLabel("📛 Labels")
                        .setStyle(ButtonStyle.Success)
                );

                const systemRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("restart_bot")
                        .setLabel("🔄 Restart Bot")
                        .setStyle(ButtonStyle.Danger)
                );

                await channel.send({
                    embeds: [configEmbed],
                    components: [configRow, systemRow],
                });
                console.log(`✅ Config UI sent to #${channel.name}`);
            } catch (err) {
                console.error(`❌ Failed to send config embed to #${channel.name}:`, err);
            }
        }
    },
};

export default controlServer;
