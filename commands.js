const utils = require('./utilities');

const { bannedWordList, userIDs } = require('./config.json');

module.exports = {
	/**
	 * Warn a user
	 * @param {Object} discordMessage - Discord message object
	 * @param {Array} args - Command arguments
	 * @param {Object} client - Discord client
	 */
	warn(discordMessage, args, client) {
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

		utils.modAction(discordMessage, msgObj, client);
	},

	/**
	 * Kick a user
	 * @param {Object} discordMessage - Discord message object
	 * @param {Array} args - Command arguments
	 * @param {Object} client - Discord client
	 */
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

	/**
	 * Ban a user
	 * @param {Object} discordMessage - Discord message object
	 * @param {Array} args - Command arguments
	 * @param {Object} client - Discord client
	 */
	ban(discordMessage, args, client) {
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

				utils.modAction(discordMessage, msgObj, client);
			})
			.catch((error) => console.error(error));
	},

	/**
	 * Unban a user
	 * @param {Object} discordMessage - Discord message object
	 * @param {Array} args - Command arguments
	 * @param {Object} client - Discord client
	 */
	unban(discordMessage, args, client) {
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

				utils.modAction(discordMessage, msgObj, client);
			})
			.catch((error) => console.error(error));
	},

	/**
	 * DM a user the list of banned words
	 * @param {Object} discordMessage - Discord message object
	 */
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

	/**
	 * Evaluate string as javascript. WARNING: VERY DANGEROUS
	 * @param {Object} discordMessage - Discord message object
	 */
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
