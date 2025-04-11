import { Events } from 'discord.js';

// Replace with the actual Discord tag (e.g., 'ly0plx#1234')
const FORWARD_TO_TAG = 'ly0plx';

const mentionRelay = {
  name: Events.MessageCreate,

  async execute(message) {
    const client = message.client;

    if (message.author.bot) return;

    if (message.mentions.has(client.user)) {
      console.log('Bot mentioned in:', message.content);

      // Find the user by Discord tag (username#discriminator)
      const forwardToUser = client.users.cache.find(user => user.tag === FORWARD_TO_TAG);
      if (!forwardToUser) {
        console.error(`User with tag "${FORWARD_TO_TAG}" not found.`);
        return;
      }

      console.log('Forwarding message to:', forwardToUser.tag);

      try {
        const relayText = `📨 You were mentioned in **#${message.channel.name}** (in ${message.guild?.name ?? 'DMs'}):\n> ${message.content}\n\nReply to this message to respond.`;
        const dm = await forwardToUser.send(relayText);
        
        // Log that the message was successfully sent
        console.log('Message sent to user:', relayText);

        // Save the DM reply reference
        mentionRelay._relays.set(dm.id, {
          channelId: message.channel.id,
          messageId: message.id,
        });

        console.log(`Saved relay data for message ID ${dm.id}:`, mentionRelay._relays.get(dm.id));
      } catch (err) {
        console.error('Error forwarding message:', err);
      }
    }
  },

  _relays: new Map(),

  listenToReplies(client) {
    client.on(Events.MessageCreate, async (message) => {
      if (!message.guild && message.author.tag === FORWARD_TO_TAG) {
        console.log('Reply detected from target user:', message.content);

        // Log the message reference details
        console.log('Message reference details:', message.reference);

        // Check if the message is a reply
        if (!message.reference) {
          console.log('This is not a reply! Checking if it matches the original DM message...');

          // Check if the message is the first reply to the forwarded message
          const originalMessage = [...mentionRelay._relays.values()].find(data => data.messageId === message.reference?.messageId);
          if (!originalMessage) {
            console.log('This is the first response. Matching the DM...');
            // First response (not technically a reply), but treat it as a reply
            const dmId = message.id;
            const original = mentionRelay._relays.get(dmId);
            if (!original) {
              console.log('Could not find the original message.');
              return;
            }

            try {
              const channel = await client.channels.fetch(original.channelId);
              if (!channel.isTextBased()) return;

              console.log(`Replying to original message in channel: ${channel.id}`);
              await channel.send({
                content: message.content,
                reply: { messageReference: original.messageId }
              });
            } catch (err) {
              console.error('Failed to send reply to original message:', err);
            }
          }
          return;
        }

        const referenceMessageId = message.reference.messageId;
        console.log(`Replying to message with reference ID: ${referenceMessageId}`);

        // Retrieve the original message data from the relay map
        const original = mentionRelay._relays.get(referenceMessageId);
        if (!original) {
          console.log('Could not find original message data for reply.');
          return;
        }

        console.log('Found original message data:', original);

        try {
          const channel = await client.channels.fetch(original.channelId);
          if (!channel.isTextBased()) return;

          console.log(`Replying to original message in channel: ${channel.id}`);

          // Reply to the original message in the channel
          await channel.send({
            content: message.content,
            reply: { messageReference: original.messageId }
          });

          // Optional: Clean up relay data (if you don't want to keep it)
          mentionRelay._relays.delete(referenceMessageId);
          console.log(`Deleted relay data for message ID: ${referenceMessageId}`);
        } catch (err) {
          console.error('Failed to send reply to original message:', err);
        }
      }
    });
  }
};

export default mentionRelay;
