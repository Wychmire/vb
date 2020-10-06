'use strict';

const Discord = require('discord.js');
const Client = new Discord.Client();
const {
	prefix,
	token,
	bannedWordList,
	userIDs,
	logChannel,
	commandList,
} = require('./config.json');

const utils = require('./utilities');
const cmds = require('./commands');

const bot = {
	// Listen for Discord messages
	listen() {
		// Listen for users joining
		Client.on('guildMemberAdd', (member) => {
			// Send a message to the user log channel mentioning the arrival
			Client.channels.cache
				.get(logChannel.user)
				.send(
					`${member} (\`${
						member.id
					}\`) joined the server at \`${new Date().toUTCString()}\`.`
				);
		});

		// Listen for users leaving
		Client.on('guildMemberRemove', (member) => {
			// Send a message to the user log channel mentioning the departure
			Client.channels.cache
				.get(logChannel.user)
				.send(
					`${member} (\`${
						member.id
					}\`) left the server at \`${new Date().toUTCString()}\`.`
				);
		});

		// Listen for messages
		Client.on('message', (discordMessage) => {
			const logChannels = {
				actions: utils.findChannel(discordMessage, logChannel.action),
				messages: utils.findChannel(discordMessage, logChannel.message),
			};

			// Check the message for banned words
			// If the message contains a banned word and it wasn't sent by a
			// bot, remove the message and ping the user
			for (let word in bannedWordList) {
				const usedBannedWord = discordMessage.content
					.toLowerCase()
					.includes(word);

				if (usedBannedWord && !discordMessage.author.bot) {
					discordMessage.delete();
					discordMessage.reply(`you used a banned word!`);

					const modEmbed = utils.modEmbed(
						'Warn',
						{
							name: `Automatic action`,
							avatar:
								'https://cdn.discordapp.com/avatars/760300941961854976/3d1940dd0973e903fbfaa82587b3a646.png?size=128',
						},
						'Automatic',
						discordMessage.author,
						`Used a banned word (${bannedWordList[word].censored})`,
						'#fdbc4b'
					);

					channels.action.send({
						embed: modEmbed,
					});
					console.log(`Banned words used: ${word}`);

					return;
				}
			}

			if (discordMessage.author.id === userIDs.botID) return;
			else {
				let hasAttachments;
				if (discordMessage.attachments.size) {
					hasAttachments = true;
				} else {
					hasAttachments = false;
				}

				let logMessageExtra = `
content = '''
${Discord.Util.cleanCodeBlockContent(discordMessage.content)}
'''

[message.attachments]
hasAttachments = ${hasAttachments}`;

				if (hasAttachments) {
					logMessageExtra += `\n${utils.getAttachments(discordMessage)}`;
				}

				const logMessage = utils.messageLog(
					discordMessage,
					'New message',
					logMessageExtra
				);

				logChannels.messages.send(logMessage, { split: true });
			}

			// Don't do anything if the message doesn't start with the prefix or
			// is sent by a bot
			if (
				!discordMessage.content.startsWith(prefix) ||
				discordMessage.author.bot
			)
				return;

			// Get the args by removing characters from the message equal to the
			// length of the prefix, trimming any whitespace off, then splitting
			// the message into an array along whitespace
			const args = discordMessage.content
				.slice(prefix.length)
				.trim()
				.split(/ +/);
			// Since the command name will always be the first word we can just
			// grab that.
			const commandName = args.shift().toLowerCase();
			// Check if the command is in the list and don't do anything if it
			// isn't.
			const isCommand = commandList.hasOwnProperty(commandName);
			if (!isCommand || !cmds[commandName]) {
				return discordMessage.reply(
					`\`${commandName}\` isn't a valid command!`
				);
			}

			// If the command requires args and the user didn't provide any let
			// them know
			if (commandList[commandName].hasArgs && !args.length) {
				let reply = `you didn't provide any arguments!`;

				// If the command has a usage string add it to the reply
				if (commandList[commandName].usage) {
					reply += `\nThe proper usage would be: \`${prefix}${commandName} ${commandList[commandName].usage}\``;
				}

				return discordMessage.reply(reply);
			}

			// If everything has gone correctly so far run attempt to run the
			// command
			try {
				cmds[commandName](discordMessage, args, Client);
			} catch (error) {
				console.error(error);
				message.reply('there was an error trying to execute that command.');
			}
		});

		Client.on('messageUpdate', (oldMessage, newMessage) => {
			if (oldMessage.author.id === userIDs.botID) return;

			const logChannels = {
				actions: utils.findChannel(oldMessage, logChannel.action),
				messages: utils.findChannel(oldMessage, logChannel.message),
			};

			let logMessageExtra = `
[message.old]
content = '''
${Discord.Util.cleanCodeBlockContent(oldMessage.content)}
'''

[message.new]
content = '''
${Discord.Util.cleanCodeBlockContent(newMessage.content)}
'''`;

			const logMessage = utils.messageLog(
				oldMessage,
				'Edited message',
				logMessageExtra
			);

			logChannels.messages.send(logMessage, { split: true });
		});

		Client.on('messageDelete', (discordMessage) => {
			if (discordMessage.author.id === userIDs.botID) return;

			const logChannels = {
				messages: utils.findChannel(discordMessage, logChannel.message),
			};

			let hasAttachments;
			if (discordMessage.attachments.size) {
				hasAttachments = true;
			} else {
				hasAttachments = false;
			}

			let logMessageExtra = `
content = '''
${Discord.Util.cleanCodeBlockContent(discordMessage.content)}
'''

[message.attachments]
hasAttachments = ${hasAttachments}`;

			if (hasAttachments) {
				logMessageExtra += `\n${utils.getAttachments(discordMessage)}`;
			}

			const logMessage = utils.messageLog(
				discordMessage,
				'Deleted message',
				logMessageExtra
			);

			logChannels.messages.send(logMessage, { split: true });
		});
	},

	// Initilize the bot
	onload() {
		// Login to Discord with your app's token
		Client.login(token);

		// Print a ready message
		console.info(`Ready`);

		console.log(utils);

		// Listen for Discord messages
		this.listen();
	},
};

// Start the bot
bot.onload();
