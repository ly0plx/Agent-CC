// settingsManager.js

import { ChannelType, PermissionsBitField } from "discord.js";

let cachedSettings = null;
let cachedMessage = null;

async function loadSettings(client, guildId) {
  const guild = await client.guilds.fetch(guildId);
  let settingsChannel = guild.channels.cache.find(c => c.name === '_bot-settings');
  if (!settingsChannel) {
    settingsChannel = await guild.channels.create({
      name: '_bot-settings',
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
        },
        {
          id: client.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        }
      ]
    })
  };

  // Fetch last message with settings JSON
  const messages = await settingsChannel.messages.fetch({ limit: 1 });
  const settingsMsg = messages.first();
  if (!settingsMsg) throw new Error('Settings message not found');

  cachedMessage = settingsMsg;

  try {
    cachedSettings = JSON.parse(settingsMsg.content.replace(/```json|```/g, '').trim());
  } catch {
    cachedSettings = {};
  }
  return cachedSettings;
}

async function getSettings(client, guildId) {
  if (cachedSettings) return cachedSettings;
  return loadSettings(client, guildId);
}

async function updateSettings(newSettings) {
  if (!cachedMessage) throw new Error('Settings message not cached');

  cachedSettings = newSettings;
  await cachedMessage.edit("```json\n" + JSON.stringify(newSettings, null, 2) + "\n```");
}

export default {
  loadSettings,
  getSettings,
  updateSettings
};
