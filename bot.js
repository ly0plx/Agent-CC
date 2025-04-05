const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const allCommands = [
  {commandName1: "ping", description: "Replies with Pong!", execute: ping},
  {commandName1: "troubleshoot", description: "Search Common Error Database for solution", options: [
    {
      type: "string",
      name: "error",
      description: "Error message to troubleshoot",
      required: true,
    }
  ], execute: troubleshoot},
];

async function ping(interaction) {
  await interaction.reply('Pong!');
  // Here you would implement the logic to check the server status
  // For now, we'll just reply with a placeholder message
  console.log("ping used by " + interaction.user.username + " on channel " + interaction.channel.name);
}

async function troubleshoot(interaction) {
  const error = interaction.options.getString('error');
  // Here you would implement the logic to search the common error database
  // For now, we'll just reply with a placeholder message
  await interaction.reply(`Searching for solution to: ${error}`);
  console.log("troubleshoot used by " + interaction.user.username + " on channel " + interaction.channel.name);
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Slash Command Handling
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    allCommands.forEach(command => {
        if (interaction.commandName === command.commandName1) {
            command.execute(interaction);
        }
    });
});

// Register Slash Commands (Run this once)
let commands = [];

allCommands.forEach(cmd => {
  let builder = new SlashCommandBuilder()
    .setName(cmd.commandName1)
    .setDescription(cmd.description);

  if (cmd.options) {
    cmd.options.forEach(opt => {
      switch (opt.type) {
        case 'string':
          builder.addStringOption(option =>
            option.setName(opt.name)
              .setDescription(opt.description)
              .setRequired(opt.required)
          );
          break;
        case 'user':
          builder.addUserOption(option =>
            option.setName(opt.name)
              .setDescription(opt.description)
              .setRequired(opt.required)
          );
          break;
        // Add other types as needed (boolean, integer, channel, etc.)
      }
    });
  }

  commands.push(builder.toJSON());
});

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
    try {
        console.log('Registering slash commands...');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('Slash commands registered!');
    } catch (error) {
        console.error(error);
    }
})();

client.login(process.env.TOKEN);
