// bot.js - Main File


// IMPORTS
import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ThreadAutoArchiveDuration,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  Message,
} from "discord.js";
import fetch from "node-fetch";
import { PythonShell } from "python-shell";
import { exec } from "child_process";
import { dirname } from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import fs from "fs";
import path from "path";
import mentionRelay from "./mentionRelay.js"; // adjust path if needed
import dotenv from "dotenv";
import { time } from "console";
dotenv.config();
import controlServer from "./controlServer.js";
import settingsManager from "./settingsManager.js"; // adjust path if needed

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Ensure this is enabled
    GatewayIntentBits.DirectMessages, // Added for listening to DMs
    GatewayIntentBits.MessageContent, // Make sure MessageContent intent is on
  ],
  partials: [
    "CHANNEL", // Allows access to partials for channels, needed for DMs
    "MESSAGE", // Added for message partials, ensures the bot can respond to DMs and missing messages
  ],
});

const channels = {}; // This will hold our named channel accessors
const activeChatFeeds = new Map();

// Guild Setup
import guildSetup from './guildSetup.js';
import { start } from "repl";
guildSetup(client);

// Welcome messages and settings
client.on('guildMemberAdd', async (member) => {
  try {
    const settings = await settingsManager.getSettings(client, member.guild.id);

    // Get the stored welcome channel ID from settings
    const welcomeChannelId = settings.welcomeChannel;
    if (!welcomeChannelId) return; // No welcome channel set, bail out

    // Fetch the channel by ID
    const channel = member.guild.channels.cache.get(welcomeChannelId);
    if (!channel || channel.type !== ChannelType.GuildText) return; // Validate channel

    const welcomeMsg = settings.welcomeMessage || "Welcome to the server, {username}!";

    const finalMsg = welcomeMsg.replaceAll('{username}', `<@${member.id}>`);

    await channel.send({ content: finalMsg });

  } catch (err) {
    console.error('Error sending welcome message:', err);
  }
});

client.once("ready", async () => {
  // Set the bot's status and activity
  client.user.setPresence({
    activities: [{ name: 'with code' }],
    status: 'idle', // Options: 'online', 'idle', 'dnd', 'invisible'
  });

  // figure out which channels the bot has access to

  const guild = await client.guilds.fetch(process.env.CONTROL_GUILD_ID);
  const allChannels = await guild.channels.fetch();

  const desired = process.env.CONTROL_CHANNEL_NAMES
    ? process.env.CONTROL_CHANNEL_NAMES.split(",").map((n) =>
      n.trim().toLowerCase()
    )
    : [];

  for (const ch of allChannels.values()) {
    if (
      ch &&
      ch.type === ChannelType.GuildText &&
      desired.includes(ch.name.toLowerCase())
    ) {
      channels[ch.name.toLowerCase()] = ch;
    }
  }

  // Example of sending a message at startup
  if (channels.commands) {
    // Get current Unix timestamp in seconds
    const timestamp = Math.floor(Date.now() / 1000);

    // Discord time formatting — e.g. <t:1699999999:F> 
    // F = full date/time, f = short date/time, R = relative (like "in 5 minutes")
    channels.botconsole.send(
      `👋 Agent-CC is online and reporting for duty.\n🕒 Current time: <t:${timestamp}:f>\nRelative time: <t:${timestamp}:R>`
    );

  } else {
    console.warn("⚠️ 'commands' channel not found.");
  }
});

// Listen for mentions and forward the message to the specified user
client.on(mentionRelay.name, mentionRelay.execute);

// Set up reply listener
mentionRelay.listenToReplies(client);

const activeChallenges = new Map(); // Store active challenges
let challengeData = {
  admin: null,
  submissions: [],
  threadId: null,
  challengeEndTime: null,
};
const serviceDocs = {
  "Node.js": "https://nodejs.org/en/docs/",
  Express: "https://expressjs.com/en/starter/installing.html",
  MongoDB: "https://www.mongodb.com/docs/",
  React: "https://reactjs.org/docs/getting-started.html",
  Vue: "https://v3.vuejs.org/guide/introduction.html",
  Angular: "https://angular.io/docs",
  Python: "https://docs.python.org/3/",
  Django: "https://docs.djangoproject.com/en/stable/",
  Laravel: "https://laravel.com/docs",
  Java: "https://docs.oracle.com/en/java/",
  "Ruby on Rails": "https://guides.rubyonrails.org/",
  Flutter: "https://flutter.dev/docs",
  "Spring Boot":
    "https://docs.spring.io/spring-boot/docs/current/reference/htmlsingle/",
};
const exampleSnippets = {
  variables: `// Example of Variable Declaration
let name = 'John Doe';  // String variable
const age = 30;  // Constant variable
let isActive = true;  // Boolean variable`,

  "data types": `// Example of Data Types
let number = 10;  // Number
let text = 'Hello, world!';  // String
let isActive = true;  // Boolean`,

  functions: `// Example of Functions
function greet(name) {
  return 'Hello, ' + name;
}
console.log(greet('John'));  // Output: Hello, John`,

  loops: `// Example of Loops
for (let i = 0; i < 5; i++) {
  console.log(i);  // Output: 0, 1, 2, 3, 4
}
  
let i = 0;
while (i < 5) {
  console.log(i);  // Output: 0, 1, 2, 3, 4
  i++;
}`,

  conditionals: `// Example of Conditionals
let x = 10;
if (x > 5) {
  console.log('x is greater than 5');
} else {
  console.log('x is less than or equal to 5');
}`,

  arrays: `// Example of Arrays
let fruits = ['Apple', 'Banana', 'Orange'];
console.log(fruits[0]);  // Output: Apple`,

  objects: `// Example of Objects
let person = {
  name: 'John',
  age: 30,
  greet: function() {
    return 'Hello, ' + this.name;
  }
};
console.log(person.greet());  // Output: Hello, John`,

  classes: `// Example of Classes
class Person {
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }
  greet() {
    return 'Hello, ' + this.name;
  }
}
let person = new Person('John', 30);
console.log(person.greet());  // Output: Hello, John`,
};
const motivationalQuotes = [
  "Programs must be written for people to read, and only incidentally for machines to execute. – Harold Abelson",
  "Talk is cheap. Show me the code. – Linus Torvalds",
  "Truth can only be found in one place: the code. – Robert C. Martin",
  "The only way to learn a new programming language is by writing programs in it. – Dennis Ritchie",
  "Any fool can write code that a computer can understand. Good programmers write code that humans can understand. – Martin Fowler",
  "First, solve the problem. Then, write the code. – John Johnson",
  "Experience is the name everyone gives to their mistakes. – Oscar Wilde",
  "In order to be irreplaceable, one must always be different. – Coco Chanel",
  "Java is to JavaScript what car is to Carpet. – Chris Heilmann",
  "Knowledge is power. – Francis Bacon",
  "Sometimes it pays to stay in bed on Monday, rather than spending the rest of the week debugging Monday’s code. – Dan Salomon",
  "Code is like humor. When you have to explain it, it’s bad. – Cory House",
  "Fix the cause, not the symptom. – Steve Maguire",
  "Optimism is an occupational hazard of programming: feedback is the treatment. – Kent Beck",
  "When to use iterative development? You should use iterative development only on projects that you want to succeed. – Martin Fowler",
  "Simplicity is the soul of efficiency. – Austin Freeman",
  "Before software can be reusable it first has to be usable. – Ralph Johnson",
  "Make it work, make it right, make it fast. – Kent Beck",
  "Any sufficiently advanced bug is indistinguishable from a feature. – Rich Kulawiec",
  "If you think it's simple, then you have misunderstood the problem. – Bjarne Stroustrup",
  "Programming isn't about what you know; it's about what you can figure out. – Chris Pine",
  "The best error message is the one that never shows up. – Thomas Fuchs",
  "Software undergoes beta testing shortly before it’s released. Beta is Latin for 'still doesn’t work.' – Unknown",
  "If debugging is the process of removing bugs, then programming must be the process of putting them in. – Edsger Dijkstra",
  "You can’t have great software without a great team. – Joel Spolsky",
  "If you automate a mess, you get an automated mess. – Rod Michael",
  "A good programmer looks both ways before crossing a one-way street. – Doug Linder",
  "Simplicity is prerequisite for reliability. – Edsger Dijkstra",
  "Computers are fast; programmers keep it slow. – Unknown",
  "Code never lies, comments sometimes do. – Ron Jeffries",
  "Programming is not easy like Sunday morning, it’s silent like Saturday night. – Unknown",
  "Deleted code is debugged code. – Jeff Sickel",
  "Testing leads to failure, and failure leads to understanding. – Burt Rutan",
  "A user interface is like a joke. If you have to explain it, it's not that good. – Martin LeBlanc",
  "The best thing about a boolean is even if you are wrong, you are only off by a bit. – Unknown",
  "Software is a gas; it expands to fill its container. – Nathan Myhrvold",
  "Programming is the art of algorithm design and the craft of debugging errant code. – Ellen Ullman",
  "Walking on water and developing software from a specification are easy if both are frozen. – Edward V. Berard",
  "Sometimes the elegant implementation is just a function. Not a method. Not a class. Not a framework. Just a function. – John Carmack",
  "Programming is thinking, not typing. – Casey Patton",
  "Give a man a program, frustrate him for a day. Teach a man to program, frustrate him for a lifetime. – Muhammad Waseem",
  "Code as if the next person to maintain your code is a psychopath who knows where you live. – John Woods",
  "The function of good software is to make the complex appear to be simple. – Grady Booch",
  "The trouble with programmers is that you can never tell what a programmer is doing until it’s too late. – Seymour Cray",
  "A good programmer is someone who always looks both ways before crossing a one-way street. – Doug Linder",
  "Always code as if the guy who ends up maintaining your code will be a violent psychopath who knows where you live. – Martin Golding",
  "Good code is its own best documentation. – Steve McConnell",
  "Programs are meant to be read by humans and only incidentally for computers to execute. – Donald Knuth",
  "Programming is like writing a book… except if you miss a single comma on page 126 the whole thing makes no sense. – Unknown",
  "The best programmers are not marginally better than merely good ones. They are an order-of-magnitude better. – Randall E. Stross",
  "When you feel the need to write a comment, first try to refactor the code so that any comment becomes superfluous. – Kent Beck",
  "Don’t comment bad code — rewrite it. – Brian Kernighan",
  "Even the best planning is not so omniscient as to get it right the first time. – Fred Brooks",
  "Coding is not just code, that is a live thing to serve everyone! – Ming Song",
  "Programming can be fun, so can cryptography; however, they should not be combined. – Kreitzberg and Shneiderman",
  "If you learn how to write software, you can create virtual universes. – Lex Fridman",
  "Everyone should learn how to code. It teaches you how to think. – Steve Jobs",
  "A language that doesn’t affect the way you think about programming is not worth knowing. – Alan Perlis",
  "Fast, good, cheap: pick any two. – Unknown",
  "You miss 100% of the bugs you don’t test. – Unknown",
  "Without requirements or design, programming is the art of adding bugs to an empty text file. – Louis Srygley",
  "Code without tests is broken by design. – Jacob Kaplan-Moss",
  "Fail fast. Fix faster. – Unknown",
  "Hard things are hard. Deal with it. – Unknown",
  "Programming is 10% writing code and 90% figuring out why it’s not working. – Unknown",
  "No matter which field you’re in, learning to program will change your life. – Drew Houston",
  "Readability counts. – The Zen of Python",
  "There is always one more bug to fix. – Ellen Ullman",
  "Code should be written to minimize the time it would take for someone else to understand it. – Robert C. Martin",
  "Beautiful code is short and sweet. – John Carmack",
  "Code is like poetry; it has to make sense and have rhythm. – Unknown",
  "In programming the hard part isn’t solving problems, but deciding what problems to solve. – Paul Graham",
  "Coding is today's literacy. – Unknown",
  "Software development is a marathon, not a sprint. – Unknown",
  "You don’t need to know everything. You just need to be resourceful. – Unknown",
  "Discipline equals freedom. – Jocko Willink",
  "If you want to be a good coder, you have to code a lot. – Unknown",
  "The way to learn to program is by writing programs. – Brian Kernighan",
  "Great software is the result of great habits. – Unknown",
  "Start small. Think big. Scale fast. – Unknown",
  "Practice doesn’t make perfect. Perfect practice makes perfect. – Vince Lombardi",
  "Errors are a sign you’re pushing your limits. – Unknown",
  "Learning to write programs stretches your mind. – Bill Gates",
  "Success is the sum of small efforts, repeated day in and day out. – Robert Collier",
  "You are never too old to learn something new. – Unknown",
  "Push yourself, because no one else is going to do it for you. – Unknown",
  "Stop wishing. Start doing. – Unknown",
  "Consistency is the key to mastery. – Unknown",
  "Be stubborn on vision, but flexible on details. – Jeff Bezos",
  "Persistence guarantees that results are inevitable. – Paramahansa Yogananda",
  "Just keep coding. – Unknown",
  "It always seems impossible until it’s done. – Nelson Mandela",
  "Motivation gets you going. Discipline keeps you growing. – John C. Maxwell",
  "You don’t have to be great to start, but you have to start to be great. – Zig Ziglar",
  "The best way to predict the future is to invent it. – Alan Kay",
];

const allCommands = [
  { // ping - ping()
    commandName1: "ping",
    description: "Replies with Pong!",
    execute: ping
  },
  { // troubleshoot - troubleshoot()
    commandName1: "troubleshoot",
    description: "Search Common Error Database for solution",
    options: [
      {
        type: "string",
        name: "error",
        description: "Error message to troubleshoot",
        required: true,
        choices: [
          { name: "SyntaxError", value: "SyntaxError" },
          { name: "TypeError", value: "TypeError" },
          { name: "ReferenceError", value: "ReferenceError" },
          { name: "RangeError", value: "RangeError" },
          { name: "TS2345", value: "TS2345" }, // Type mismatch
          { name: "TS2304", value: "TS2304" }, // Cannot find name
          { name: "TS1005", value: "TS1005" }, // Missing ; or )
          { name: "NameError", value: "NameError" },
          { name: "ValueError", value: "ValueError" },
          { name: "IndexError", value: "IndexError" },
          { name: "KeyError", value: "KeyError" },
          { name: "ImportError", value: "ImportError" },
          { name: "ModuleNotFoundError", value: "ModuleNotFoundError" },
          { name: "IndentationError", value: "IndentationError" },
          { name: "NullPointerException", value: "NullPointerException" },
          { name: "ClassNotFoundException", value: "ClassNotFoundException" },
          {
            name: "IllegalArgumentException",
            value: "IllegalArgumentException",
          },
          { name: "ArithmeticException", value: "ArithmeticException" },
          { name: "SegmentationFault", value: "SegmentationFault" },
          { name: "LinkerError", value: "LinkerError" },
          { name: "CompilationError", value: "CompilationError" },
          { name: "UndefinedBehavior", value: "UndefinedBehavior" },
          { name: "RustTypeMismatch", value: "RustTypeMismatch" },
          { name: "CSSSyntaxError", value: "CSSSyntaxError" },
          { name: "UnknownAtRule", value: "UnknownAtRule" },
        ],
      },
    ],
    execute: troubleshoot,
  },
  { // help - help()
    commandName1: "help",
    description: "Get help with the bot",
    execute: help
  },
  { // info - info()
    commandName1: "info",
    description: "Get info about the bot",
    options: [
      {
        type: "string",
        name: "from",
        description: "Information to retrieve",
        required: true,
        choices: [
          { name: "Server", value: "server" },
          { name: "User", value: "user" },
          { name: "Bot", value: "bot" },
        ],
      },
    ],
    execute: info,
  },
  { // package - packageInfo()
    commandName1: "package",
    description: "Get info about a package from a package registry",
    options: [
      {
        type: "string",
        name: "name",
        description: "The name of the package",
        required: true,
      },
      {
        type: "string",
        name: "source",
        description: "The package registry",
        required: true,
        choices: [
          { name: "npm", value: "npm" },
          { name: "PyPI", value: "pypi" },
          { name: "crates.io", value: "crates" },
          { name: "RubyGems", value: "rubygems" },
        ],
      },
    ],
    execute: packageInfo,
  },
  { // motivate - quote()
    commandName1: "motivate",
    description: "Get a random motivational quote",
    execute: quote,
  },
  { // doc - docService()
    commandName1: "doc",
    description: "Get documentation link for a service",
    options: [
      {
        type: "string",
        name: "service",
        description: "The service to get documentation for",
        required: true,
        choices: [
          { name: "Node.js", value: "Node.js" },
          { name: "Express", value: "Express" },
          { name: "MongoDB", value: "MongoDB" },
          { name: "React", value: "React" },
          { name: "Vue", value: "Vue" },
          { name: "Angular", value: "Angular" },
          { name: "Python", value: "Python" },
          { name: "Django", value: "Django" },
          { name: "Laravel", value: "Laravel" },
          { name: "Java", value: "Java" },
          { name: "Ruby on Rails", value: "Ruby on Rails" },
          { name: "Flutter", value: "Flutter" },
          { name: "Spring Boot", value: "Spring Boot" },
        ],
      },
    ],
    execute: docService,
  },
  { // suggest - suggest()
    commandName1: "suggest",
    description: "Suggest something to a user",
    options: [
      {
        type: "user",
        name: "user",
        description: "The user to suggest to",
        required: true,
      },
      {
        type: "string",
        name: "advice",
        description: "The advice to give",
        required: true,
      },
    ],
    execute: suggest,
  },
  { // snippet - snippet()
    commandName1: "snippet",
    description: "Get example code for a concept",
    options: [
      {
        type: "string",
        name: "concept",
        description: "The concept of the code snippet",
        required: true,
        choices: [
          { name: "Variables", value: "variables" },
          { name: "Data Types", value: "data types" },
          { name: "Functions", value: "functions" },
          { name: "Loops", value: "loops" },
          { name: "Conditionals", value: "conditionals" },
          { name: "Arrays", value: "arrays" },
          { name: "Objects", value: "objects" },
          { name: "Classes", value: "classes" },
        ],
      },
    ],
    execute: snippet,
  },
  { // wiki - wikiSearch()
    commandName1: "wiki",
    description: "Searches Wikipedia and gives first paragraph",
    options: [
      {
        type: "string",
        name: "query",
        description: "What do you want to search?",
        required: true,
      },
    ],
    execute: wikiSearch,
  },
  { // gitfind - gitfind()
    commandName1: "gitfind",
    description: "Find details about a repository",
    options: [
      {
        type: "string",
        name: "author",
        description: "Author of the repository",
        required: true,
      },
      {
        type: "string",
        description: "The name of the repo to find",
        name: "repository_name",
        required: true,
      },
    ],
    execute: gitfind,
  },
  { // challenge - challenge()
    commandName1: "challenge",
    description: "Create a timed coding challenge (Admin only)",
    adminOnly: true, // Only allow admins to use this command
    options: [
      {
        type: "string",
        name: "prompt",
        description: "The prompt for the challenge",
        required: true,
      },
      {
        type: "integer",
        name: "duration",
        description: "Duration of the challenge in minutes",
        required: true,
      },
    ],
    execute: challenge,
  },
  { // schedule - schedule()
    commandName1: "schedule",
    description: "Schedule a command to run later (Admin & Server only)",
    options: [
      {
        type: "string", // STRING
        name: "command",
        description: "Command to run",
        required: true,
      },
      {
        type: "integer", // INTEGER
        name: "year",
        description: "Year to run at",
        required: true,
      },
      {
        type: "integer",
        name: "month",
        description: "Month (1-12)",
        required: true,
      },
      {
        type: "integer",
        name: "day",
        description: "Day of month",
        required: true,
      },
      {
        type: "integer",
        name: "hour",
        description: "Hour (0-23)",
        required: true,
      },
      {
        type: "integer",
        name: "minute",
        description: "Minute (0-59)",
        required: true,
      },
      {
        type: "string", // STRING
        name: "args",
        description: "Arguments as JSON array",
        required: false,
      },
    ],
    execute: schedule,
  },
  { // startchat - has its own 
    commandName1: "startchat",
    description: "Start a relay thread for a selected channel",
    adminOnly: true, // Only allow admins to use this comman
    options: [
      {
        type: "string",
        name: "guildid",
        description: "Guild to relay from",
        required: true,
        autocomplete: true,
      },
      {
        type: "string",
        name: "channelid",
        description: "Channel ID to mirror",
        required: true,
        autocomplete: true,
      },
    ],

    async execute(interaction) {
      const controlGuildId = process.env.CONTROL_GUILD_ID;
      const controlChannelName = "chats";
      const channel = interaction.channel;

      if (
        interaction.guildId !== controlGuildId ||
        channel.name !== controlChannelName
      ) {
        return interaction.reply({
          content:
            "❌ You can only use this command in #chats on the control server.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const guildId = interaction.options.getString("guildid");
      // console.log(typeof guildId, " " + guildId);
      const channelId = interaction.options.getString("channelid");
      // console.log(typeof channelId, " " + channelId);
      const key = `${guildId}_${channelId}`;

      if (activeChatFeeds.has(key)) {
        return interaction.reply({
          content: "⚠️ A feed for that channel is already active.",
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        const targetGuild = await interaction.client.guilds.fetch(guildId);
        const sourceChannel = await targetGuild.channels.fetch(channelId);

        if (!sourceChannel || !sourceChannel.isTextBased()) {
          return interaction.reply({
            content: "❌ That channel is invalid or not text-based.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const relayThread = await channel.threads.create({
          name: `Chat from #${sourceChannel.name}`,
          autoArchiveDuration: 60,
          reason: `Relaying messages from #${sourceChannel.name}`,
        });

        activeChatFeeds.set(relayThread.id, { guildId, channelId });

        await interaction.reply({
          content: `✅ Started chat relay for **#${sourceChannel.name}** from **${targetGuild.name}** in <#${relayThread.id}>.`,
          flags: MessageFlags.Ephemeral,
        });
      } catch (err) {
        console.error("Error setting up /startchat:", err);
        return interaction.reply({
          content: "❌ Failed to set up chat feed.",
          flags: MessageFlags.Ephemeral,
        });
      }
    },

    async autocomplete(interaction) {
      const focused = interaction.options.getFocused(true);

      if (focused.name === "guild") {
        const guilds = await interaction.client.guilds.fetch();
        const choices = Array.from(guilds.values())
          .slice(0, 25)
          .map((guild) => ({
            name: guild.name,
            value: guild.id,
          }));
        return interaction.respond(choices);
      }

      if (focused.name === "channel") {
        const guildId = interaction.options.getString("guild");
        if (!guildId) return interaction.respond([]);
        try {
          const guild = await interaction.client.guilds.fetch(guildId);
          const channels = await guild.channels.fetch();
          const choices = Array.from(channels.values())
            .filter((ch) => ch.type === ChannelType.GuildText)
            .slice(0, 25)
            .map((ch) => ({ name: `#${ch.name}`, value: ch.id }));
          return interaction.respond(choices);
        } catch (e) {
          return interaction.respond([]);
        }
      }
    },

    listenToFeeds(client) {
      client.on("messageCreate", async (message) => {
        if (message.author.bot) return;

        const key = `${message.guildId}_${message.channelId}`;
        const thread = activeChatFeeds.get(key);

        // FROM original channel ➜ to thread
        if (thread && thread.id !== message.channelId) {
          try {
            await thread.send(`**${message.author.tag}:** ${message.content}`);
          } catch (err) {
            console.error("Error relaying to thread:", err);
          }
          return;
        }

        // FROM thread ➜ back to original channel
        const reverse = activeChatFeeds.get(message.channelId);
        if (reverse) {
          const { guildId, channelId } = reverse;
          const targetGuild = await client.guilds.fetch(guildId);
          const originalChannel = await targetGuild.channels.fetch(channelId);

          if (!originalChannel || !originalChannel.isTextBased()) return;

          try {
            await originalChannel.send(
              message.content
            );
          } catch (err) {
            console.error("Error relaying back to original channel:", err);
          }
        }
      });
    },
  },
  { // send - sendMessage()
    commandName1: "send",
    description: "Send a message to a channel",
    adminOnly: true, // Only allow admins to use this command
    options: [
      {
        type: "channel",
        name: "channel",
        description: "Channel to send the message to",
        required: true,
        autocomplete: true,
      },
      {
        type: "string",
        name: "message",
        description: "Message to send",
        required: true,
      },
    ],
    execute: sendMessage
  },
  { // cleanup - cleanup()
    commandName1: "cleanup",
    description: "Clean up messages in a channel",
    adminOnly: true,
    options: [
      {
        type: "string",
        name: "ignore",
        description: "Ignore messages from something (bot/user/none)",
        required: false,
        autocomplete: true,
        choices: [
          { name: "bot", value: "bot" },
          { name: "user", value: "user" },
        ],
      },
    ],
    execute: cleanup
  }

];

controlServer.init(client, allCommands);

// #region Command Executables

async function ping(interaction) {
  const sent = Date.now();

  // First, defer reply so we can calculate latency accurately
  await interaction.deferReply();

  const replyTime = Date.now();
  const botLatency = replyTime - sent;
  const apiLatency = Math.round(client.ws.ping);

  // Format uptime (milliseconds to readable time)
  const totalSeconds = Math.floor(process.uptime());
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

  const embed = {
    color: 0x00ffcc,
    title: "🏓 Pong!",
    description: "Here's the detailed latency info:",
    fields: [
      { name: "Bot Latency", value: `${botLatency}ms`, inline: true },
      { name: "WebSocket Latency", value: `${apiLatency}ms`, inline: true },
      { name: "Uptime", value: uptimeString, inline: true },
      {
        name: "Requested By",
        value: `${interaction.user.username}#${interaction.user.discriminator}`,
        inline: false,
      },
    ],
    footer: {
      text: `Channel: #${interaction.channel?.name ?? "DM"}`,
    },
    timestamp: new Date().toISOString(),
  };

  await interaction.editReply({ embeds: [embed] });

  channels.botconsole.send(
    `Ping used by ${interaction.user.tag} in #${interaction.channel?.name} - Bot Latency: ${botLatency}ms`
  );
}

async function troubleshoot(interaction) {
  const error = interaction.options.getString("error");

  const errorExplanations = {
    SyntaxError:
      "🧠 **SyntaxError**: There’s a typo or mistake in your code syntax. Check for missing brackets, quotes, or semicolons.",
    TypeError:
      "🔢 **TypeError**: You're trying to do something with a value of the wrong type, like calling a function on `undefined`.",
    ReferenceError:
      "📛 **ReferenceError**: You tried to use a variable that hasn’t been declared.",
    RangeError:
      "📐 **RangeError**: A number is outside the range of allowed values, like setting an array length to -1.",
    TS2345:
      "💡 **TS2345**: TypeScript says the argument type doesn’t match the expected type. Check your function arguments.",
    TS2304:
      "🔍 **TS2304**: TypeScript can't find a variable or function name. You probably forgot to import or define it.",
    TS1005:
      "✏️ **TS1005**: A symbol like `;`, `)`, or `}` is missing. Check your code formatting.",
    NameError:
      "🔤 **NameError**: You're using a variable or function name that hasn’t been defined yet in Python.",
    ValueError:
      "📦 **ValueError**: A function received the correct type, but an inappropriate value (like `int('abc')`).",
    IndexError:
      "🔢 **IndexError**: You tried to access a list index that doesn't exist.",
    KeyError: "🔑 **KeyError**: A dictionary key doesn't exist.",
    ImportError:
      "📥 **ImportError**: Python couldn’t find the module or function you’re trying to import.",
    ModuleNotFoundError:
      "📦 **ModuleNotFoundError**: The specified module wasn’t found. Try installing it or check the name.",
    IndentationError:
      "📏 **IndentationError**: Python requires indentation. Make sure your tabs/spaces line up.",
    NullPointerException:
      "🕳️ **NullPointerException**: Java tried to access an object that was `null`.",
    ClassNotFoundException:
      "🏷️ **ClassNotFoundException**: Java couldn't find the class definition at runtime.",
    IllegalArgumentException:
      "📘 **IllegalArgumentException**: A method received an argument that it wasn’t expecting.",
    ArithmeticException:
      "➗ **ArithmeticException**: You did something illegal in math, like dividing by zero.",
    SegmentationFault:
      "💥 **SegmentationFault**: Your program accessed an invalid memory location. Common in C/C++.",
    LinkerError:
      "🔗 **LinkerError**: During C/C++ compilation, it couldn’t link your code with libraries or functions.",
    CompilationError:
      "🚧 **CompilationError**: There’s an error preventing the code from compiling successfully.",
    UndefinedBehavior:
      "🌀 **UndefinedBehavior**: C/C++ did something the standard doesn’t define — this is dangerous!",
    RustTypeMismatch:
      "🦀 **RustTypeMismatch**: Rust expected one type but got another. Use the correct types or convert them.",
    CSSSyntaxError:
      "🎨 **CSSSyntaxError**: Your CSS has a formatting problem, like a missing `}` or bad selector.",
    UnknownAtRule:
      "⚠️ **UnknownAtRule**: You used a CSS `@rule` that’s not supported or spelled wrong.",
  };

  const explanation =
    errorExplanations[error] || "❓ No explanation found for this error.";

  const embed = {
    color: 0xff6600,
    title: "🔧 Error Troubleshooting",
    fields: [
      {
        name: `🔍 Error: ${error}`,
        value: explanation,
      },
    ],
    footer: {
      text: `Requested by ${interaction.user.tag}`,
    },
    timestamp: new Date().toISOString(),
  };

  await interaction.reply({ embeds: [embed] });

  channels.botconsole.send(
    `Troubleshoot used by ${interaction.user.tag} - Error: ${error}`
  );
}

async function help(interaction) {
  const embed = {
    color: 0x00bfff,
    title: "📚 Available Commands",
    description: "Here’s a list of all slash commands you can use:",
    fields: allCommands.map((cmd) => ({
      name: `/${cmd.commandName1}`,
      value: cmd.description || "No description available",
    })),
    footer: {
      text: `Requested by ${interaction.user.tag}`,
    },
    timestamp: new Date().toISOString(),
  };

  await interaction.reply({ embeds: [embed] });
  channels.botconsole.send(`Help command used by ${interaction.user.tag}`);
}

async function info(interaction) {
  const from = interaction.options.getString("from");
  let embed;

  if (from === "server") {
    const guild = interaction.guild;
    embed = {
      color: 0x3498db,
      title: "🏠 Server Information",
      fields: [
        { name: "Server Name", value: guild.name, inline: true },
        { name: "Server ID", value: guild.id, inline: true },
        { name: "Owner ID", value: guild.ownerId || "Unknown", inline: true },
        {
          name: "Member Count",
          value: guild.memberCount.toString(),
          inline: true,
        },
        {
          name: "Created At",
          value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`,
          inline: true,
        },
      ],
      footer: { text: `Requested by ${interaction.user.tag}` },
      timestamp: new Date().toISOString(),
    };
  } else if (from === "user") {
    const user = interaction.user;
    embed = {
      color: 0x2ecc71,
      title: "👤 User Information",
      fields: [
        { name: "Username", value: `${user.username}`, inline: true },
        { name: "User ID", value: user.id, inline: true },
        { name: "Tag", value: user.tag, inline: true },
        {
          name: "Created At",
          value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
          inline: true,
        },
      ],
      thumbnail: { url: user.displayAvatarURL() },
      footer: { text: `Requested by ${interaction.user.tag}` },
      timestamp: new Date().toISOString(),
    };
  } else if (from === "bot") {
    embed = {
      color: 0xe67e22,
      title: "🤖 Bot Information",
      fields: [
        { name: "Bot Tag", value: client.user.tag, inline: true },
        { name: "Bot ID", value: client.user.id, inline: true },
        { name: "Servers", value: `${client.guilds.cache.size}`, inline: true },
        {
          name: "Created At",
          value: `<t:${Math.floor(client.user.createdTimestamp / 1000)}:F>`,
          inline: true,
        },
      ],
      footer: { text: `Requested by ${interaction.user.tag}` },
      timestamp: new Date().toISOString(),
    };
  } else {
    await interaction.reply("Invalid option selected.");
    return;
  }

  await interaction.reply({ embeds: [embed] });
  channels.botconsole.send(
    `Info command used by ${interaction.user.tag} for '${from}'`
  );
}

async function packageInfo(interaction) {
  const name = interaction.options.getString("name");
  let source = interaction.options.getString("source");

  // Log the request
  channels.botconsole.send(
    `📦 PackageInfo command used by ${interaction.user.tag} for '${name}' from '${source}'`
  );

  // Alias 'yarn' to 'npm'
  if (source === "yarn") {
    source = "npm";
  }

  await interaction.deferReply();

  try {
    let embed;
    switch (source) {
      case "npm":
        embed = await fetchNpmPackage(name);
        break;
      case "pypi":
        embed = await fetchPyPiPackage(name);
        break;
      case "crates":
        embed = await fetchCratesPackage(name);
        break;
      case "rubygems":
        embed = await fetchRubyGemsPackage(name);
        break;
      default:
        console.warn(`⚠️ Unknown package source '${source}'`);
        return interaction.editReply("❌ Unknown source.");
    }

    if (!embed) {
      channels.botconsole.send(`❌ Package '${name}' not found on '${source}'`);
      return interaction.editReply(
        `❌ Package \`${name}\` not found on ${source}.`
      );
    }

    channels.botconsole.send(
      `✅ Package '${name}' info retrieved from '${source}'`
    );
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error(`❗ Error fetching '${name}' from '${source}':`, err);
    await interaction.editReply(
      "⚠️ An error occurred while fetching package info."
    );
  }
}

async function fetchNpmPackage(name) {
  const res = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(name)}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const latest = data["dist-tags"].latest;
  const v = data.versions[latest];

  return new EmbedBuilder()
    .setTitle(`${data.name} (${latest})`)
    .setURL(`https://www.npmjs.com/package/${data.name}`)
    .setDescription(data.description || "No description provided.")
    .setColor(0xcc0000)
    .addFields(
      { name: "Author", value: v.author?.name || "Unknown", inline: true },
      { name: "License", value: v.license || "None", inline: true },
      { name: "Version", value: latest, inline: true }
    );
}
async function fetchPyPiPackage(name) {
  const res = await fetch(
    `https://pypi.org/pypi/${encodeURIComponent(name)}/json`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const info = data.info;

  return new EmbedBuilder()
    .setTitle(`${info.name} (${info.version})`)
    .setURL(info.package_url)
    .setDescription(info.summary || "No description provided.")
    .setColor(0x3776ab)
    .addFields(
      { name: "Author", value: info.author || "Unknown", inline: true },
      { name: "License", value: info.license || "None", inline: true },
      { name: "Home Page", value: info.home_page || "N/A", inline: false }
    );
}
async function fetchCratesPackage(name) {
  const res = await fetch(
    `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const crate = data.crate;

  return new EmbedBuilder()
    .setTitle(`${crate.name} (${crate.max_version})`)
    .setURL(`https://crates.io/crates/${crate.name}`)
    .setDescription(crate.description || "No description provided.")
    .setColor(0xde8f00)
    .addFields(
      { name: "License", value: crate.license || "None", inline: true },
      {
        name: "Downloads",
        value: crate.downloads.toLocaleString(),
        inline: true,
      }
    );
}
async function fetchRubyGemsPackage(name) {
  const res = await fetch(
    `https://rubygems.org/api/v1/gems/${encodeURIComponent(name)}.json`
  );
  if (!res.ok) return null;
  const gem = await res.json();

  return new EmbedBuilder()
    .setTitle(`${gem.name} (${gem.version})`)
    .setURL(gem.project_uri)
    .setDescription(gem.info || "No description provided.")
    .setColor(0xff0066)
    .addFields(
      { name: "Authors", value: gem.authors || "Unknown", inline: true },
      {
        name: "License",
        value: gem.licenses?.join(", ") || "None",
        inline: true,
      },
      { name: "Downloads", value: gem.downloads.toLocaleString(), inline: true }
    );
}

async function quote(interaction) {
  const randomIndex = Math.floor(Math.random() * motivationalQuotes.length);
  const rquote = motivationalQuotes[randomIndex];

  const quoteEmbed = new EmbedBuilder()
    .setColor("#FF5733") // Set embed color
    .setTitle("Motivational Quote") // Embed title
    .setDescription(`"${rquote}"`) // The quote itself
    .setFooter({
      text: `Stay inspired!`,
      iconURL: "https://i.imgur.com/AfFp7pu.png",
    }); // Footer with a small icon

  await interaction.reply({ embeds: [quoteEmbed] });
  channels.botconsole.send(
    `Motivate command used by ${interaction.user.tag}. Sending quote: "${rquote}"`
  );
}

async function snippet(interaction) {
  const concept = interaction.options.getString("concept");

  // Check if the concept exists in the exampleSnippets object
  const codeSnippet = exampleSnippets[concept];

  if (!codeSnippet) {
    return await interaction.reply({
      content: "Sorry, no example found for this concept.",
      flags: MessageFlags.Ephemeral,
    });
  }

  channels.botconsole.send(
    `Snippet command used by ${interaction.user.tag} for concept '${concept}'`
  );

  const snippetEmbed = new EmbedBuilder()
    .setColor("#0099FF") // Set color
    .setTitle(`Example: ${concept.charAt(0).toUpperCase() + concept.slice(1)}`) // Title based on the concept
    .setDescription(
      `Here is an example for **${concept.charAt(0).toUpperCase() + concept.slice(1)
      }**:`
    )
    .addFields({
      name: "Code Snippet",
      value: `\`\`\`js\n${codeSnippet}\n\`\`\``,
      inline: false,
    })
    .setFooter({
      text: `Requested by ${interaction.user.tag}`,
      iconURL: interaction.user.avatarURL(),
    })
    .setTimestamp();

  // Send the embed reply
  await interaction.reply({ embeds: [snippetEmbed] });
}

async function docService(interaction) {
  const service = interaction.options.getString("service");

  // Check if the service exists in the serviceDocs object
  const docLink = serviceDocs[service];

  if (!docLink) {
    return await interaction.reply({
      content: "Sorry, no documentation found for this service.",
      flags: MessageFlags.Ephemeral,
    });
  }

  channels.botconsole.send(
    `Doc service command used by ${interaction.user.tag} for service '${service}'`
  );

  const docEmbed = new EmbedBuilder()
    .setColor("#0099FF") // Set color
    .setTitle(`Documentation for ${service}`)
    .setDescription(
      `You can find the official documentation for **${service}** below:`
    )
    .addFields({
      name: "Documentation Link",
      value: `[Click here to view the documentation](${docLink})`,
      inline: false,
    })
    .setFooter({
      text: `Requested by ${interaction.user.tag}`,
      iconURL: interaction.user.avatarURL(),
    })
    .setTimestamp();

  // Send the embed reply
  await interaction.reply({ embeds: [docEmbed] });
}

async function suggest(interaction) {
  const user1 = interaction.options.getUser("user");
  const advice = interaction.options.getString("advice");

  const sembed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("💡 Suggestion")
    .setDescription(`**User:** ${user1.tag}\n**Advice:** ${advice}`)
    .setFooter({ text: `Requested by ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.reply({ embeds: [sembed] });
}

async function getWikipediaSummary(query) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    query
  )}`;

  const res = await fetch(url);

  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Wikipedia API error");

  const data = await res.json();

  return {
    title: data.title,
    extract: data.extract,
    url: data.content_urls?.desktop?.page,
    thumbnail: data.thumbnail?.source,
  };
}

async function wikiSearch(interaction) {
  const query = interaction.options.getString("query");

  await interaction.deferReply();

  const result = await getWikipediaSummary(query);

  if (!result) {
    return interaction.editReply(`No Wikipedia page found for **${query}**.`);
  }

  const embed = new EmbedBuilder()
    .setTitle(result.title)
    .setDescription(result.extract)
    .setURL(result.url)
    .setColor(0x1a1a1a);

  if (result.thumbnail) {
    embed.setThumbnail(result.thumbnail);
  }

  await interaction.editReply({ embeds: [embed] });
}

async function gitfind(interaction) {
  const author = interaction.options.getString("author");
  const repo = interaction.options.getString("repository_name");

  const url = `https://api.github.com/repos/${author}/${repo}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return await interaction.reply({
        content: `❌ Could not find repository \`${author}/${repo}\`.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const data = await response.json();

    const embed = {
      color: 0x24292e,
      title: data.full_name,
      url: data.html_url,
      description: data.description || "No description provided.",
      fields: [
        {
          name: "⭐ Stars",
          value: `${data.stargazers_count}`,
          inline: true,
        },
        {
          name: "🍴 Forks",
          value: `${data.forks_count}`,
          inline: true,
        },
        {
          name: "🐛 Issues",
          value: `${data.open_issues_count}`,
          inline: true,
        },
      ],
      footer: {
        text: `Last updated`,
      },
      timestamp: new Date(data.updated_at),
    };

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error("GitHub fetch error:", error);
    await interaction.reply({
      content: `⚠️ An error occurred while fetching repo info.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function challenge(interaction) {
  // Make sure it is in a server
  if (!interaction.inGuild()) {
    return await interaction.reply({
      content: "This command can't be used in DMs.",
      flags: MessageFlags.Ephemeral,
    });
  }

  // Make sure that user is an admin
  if (!interaction.member.permissions.has("Administrator")) {
    return await interaction.reply({
      content: "Only server admins can use this command.",
      flags: MessageFlags.Ephemeral,
    });
  }

  // Get details from the interaction
  const prompt = interaction.options.getString("prompt");
  const duration = interaction.options.getInteger("duration");

  // Create Thread
  const thread = await interaction.channel.threads.create({
    name: `Challenge - ${prompt}`,
    autoArchiveDuration: 60,
    reason: "Timed coding challenge created",
  });

  // Make collector pt.1
  const endTime = Date.now() + duration * 60 * 1000;
  const challengeId = Date.now().toString();
  const submissions = [];

  // Starting Messages
  const embed = new EmbedBuilder()
    .setColor(0xadec76)
    .setTitle("🔔 Challenge Started!")
    .setDescription("Please submit your code below. One submission per user.")
    .addFields(
      { name: "Prompt", value: `${prompt}`, inline: true },
      { name: "Duration", value: `${duration}`, inline: true }
    )
    .setFooter({ text: `Started by: ${interaction.user.username}` })
    .setTimestamp(interaction.createdTimestamp);
  thread.send({ embeds: [embed] });

  interaction.reply({
    content: `Challenge started in thread <#${thread.id}>`,
    flags: MessageFlags.Ephemeral,
  });

  // Make collector pt.2
  const collector = thread.createMessageCollector({
    time: duration * 60 * 1000,
  });

  const submittedUsers = new Set();

  collector.on("collect", async (msg) => {
    if (msg.author.bot) return;

    const hasAttachment = msg.attachments.size > 0;

    if (!hasAttachment) {
      try {
        await msg.delete();
        await msg.author.send(
          "⚠️ Please submit your code as a file attachment only."
        );
        channels.botconsole.send(
          `Deleted message from ${msg.author.tag} (no attachment).`
        );
      } catch (err) {
        console.error(`Could not delete message from ${msg.author.tag}:`, err);
      }
      return;
    }

    if (submittedUsers.has(msg.author.id)) {
      try {
        await msg.delete();
        await msg.author.send(
          "⚠️ You have already submitted your code. Please wait for grading."
        );
        channels.botconsole.send(
          `Deleted duplicate message from ${msg.author.tag}.`
        );
      } catch (err) {
        console.error(
          `Could not delete duplicate message from ${msg.author.tag}:`,
          err
        );
      }
      return;
    }

    const attachment = msg.attachments.first();
    let fileContent = "";

    try {
      const response = await fetch(attachment.url);
      fileContent = await response.text();

      // Optional: Limit length to avoid crashing DM if file is huge
      if (fileContent.length > 1900) {
        fileContent = fileContent.slice(0, 1900) + "\n... (truncated)";
      }

      const submission = {
        username: msg.author.username,
        userId: msg.author.id,
        content: msg,
        attachment: attachment,
      };

      submissions.push(submission);
      submittedUsers.add(msg.author.id);

      channels.botconsole.send(
        `✅ Accepted and read submission from ${msg.author.tag}`
      );
    } catch (err) {
      console.error(
        `❌ Failed to fetch or read attachment from ${msg.author.tag}:`,
        err
      );
      msg.author.send(
        "⚠️ Something went wrong reading your submission. Please try again."
      );
    }
  });

  // When the challenge ends
  collector.on("end", async () => {
    thread.send(
      "⏱️ The challenge is now closed. Results will be posted in some days."
    );
    thread.setLocked(true);

    const user = interaction.user;
    if (submissions.length === 0) {
      user.send("No submissions were received for your challenge.");
      return;
    }

    for (const sub of submissions) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`grade_${sub.userId}_${challengeId}`)
          .setLabel("Grade")
          .setStyle(ButtonStyle.Primary)
      );

      const response = await fetch(sub.attachment.url);
      const buffer = await response.arrayBuffer();

      const file = new AttachmentBuilder(Buffer.from(buffer), {
        name: sub.attachment.name,
      });

      await user.send({
        content: `**Submission from ${sub.username}**:\n${sub.content}`,
        components: [row],
        files: [file],
      });
    }

    const grades = {};
    const graded = new Set();

    const dmCollector = user.dmChannel.createMessageComponentCollector({
      filter: (i) => i.customId.startsWith("grade_"),
      time: 1000 * 60 * 60,
    });

    dmCollector.on("collect", async (interaction) => {
      const [, userId, id] = interaction.customId.split("_");
      if (graded.has(userId)) {
        await interaction.reply({
          content: "You've already graded this submission.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`modal_${userId}_${id}`)
        .setTitle("Grade Submission")
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("score")
              .setLabel("Score out of 100")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );

      await interaction.showModal(modal);
    });

    user.client.on("interactionCreate", async (interaction) => {
      if (!interaction.isModalSubmit()) return;

      const [_, userId, id] = interaction.customId.split("_");
      const score = interaction.fields.getTextInputValue("score");

      if (isNaN(score) || score < 0 || score > 100) {
        if (interaction.deferred || interaction.replied) {
          try {
            await interaction.followUp({
              content: "You've already graded this submission.",
              flags: MessageFlags.Ephemeral,
            });
          } catch (e) {
            console.warn("Failed to follow up:", e);
          }
        } else {
          try {
            await interaction.reply({
              content: "You've already graded this submission.",
              flags: MessageFlags.Ephemeral,
            });
          } catch (e) {
            console.warn("Failed to reply:", e);
          }
        }
      }

      grades[userId] = score;
      graded.add(userId);
      await interaction.reply({
        content: `Graded submission with a score of ${score}.`,
        flags: MessageFlags.Ephemeral,
      });

      if (graded.size === submissions.length) {
        let csv = "Username,Score\n";
        for (const sub of submissions) {
          const score = grades[sub.userId] ?? "N/A";
          csv += `"${sub.username}","${score}"\n`;
        }

        const buffer = Buffer.from(csv, "utf-8");
        const attachment = new AttachmentBuilder(buffer, {
          name: "challenge_results.csv",
        });

        await thread.send({
          content: "📊 All submissions have been graded. Here are the results:",
          files: [attachment],
        });
      }
    });
  });
}

async function schedule(interaction) {
  // Make sure it is in a server
  if (!interaction.inGuild()) {
    return await interaction.reply({
      content: "This command can't be used in DMs.",
      flags: MessageFlags.Ephemeral,
    });
  }

  // Make sure that user is an admin
  if (!interaction.member.permissions.has("Administrator")) {
    return await interaction.reply({
      content: "Only server admins can use this command.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const commandName = interaction.options.getString("command");
  const argsJson = interaction.options.getString("args") || "[]";

  const year = interaction.options.getInteger("year");
  const month = interaction.options.getInteger("month") - 1; // JS months are 0-indexed
  const day = interaction.options.getInteger("day");
  const hour = interaction.options.getInteger("hour");
  const minute = interaction.options.getInteger("minute");

  let parsedArgs;
  try {
    parsedArgs = JSON.parse(argsJson);
  } catch (e) {
    return interaction.reply({
      content: "❌ Failed to parse `args`. Make sure it's valid JSON.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const runDate = new Date(year, month, day, hour, minute);
  const now = new Date();
  const delayMs = runDate.getTime() - now.getTime();

  if (delayMs <= 0) {
    return interaction.reply({
      content: "❌ That time is in the past. Please choose a future time.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.reply(
    `✅ Scheduled \`${commandName}\` to run at ${runDate.toLocaleString()}.`
  );

  setTimeout(async () => {
    const cmd = allCommands.find((c) => c.commandName1 === commandName);
    if (!cmd) return;

    const channel = await interaction.client.channels.fetch(
      interaction.channel.id
    );
    const user = await interaction.client.users.fetch(interaction.user.id);

    const fakeInteraction = {
      user,
      channel,
      options: {
        getString: (name) => {
          const opt = parsedArgs.find((o) => o.name === name);
          return opt?.value ?? null;
        },
        getInteger: (name) => {
          const opt = parsedArgs.find((o) => o.name === name);
          return opt?.value ?? null;
        },
        getUser: (name) => {
          const opt = parsedArgs.find((o) => o.name === name);
          return interaction.client.users.fetch(opt?.value);
        },
        data: parsedArgs,
      },
      deferReply: () => Promise.resolve(),
      reply: (content) => channel.send(content),
      editReply: (content) => channel.send(content),
      followUp: (content) => channel.send(content),
      replied: false,
      deferred: false,
    };

    try {
      await cmd.execute(fakeInteraction);
    } catch (err) {
      console.error(`Error executing scheduled command: ${err}`);
      channel.send(
        `❌ Failed to execute scheduled command \`${commandName}\`.`
      );
    }
  }, delayMs);
}

async function sendMessage(interaction) {
  // Get the channel and message content
  const channel = interaction.options.getChannel("channel");
  const messageContent = interaction.options.getString("message");

  if (!channel || !messageContent) {
    return await interaction.reply({
      content: "Please specify a valid channel and message.",
      flags: MessageFlags.Ephemeral,
    });
  }

  try {
    await channel.send(messageContent);
    await interaction.reply({
      content: `✅ Message sent to ${channel}.`,
      flags: MessageFlags.Ephemeral,
    });
    channels.botconsole.send(
      `Message sent by ${interaction.user.tag} to ${channel.name}`
    );
  } catch (error) {
    console.error(`Failed to send message: ${error}`);
    await interaction.reply({
      content: "❌ Failed to send the message.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function cleanup(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      content: "This command can only be used in a server.",
      ephemeral: true
    });
  }

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: "Only server admins can use this command.",
      ephemeral: true
    });
  }

  const ignore = interaction.options.getString("ignore"); // "bot", "user" or null
  const channel = interaction.channel;

  try {
    // lock channel while cleaning
    const everyoneRole = interaction.guild.roles.everyone;
    const originalOverwrite = channel.permissionOverwrites.cache.get(everyoneRole.id);
    await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false });

    let totalDeleted = 0;
    let lastMessageId;

    while (true) {
      const options = { limit: 100 };
      if (lastMessageId) options.before = lastMessageId;

      const messages = await channel.messages.fetch(options);
      if (!messages.size) break;

      const botId = interaction.client.user.id;

      const toDelete = messages.filter(msg => {
        // if (msg.author.id === botId) return false; // skip our own messages
        if (!ignore) return true;
        if (ignore === 'bot') return !msg.author.bot;
        if (ignore === 'user') return msg.author.bot;
        return true;
      });

      // show starting embed immediately
      const startEmbed = new EmbedBuilder()
        .setTitle("🧹 Cleanup Started")
        .setDescription(
          `Cleaning messages in <#${channel.id}>${ignore ? ` (ignoring ${ignore})` : ""}…`
        )
        .setColor("Orange")
        .setTimestamp();

      await interaction.reply({ embeds: [startEmbed] });

      if (!toDelete.size) break;

      const now = Date.now();
      const young = toDelete.filter(m => now - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
      const old = toDelete.filter(m => now - m.createdTimestamp >= 14 * 24 * 60 * 60 * 1000);

      if (young.size) {
        const deleted = await channel.bulkDelete(young, true);
        totalDeleted += deleted.size;
      }

      for (const msg of old.values()) {
        try {
          await msg.delete();
          totalDeleted++;
          await new Promise(r => setTimeout(r, 500)); // avoid rate limit
        } catch (e) {
          console.error(`Failed to delete message ${msg.id}:`, e);
        }
      }

      lastMessageId = messages.last().id;
      if (messages.size < 100) break;
    }

    // unlock channel
    if (originalOverwrite) {
      await channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: originalOverwrite.deny.has(PermissionFlagsBits.SendMessages)
          ? false
          : null
      });
    } else {
      await channel.permissionOverwrites.delete(everyoneRole).catch(() => { });
    }

    // finished embed + OK button
    const endEmbed = new EmbedBuilder()
      .setTitle("✅ Cleanup Finished")
      .setDescription(`Deleted **${totalDeleted}** messages in <#${channel.id}>${ignore ? ` (ignoring ${ignore})` : ""}.`)
      .setColor("Green")
      .setTimestamp();

    const okButton = new ButtonBuilder()
      .setCustomId(`cleanup_ok_${interaction.id}`)
      .setLabel("OK")
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(okButton);

    // edit the original reply to show finished state + OK button
    await interaction.editReply({
      embeds: [endEmbed],
      components: [row]
    });
  } catch (err) {
    console.error("Error cleaning up messages:", err);
    await interaction.editReply("❌ Failed to delete messages. Do I have permission?");
  }
}
// #endregion

// #region Shutdown Handling
async function shutdown(reason) {
  const timestamp = `<t:${Math.floor(Date.now() / 1000)}:F>`; // Discord rich timestamp

  try {
    console.log(`[${new Date().toISOString()}] ⚠️ Shutting down: ${reason}`);

    if (channels.botconsole) {
      await channels.botconsole.send(
        `🛑 Bot shutting down...\n**Reason:** ${reason}\n**Time:** ${timestamp}`
      );
    }
  } catch (err) {
    console.error("Error during shutdown:", err);
  } finally {
    process.exit(0);
  }
}

// Catch normal exits
process.on("exit", (code) => shutdown(`Process exit with code ${code}`));

// Catch Ctrl+C / kill signals
process.on("SIGINT", () => shutdown("SIGINT (Ctrl+C)"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Catch uncaught exceptions/rejections
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  shutdown("Uncaught Exception");
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  shutdown("Unhandled Rejection");
});
// #endregion

// #region Client Setup

client.on("ready", () => {
  console.log(`🤖 Bot is online as ${client.user.tag}`);
  const startchat = allCommands.find((cmd) => cmd.commandName1 === "startchat");
  if (startchat && typeof startchat.listenToFeeds === "function") {
    startchat.listenToFeeds(client);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isAutocomplete())
    return;

  // Find the command in the array by name
  const command = commands.find((cmd) => cmd.commandName1 === "startchat");
  if (!command) return; // command not found, ignore

  try {
    if (interaction.isChatInputCommand()) {
      await command.execute(interaction);
    } else if (interaction.isAutocomplete()) {
      await command.autocomplete(interaction);
    }
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}:`, error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error executing this command!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "There was an error executing this command!",
        ephemeral: true,
      });
    }
  }
});

client.on("interactionCreate", async i => {
  if (!i.isButton()) return;

  if (i.customId.startsWith("cleanup_ok_")) {
    await i.deferUpdate(); // acknowledge click
    await i.message.delete().catch(() => { }); // delete the reply embed
  }
});


// client.on('interactionCreate', async interaction => {
//   if (!interaction.isModalSubmit()) return;
//   if (!interaction.customId.startsWith('rate_')) return;

//   const [_, threadId, userId] = interaction.customId.split('_');
//   const score = interaction.fields.getTextInputValue('score');
//   const challenge = activeChallenges.get(threadId);
//   if (!challenge) return;

//   challenge.grading.set(userId, score);

//   // If all submissions are graded
//   if (challenge.grading.size === challenge.submissions.size) {
//     let csv = "Username,UserID,Score,Code\n";
//     for (const [id, code] of challenge.submissions.entries()) {
//       const score = challenge.grading.get(id);
//       const username = (await interaction.client.users.fetch(id)).tag;
//       csv += `"${username}",${id},${score},"${code.replace(/"/g, '""')}"\n`;
//     }

//     const filePath = `/tmp/results_${threadId}.csv`;
//     fs.writeFileSync(filePath, csv);
//     const attachment = new AttachmentBuilder(filePath);
//     const thread = await interaction.client.channels.fetch(threadId);
//     await thread.send({ content: "📊 Challenge results are in!", files: [attachment] });

//     activeChallenges.delete(threadId);
//   }

//   await interaction.reply({ content: `Saved score of ${score} for <@${userId}>.`, flags: MessageFlags.Ephemeral });
// });

// Slash Command Handling
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  allCommands.forEach((command) => {
    if (interaction.commandName === command.commandName1) {
      command.execute(interaction);
    }
  });
});

// Register Slash Commands (Run this once)
let commands = [];

allCommands.forEach((cmd) => {
  let builder = new SlashCommandBuilder()
    .setName(cmd.commandName1)
    .setDescription(cmd.description);

  if (cmd.adminOnly) {
    builder.setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    );
    builder.setContexts([0]);
  }

  if (cmd.options) {
    cmd.options.forEach((opt) => {
      switch (opt.type) {
        case "string":
          builder.addStringOption((option) => {
            option
              .setName(opt.name)
              .setDescription(opt.description)
              .setRequired(opt.required);
            if (opt.choices && Array.isArray(opt.choices)) {
              option.addChoices(...opt.choices); // <-- THIS IS CORRECT
            }
            return option;
          });
          break;

        case "integer":
          builder.addIntegerOption((option) => {
            option
              .setName(opt.name)
              .setDescription(opt.description)
              .setRequired(opt.required);
            if (opt.choices && Array.isArray(opt.choices)) {
              option.addChoices(...opt.choices);
            }
            return option;
          });
          break;

        case "user":
          builder.addUserOption((option) =>
            option
              .setName(opt.name)
              .setDescription(opt.description)
              .setRequired(opt.required)
          );
          break;

        case "boolean":
          builder.addBooleanOption((option) =>
            option
              .setName(opt.name)
              .setDescription(opt.description)
              .setRequired(opt.required)
          );
          break;

        case "channel":
          builder.addChannelOption((option) =>
            option
              .setName(opt.name)
              .setDescription(opt.description)
              .setRequired(opt.required)
              .addChannelTypes(
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement
              )
          );
          break;
        // Add more types if needed
      }
    });
  }

  commands.push(builder.toJSON());
});

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });
  } catch (error) {
    console.error(error);
  }
})();

client.login(process.env.TOKEN);

// #endregion