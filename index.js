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

const utils = {
	clean(text) {
		if (typeof text === 'string')
			return text
				.replace(/`/g, '`' + String.fromCharCode(8203))
				.replace(/@/g, '@' + String.fromCharCode(8203));
		else return text;
	},

	findChannel(discordMessage, channelID) {
		return discordMessage.guild.channels.cache.find(
			(channel) => channel.id === channelID
		);
	},

	/**
	 * Get a list of attachments.
	 * @param {Object} discordMessage - Discord message object
	 */
	getAttachments(discordMessage) {
		// Exit if there are no attachments
		if (!discordMessage.attachments.size) return;

		// Empty array for storing the list of attachments
		const data = [];

		// Append the name of each attachment and its url to the data array
		discordMessage.attachments.forEach((attachment, index) => {
			data.push(`attachment-${index} = "${attachment.url}"`);
		});

		// Return the list of attachments
		return data;
	},

	/**
	 * Log a message.
	 * @param {Object} discordMessage - A Discord message
	 * @param {string} type - Type of message
	 * @param {string} extra - Optional extra text to be appended to the message
	 */
	messageLog(discordMessage, type, extra) {
		let newMessage = `\`\`\`toml
[message]
type = "${type}"

author = "${discordMessage.author.username}#${discordMessage.author.discriminator}"
author_id = "${discordMessage.author.id}"
channel = "#${discordMessage.channel.name}"
url = "https://discord.com/channels/${discordMessage.guild.id}/${discordMessage.channel.id}/${discordMessage.id}"
`;

		if (extra) newMessage += `${extra}\n\`\`\``;
		else newMessage += `\`\`\``;

		return newMessage;
	},

	/**
	 * Create an embed message for moderator actions.
	 * @param {string} action - Name of the moderator action
	 * @param {Object} author - Moderator performing the action
	 * @param {string} type - Type of action (`Moderator` or `Automatic`)
	 * @param {Object} target - Target of the action
	 * @param {string} color - Color of the embed bar
	 */
	modEmbed(action, author, type, target, reason, color) {
		return new Discord.MessageEmbed()
			.setColor(color)
			.setTitle(`${type} action: __${action}__`)
			.setAuthor(author.name, author.avatar)
			.addFields(
				{ name: `Target's Username`, value: target, inline: true },
				{ name: `Target's ID`, value: target.id, inline: true },
				{ name: `Reason`, value: reason }
			)
			.setTimestamp();
	},

	/**
	 * Perform a moderator action.
	 * @param {Object} discordMessage - A Discord message
	 * @param {Object} action - An object containing the values required to send the message
	 * @param {array} action.args - Reason the action has been taken
	 * @param {string} action.type - Type of action (`Moderator` or `Automatic`)
	 * @param {string} action.name - Name of the action being performed
	 * @param {string} action.perm - Permission required to send the action
	 * @param {string} action.target - Target of the action
	 * @param {string} action.color - Color of the embed
	 */
	modAction(discordMessage, action) {
		// Don't let unprivileged users run perform mod actions
		const canTakeAction = discordMessage.channel
			.permissionsFor(discordMessage.member)
			.has(action.perm, false);
		if (!canTakeAction)
			return discordMessage.reply(
				`You're missing the \`${permission}\` permission required for that command.`
			);

		// Get the channel we need to send our logs to
		const channel = discordMessage.guild.channels.cache.find(
			(ch) => ch.id === logChannel.action
		);

		// Get the ban reason and if there is none set a generic message
		let reason = action.args.slice(1).join(' ');
		if (!reason) {
			reason = `No reason specified, contact ${discordMessage.author} for details`;
		}

		const actionObj = {
			kick(target) {
				discordMessage.guild.member(target).kick(reason);
			},
			ban(target) {
				discordMessage.guild.members.ban(target, { reason: reason });
			},
			unban(target) {
				discordMessage.guild.members
					.unban(target)
					.catch((error) => console.log(error));
			},
			warn() {},
		};

		Client.users
			.fetch(action.target)
			.then((target) => {
				actionObj[action.type](target);

				const modEmbed = utils.modEmbed(
					action.type.charAt(0).toUpperCase() + action.type.slice(1),
					{
						name: `${discordMessage.author.username}#${discordMessage.author.discriminator}`,
						avatar: discordMessage.author.avatarURL(),
					},
					action.performer,
					target,
					reason,
					action.color
				);

				channel.send({
					embed: modEmbed,
				});

				discordMessage.reply(
					`successfully performed action \`${action.type}\` on user \`${action.target}\` and logged a message to <#${logChannel.action}>.`
				);
			})
			.catch((error) => {
				discordMessage.reply(
					`Someting went wrong. Is ${action.target} a valid user?`
				);
				console.error(error);
			});
	},

	// Check if a user is banned
	async checkIfBanned(discordMessage, user) {
		// Get the list of banned users
		let banList, isBanned;

		try {
			banList = await discordMessage.guild.fetchBans();
			isBanned = banList.find((list) => list.user.id === user);
		} catch (error) {
			console.error(error);
		}

		if (isBanned) isBanned = true;
		else isBanned = false;

		console.log('from checkIfBanned():', isBanned);

		return isBanned;
	},

	// Trim the ping text off of user ids
	trimUserID(userID) {
		let id = userID;

		// If the target is a ping we need to chop off the ping text
		if (id.startsWith('<@!')) {
			id = userID.substring(3);
			id = id.substring(0, id.length - 1);
		}

		return id;
	},
};

const cmds = {
	// Warn a user
	warn(discordMessage, args) {
		const target = utils.trimUserID(args[0]);

		if (!discordMessage.guild.member(target))
			return discordMessage.reply(`that user doesn't seem to be here.`);

		const msgObj = {
			args: args,
			type: 'warn',
			performer: 'Moderator',
			perm: 'VIEW_AUDIT_LOG',
			target: target,
			color: '#fdbc4b',
		};

		utils.modAction(discordMessage, msgObj);
	},

	// Kick a user
	kick(discordMessage, args) {
		const target = utils.trimUserID(args[0]);

		if (!discordMessage.guild.member(target))
			return discordMessage.reply(`that user doesn't seem to be here.`);

		const msgObj = {
			args: args,
			type: 'kick',
			performer: 'Moderator',
			perm: 'KICK_MEMBERS',
			target: target,
			color: '#f67400',
		};

		utils.modAction(discordMessage, msgObj);
	},

	// Ban a user
	ban(discordMessage, args) {
		const target = utils.trimUserID(args[0]);

		utils
			.checkIfBanned(discordMessage, target)
			.then((isBanned) => {
				if (isBanned)
					return discordMessage.reply(`that user has already been banned`);

				const msgObj = {
					args: args,
					type: 'ban',
					performer: 'Moderator',
					perm: 'BAN_MEMBERS',
					target: target,
					color: '#ed1515',
				};

				utils.modAction(discordMessage, msgObj);
			})
			.catch((error) => console.error(error));
	},

	// Unban a user
	unban(discordMessage, args) {
		const target = utils.trimUserID(args[0]);

		utils
			.checkIfBanned(discordMessage, target)
			.then((isBanned) => {
				if (!isBanned) return discordMessage.reply(`that user is not banned`);

				const msgObj = {
					args: args,
					type: 'unban',
					performer: 'Moderator',
					perm: 'BAN_MEMBERS',
					target: target,
					color: '#1d99d3',
				};

				utils.modAction(discordMessage, msgObj);
			})
			.catch((error) => console.error(error));
	},

	// DM a user a list of banned words
	bannedwords(discordMessage) {
		const data = [`Here's a list of all the banned words:`];

		console.log(bannedWordList);

		for (const word in bannedWordList) {
			// Send the words as a list
			data.push(
				`> — \`${bannedWordList[word].censored}\`: ${bannedWordList[word].reason}\n`
			);
		}

		return discordMessage.author
			.send(data, { split: true })
			.then(() => {
				if (discordMessage.channel.type === 'dm') return;
				discordMessage.reply("I've sent you a DM with a list of banned words.");
			})
			.catch((error) => {
				console.error(
					`Could not send banned word list DM to ${discordMessage.author.tag}.\n`,
					error
				);
				discordMessage.reply("it seems like I can't DM you!");
			});
	},

	eval(discordMessage, args) {
		if (discordMessage.author.id !== userIDs.ownerID)
			return discordMessage.reply(
				`you must be the bot owner to use this command.`
			);
		try {
			const code = args.join(' ');
			let evaled = eval(code);

			if (typeof evaled !== 'string') evaled = require('util').inspect(evaled);

			discordMessage.channel.send(utils.clean(evaled), { code: 'xl' });
		} catch (err) {
			discordMessage.channel.send(
				`\`ERROR\` \`\`\`xl\n${utils.clean(err)}\n\`\`\``
			);
		}
	},
};

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
				cmds[commandName](discordMessage, args);
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

		// Listen for Discord messages
		this.listen();
	},
};

// Start the bot
bot.onload();
