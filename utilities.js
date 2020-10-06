const Discord = require('discord.js');
const { logChannel } = require('./config.json');

module.exports = {
	/**
	 * Replace certain characters with that character plus a zero-width space
	 * @param {*} text - Text to clean up
	 */
	clean(text) {
		if (typeof text === 'string')
			return text
				.replace(/`/g, '`' + String.fromCharCode(8203))
				.replace(/@/g, '@' + String.fromCharCode(8203));
		else return text;
	},

	/**
	 * Find a channel by its ID
	 * @param {Object} discordMessage - Discord message object
	 * @param {string} channelID - ID of the channel you want
	 */
	findChannel(discordMessage, channelID) {
		return discordMessage.guild.channels.cache.find(
			(channel) => channel.id === channelID
		);
	},

	/**
	 * Get a message's attachments.
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
	 * @param {Object} discordMessage - Discord message object
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
	 * Create an embed message for moderator actions
	 * @param {string} action - Name of the action being taken
	 * @param {Object} author - Object containing the author's information
	 * @param {boolean} isAutomatic - Whether or not the action was automatically performed
	 * @param {Object} target - Object containing the target's information
	 * @param {string} reason - Why the action was taken
	 * @param {string} color - Color of the embed's border
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
	 * Perform a moderator action
	 * @param {Object} discordMessage - Discord message object
	 * @param {Object} action - Object containing action information
	 * @param {Object} Client - Discord client object
	 */
	modAction(discordMessage, action, Client) {
		// Don't let unprivileged users run perform mod actions
		const canTakeAction = discordMessage.channel
			.permissionsFor(discordMessage.member)
			.has(action.perm, false);
		if (!canTakeAction)
			return discordMessage.reply(
				`you're missing the \`${action.perm}\` permission required for that command.`
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

				const modEmbed = module.exports.modEmbed(
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

	/**
	 * Check if a user is banned
	 * @param {Object} discordMessage - Discord message object
	 * @param {*} userID - ID of the user
	 * @returns {boolean}
	 */
	async checkIfBanned(discordMessage, userID) {
		let banList, isBanned;

		try {
			banList = await discordMessage.guild.fetchBans();
			isBanned = banList.find((list) => list.user.id === userID);
		} catch (error) {
			console.error(error);
		}

		if (isBanned) isBanned = true;
		else isBanned = false;

		console.log('from checkIfBanned():', isBanned, userID);

		return isBanned;
	},

	/**
	 * Trim off the text that marks a user ID as a ping
	 * @param {string} userID - User ID to trim
	 */
	trimUserID(userID) {
		let id = userID;

		// If the id is a ping trim the ping text off
		if (id.startsWith('<@!')) {
			id = userID.substring(3);
			id = id.substring(0, id.length - 1);
		}

		return id;
	},
};
