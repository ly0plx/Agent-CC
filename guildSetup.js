import {
  ChannelType,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelSelectMenuBuilder
} from 'discord.js';

export default (client) => {
  client.on('guildCreate', async (guild) => {
    try {
      let configChannel = guild.channels.cache.find(
        c => c.name === 'bot-config' && c.type === ChannelType.GuildText
      );

      if (!configChannel) {
        configChannel = await guild.channels.create({
          name: 'bot-config',
          type: ChannelType.GuildText,
          permissionOverwrites: [
            {
              id: guild.roles.everyone,
              deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
              id: guild.roles.cache.find(r => r.permissions.has(PermissionsBitField.Flags.Administrator))?.id || guild.ownerId,
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
            }
          ]
        });
      }

      let settingsChannel = guild.channels.cache.find(
        c => c.name === '_bot-settings' && c.type === ChannelType.GuildText
      );

      if (!settingsChannel) {
        settingsChannel = await guild.channels.create({
          name: '_bot-settings',
          type: ChannelType.GuildText,
          permissionOverwrites: [
            {
              id: guild.roles.everyone,
              deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
              id: guild.members.me.id,
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
            }
          ]
        });

        await settingsChannel.send("```json\n" + JSON.stringify({
          welcomeChannel: null,
          botAnnouncements: null,
          modLogs: null,
          suggestions: null,
          welcomeMessage: "Welcome to the server, {username}!",
          goodbyeMessage: "Goodbye {username}, we'll miss you!"
        }, null, 2) + "\n```");
      }

      await configChannel.send({
        embeds: [{
          title: 'Bot Configuration',
          description: 'Use the buttons below to configure the bot’s settings.',
          color: 0x5865F2
        }],
        components: [
          {
            type: 1,
            components: [
              { type: 2, style: 1, label: 'Set Channels', custom_id: 'set_channels' },
              { type: 2, style: 1, label: 'Edit Auto Messages', custom_id: 'edit_auto_messages' }
            ]
          }
        ]
      });

    } catch (err) {
      console.error(`Failed setup in ${guild.name}:`, err);
    }
  });

  client.on('interactionCreate', async (interaction) => {
    if (
      !interaction.isButton() &&
      !interaction.isChannelSelectMenu() &&
      !interaction.isModalSubmit()
    ) return;

    const guild = interaction.guild;
    if (!guild) return;

    const settingsChannel = guild.channels.cache.find(c => c.name === '_bot-settings');
    if (!settingsChannel) return;

    const messages = await settingsChannel.messages.fetch({ limit: 1 });
    const settingsMsg = messages.first();
    if (!settingsMsg) return;

    let json = {};
    try {
      json = JSON.parse(settingsMsg.content.replace(/```json|```/g, '').trim());
    } catch {
      json = {};
    }

    // BUTTONS
    if (interaction.isButton()) {
      if (interaction.customId === 'set_channels') {
        await interaction.update({
          embeds: [{
            title: 'Set Bot Channels',
            description: 'Select channels for each setting below.',
            color: 0x5865F2
          }],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('back_to_config')
                .setLabel('Back to Config')
                .setStyle(ButtonStyle.Primary)  // or whatever style you want
            ),
            new ActionRowBuilder().addComponents(
              new ChannelSelectMenuBuilder()
                .setCustomId('welcome_channel')
                .setChannelTypes([ChannelType.GuildText])
                .setPlaceholder('Set Welcome Channel')
                .setMinValues(1)
                .setMaxValues(1)
            ),
            new ActionRowBuilder().addComponents(
              new ChannelSelectMenuBuilder()
                .setCustomId('bot_announcements')
                .setChannelTypes([ChannelType.GuildText])
                .setPlaceholder('Set Bot Announcements Channel')
                .setMinValues(1)
                .setMaxValues(1)
            ),
            new ActionRowBuilder().addComponents(
              new ChannelSelectMenuBuilder()
                .setCustomId('mod_logs')
                .setChannelTypes([ChannelType.GuildText])
                .setPlaceholder('Set Moderation Logs Channel')
                .setMinValues(1)
                .setMaxValues(1)
            ),
            new ActionRowBuilder().addComponents(
              new ChannelSelectMenuBuilder()
                .setCustomId('suggestions')
                .setChannelTypes([ChannelType.GuildText])
                .setPlaceholder('Set Suggestions Channel')
                .setMinValues(1)
                .setMaxValues(1)
            )
            
          ]
      });
  return;
}

if (interaction.customId === 'edit_auto_messages') {
  const embed = new EmbedBuilder()
    .setTitle('Edit Auto Messages')
    .setDescription('Edit the automatic messages the bot sends. Use `{username}` as a placeholder for the user\'s name.')
    .setColor(0x5865F2);

  const components = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('edit_welcome_message')
        .setLabel('Edit Welcome Message')
        .setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('edit_goodbye_message')
        .setLabel('Edit Goodbye Message')
        .setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('reset_auto_messages')
        .setLabel('Reset to Default')
        .setStyle(ButtonStyle.Danger)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('back_to_config')
        .setLabel('Back to Config')
        .setStyle(ButtonStyle.Secondary)
    )
  ];

  await interaction.update({
    embeds: [embed],
    components
  });
  return;
}

if (interaction.customId === 'back_to_config') {
  await interaction.update({
    embeds: [{
      title: 'Bot Configuration',
      description: 'Use the buttons below to configure the bot’s settings.',
      color: 0x5865F2
    }],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('set_channels')
          .setLabel('Set Channels')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('edit_auto_messages')
          .setLabel('Edit Auto Messages')
          .setStyle(ButtonStyle.Primary)
      )
    ]
  });
  return;
}

if (interaction.customId === 'reset_auto_messages') {
  json.welcomeMessage = "Welcome to the server, {username}!";
  json.goodbyeMessage = "Goodbye {username}, we'll miss you!";
  await settingsMsg.edit("```json\n" + JSON.stringify(json, null, 2) + "\n```");
  await interaction.reply({ content: '✅ Auto messages reset to defaults.', ephemeral: true });
  return;
}

if (interaction.customId === 'edit_welcome_message' || interaction.customId === 'edit_goodbye_message') {
  const key = interaction.customId === 'edit_welcome_message' ? 'welcomeMessage' : 'goodbyeMessage';
  const modal = new ModalBuilder()
    .setCustomId(`modal_${key}`)
    .setTitle(`Edit ${key === 'welcomeMessage' ? 'Welcome' : 'Goodbye'} Message`);

  const input = new TextInputBuilder()
    .setCustomId('message_input')
    .setLabel('Message Template')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Example: Welcome to the server, {username}!')
    .setMinLength(5)
    .setMaxLength(1000)
    .setRequired(true)
    .setValue(json[key] || (key === 'welcomeMessage' ? 'Welcome to the server, {username}!' : "Goodbye {username}, we'll miss you!"));

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  await interaction.showModal(modal);
  return;
}
    }

// MODAL SUBMISSIONS
if (interaction.isModalSubmit()) {
  if (interaction.customId.startsWith('modal_')) {
    const key = interaction.customId.replace('modal_', '');
    const newMessage = interaction.fields.getTextInputValue('message_input').trim();

    if (!newMessage.includes('{username}')) {
      await interaction.reply({ content: '❌ Your message must include the `{username}` placeholder.', ephemeral: true });
      return;
    }

    json[key] = newMessage;
    await settingsMsg.edit("```json\n" + JSON.stringify(json, null, 2) + "\n```");
    await interaction.reply({ content: `✅ Updated ${key === 'welcomeMessage' ? 'Welcome' : 'Goodbye'} message!`, ephemeral: true });
    return;
  }
}

// CHANNEL SELECT MENUS
if (interaction.isChannelSelectMenu()) {
  const choice = interaction.values[0];

  if (interaction.customId === 'welcome_channel') json.welcomeChannel = choice;
  if (interaction.customId === 'bot_announcements') json.botAnnouncements = choice;
  if (interaction.customId === 'mod_logs') json.modLogs = choice;
  if (interaction.customId === 'suggestions') json.suggestions = choice;

  await settingsMsg.edit("```json\n" + JSON.stringify(json, null, 2) + "\n```");

  await interaction.reply({ content: `✅ Updated setting: <#${choice}>`, ephemeral: true });
  return;
}
  });
};
