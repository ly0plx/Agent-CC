import { Events } from "discord.js";

const FORWARD_TO_GUILD_ID = "1387855871375184002";
const FORWARD_TO_CHANNEL_ID = "1388276061090873465";

const mentionRelay = {
  name: Events.MessageCreate,

  async execute(message) {
    const client = message.client;

    if (message.author.bot) return;
    if (message.channelId === FORWARD_TO_CHANNEL_ID) return;

    if (message.mentions.has(client.user)) {
      try {
        const forwardGuild = await client.guilds.fetch(FORWARD_TO_GUILD_ID);
        const forwardChannel = await forwardGuild.channels.fetch(
          FORWARD_TO_CHANNEL_ID
        );

        if (!forwardChannel?.isTextBased()) {
          console.error(
            `Invalid or non-text channel: ${FORWARD_TO_CHANNEL_ID}`
          );
          return;
        }

        // Create a thread inside the relay feed channel
        const thread = await forwardChannel.threads.create({
          name: `Mention from ${message.author.tag}`,
          autoArchiveDuration: 60,
          reason: "Bot was mentioned. Creating relay thread.",
        });

        const relayText =
          `📨 Mention detected!\n` +
          `From: **${message.author.tag}**\n` +
          `Server: **${message.guild?.name ?? "DMs"}**\n` +
          `Channel: **#${message.channel.name}**\n` +
          `Message: > ${message.content}\n` +
          `Jump: ${message.url}`;

        await thread.send(relayText);

        // Track this thread as connected to original message
        mentionRelay._relays.set(thread.id, {
          channelId: message.channel.id,
          messageId: message.id,
        });
      } catch (err) {
        console.error("Error forwarding message to thread:", err);
      }
    }
  },

  _relays: new Map(),

  listenToReplies(client) {
    client.on(Events.MessageCreate, async (message) => {
      const thread = message.channel;

      if (!thread.isThread()) return;
      if (message.author.bot) return;

      const original = mentionRelay._relays.get(thread.id);
      if (!original) return;

      try {
        const originalChannel = await client.channels.fetch(original.channelId);
        if (!originalChannel?.isTextBased()) return;

        const sendPayload = {
          content: message.content,
        };

        if (!original.repliedOnce) {
          // First time → reply to original message
          sendPayload.reply = { messageReference: original.messageId };
          original.repliedOnce = true;
          mentionRelay._relays.set(thread.id, original); // update it
        }

        await originalChannel.send(sendPayload);
      } catch (err) {
        console.error("Failed to relay thread message back:", err);
      }
    });
  },
};

export default mentionRelay;
