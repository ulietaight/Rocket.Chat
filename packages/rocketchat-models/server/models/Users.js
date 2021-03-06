import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import { Base } from './_Base';
import Subscriptions from './Subscriptions';
import _ from 'underscore';
import s from 'underscore.string';

const excludedFieldsByDefault = {
	tokens: 0,
	subscriptions: 0,
};

export class Users extends Base {
	constructor(...args) {
		super(...args);

		this.tryEnsureIndex({ roles: 1 }, { sparse: 1 });
		this.tryEnsureIndex({ name: 1 });
		this.tryEnsureIndex({ lastLogin: 1 });
		this.tryEnsureIndex({ status: 1 });
		this.tryEnsureIndex({ active: 1 }, { sparse: 1 });
		this.tryEnsureIndex({ active: 1, name: 1 });
		this.tryEnsureIndex({ name: 1, active: 1 });
		this.tryEnsureIndex({ statusConnection: 1 }, { sparse: 1 });
		this.tryEnsureIndex({ type: 1 });
		this.tryEnsureIndex({ 'visitorEmails.address': 1 });
		this.tryEnsureIndex({ deactivatedUntil: 1 });
		this.tryEnsureIndex({ 'subscriptions._id': 1 }, { unique: 1, partialFilterExpression: { 'subscriptions._id': { $exists: true } } });
		this.tryEnsureIndex({ 'subscriptions.rid': 1 });
		this.tryEnsureIndex({ 'subscriptions.rid': 1, isSubscribedOnNotifications: 1 });
		this.tryEnsureIndex({ 'tokens._id': 1 }, { unique: true, partialFilterExpression: { 'tokens._id': { $exists: true } } });
		this.tryEnsureIndex({ 'tokens.value': 1 });
		this.loadSettings();
	}

	addExculdedFieldsToOptions(options) {
		if (options) {
			if (!options.fields) {
				options.fields = excludedFieldsByDefault;
			} else {
				options.fields = {
					...excludedFieldsByDefault,
					...options.fields,
				};
			}
		} else {
			options = {
				fields: excludedFieldsByDefault,
			};
		}
		return options;
	}

	loadSettings() {
		Meteor.startup(async() => {
			const { settings } = await import('meteor/rocketchat:settings');
			this.settings = settings;
		});
	}

	getLoginTokensByUserId(userId) {
		const query = {
			'services.resume.loginTokens.type': {
				$exists: true,
				$eq: 'personalAccessToken',
			},
			_id: userId,
		};

		return this.find(query, { fields: { 'services.resume.loginTokens': 1 } });
	}

	addPersonalAccessTokenToUser({ userId, loginTokenObject }) {
		return this.update(userId, {
			$push: {
				'services.resume.loginTokens': loginTokenObject,
			},
		});
	}

	removePersonalAccessTokenOfUser({ userId, loginTokenObject }) {
		return this.update(userId, {
			$pull: {
				'services.resume.loginTokens': loginTokenObject,
			},
		});
	}

	findPersonalAccessTokenByTokenNameAndUserId({ userId, tokenName }) {
		const query = {
			'services.resume.loginTokens': {
				$elemMatch: { name: tokenName, type: 'personalAccessToken' },
			},
			_id: userId,
		};

		return this.findOne(query);
	}

	findAgents() {
		const query = {
			roles: 'livechat-agent',
		};

		return this.find(query);
	}

	setTokenpassTcaBalances(_id, tcaBalances) {
		const update = {
			$set: {
				'services.tokenpass.tcaBalances': tcaBalances,
			},
		};

		return this.update(_id, update);
	}

	getTokenBalancesByUserId(userId) {
		const query = {
			_id: userId,
		};

		const options = {
			fields: {
				'services.tokenpass.tcaBalances': 1,
			},
		};

		return this.findOne(query, options);
	}

	roleBaseQuery(userId) {
		return { _id: userId };
	}

	setE2EPublicAndPivateKeysByUserId(userId, { public_key, private_key }) {
		this.update({ _id: userId }, {
			$set: {
				'e2e.public_key': public_key,
				'e2e.private_key': private_key,
			},
		});
	}

	rocketMailUnsubscribe(_id, createdAt) {
		const query = {
			_id,
			createdAt: new Date(parseInt(createdAt)),
		};
		const update = {
			$set: {
				'mailer.unsubscribed': true,
			},
		};
		const affectedRows = this.update(query, update);
		console.log('[Mailer:Unsubscribe]', _id, createdAt, new Date(parseInt(createdAt)), affectedRows);
		return affectedRows;
	}

	fetchKeysByUserId(userId) {
		const user = this.findOne({ _id: userId }, { fields: { e2e: 1 } });

		if (!user || !user.e2e || !user.e2e.public_key) {
			return {};
		}

		return {
			public_key: user.e2e.public_key,
			private_key: user.e2e.private_key,
		};
	}

	disable2FAAndSetTempSecretByUserId(userId, tempToken) {
		return this.update({
			_id: userId,
		}, {
			$set: {
				'services.totp': {
					enabled: false,
					tempSecret: tempToken,
				},
			},
		});
	}

	enable2FAAndSetSecretAndCodesByUserId(userId, secret, backupCodes) {
		return this.update({
			_id: userId,
		}, {
			$set: {
				'services.totp.enabled': true,
				'services.totp.secret': secret,
				'services.totp.hashedBackup': backupCodes,
			},
			$unset: {
				'services.totp.tempSecret': 1,
			},
		});
	}

	disable2FAByUserId(userId) {
		return this.update({
			_id: userId,
		}, {
			$set: {
				'services.totp': {
					enabled: false,
				},
			},
		});
	}

	update2FABackupCodesByUserId(userId, backupCodes) {
		return this.update({
			_id: userId,
		}, {
			$set: {
				'services.totp.hashedBackup': backupCodes,
			},
		});
	}

	findByIdsWithPublicE2EKey(ids, options) {
		const query = {
			_id: {
				$in: ids,
			},
			'e2e.public_key': {
				$exists: 1,
			},
		};

		return this.find(query, options);
	}

	resetE2EKey(userId) {
		this.update({ _id: userId }, {
			$unset: {
				e2e: '',
			},
		});
	}

	findUsersInRoles(roles, scope, options) {
		roles = [].concat(roles);

		const query = {
			roles: { $in: roles },
		};

		return this.find(query, options);
	}

	findOneByImportId(_id, options) {
		return this.findOne({ importIds: _id }, options);
	}

	findOneByAnonymId(anonymId, options) {
		const query = { 'customFields.anonym_id': parseInt(anonymId, 10) };

		return this.findOne(query, this.addExculdedFieldsToOptions(options));
	}

	findOneByUsername(username, options) {
		const query = { username };

		return this.findOne(query, this.addExculdedFieldsToOptions(options));
	}

	findOneByEmailAddress(emailAddress, options) {
		const query = { 'emails.address': emailAddress };

		return this.findOne(query, options);
	}

	findOneByIdAndLoginToken(_id, token, options) {
		const query = {
			_id,
			'services.resume.loginTokens.hashedToken' : Accounts._hashLoginToken(token),
		};

		return this.findOne(query, options);
	}

	findOneById(userId, options) {
		const query = { _id: userId };

		return this.findOne(query, this.addExculdedFieldsToOptions(options));
	}

	findOneByIdWithCustomFields(userId) {
		const query = { _id: userId };
		const options = {
			fields: {
				username: 1,
				name: 1,
				customFields: 1,
				...excludedFieldsByDefault,
			},
		};
		return this.findOne(query, options);
	}

	// FIND
	findById(userId) {
		const query = { _id: userId };

		return this.find(query);
	}

	findByIds(userIds, options) {
		const query = { _id: { $in: userIds } };

		return this.find(query, this.addExculdedFieldsToOptions(options));
	}

	findUsersNotOffline(options) {
		const query = {
			username: {
				$exists: 1,
			},
			status: {
				$in: ['online', 'away', 'busy'],
			},
		};

		return this.find(query, this.addExculdedFieldsToOptions(options));
	}

	findByRoomId(rid, options) {
		const data = Subscriptions.findByRoomId(rid).fetch().map((item) => item.u._id);
		const query = {
			_id: {
				$in: data,
			},
		};

		return this.find(query, this.addExculdedFieldsToOptions(options));
	}

	findByUsername(username, options) {
		const query = { username };

		return this.find(query, this.addExculdedFieldsToOptions(options));
	}

	findActiveByUsernameOrNameRegexWithExceptions(searchTerm, exceptions, options) {
		if (exceptions == null) { exceptions = []; }
		if (options == null) { options = {}; }
		if (!_.isArray(exceptions)) {
			exceptions = [exceptions];
		}

		const termRegex = new RegExp(s.escapeRegExp(searchTerm));
		const query = {
			$or: [{
				username: termRegex,
			}, {
				name: termRegex,
			}],
			active: true,
			type: {
				$in: ['user', 'bot'],
			},
			$and: [{
				username: {
					$exists: true,
				},
			}, {
				username: {
					$nin: exceptions,
				},
			}],
		};

		return this.find(query, this.addExculdedFieldsToOptions(options));
	}

	findByActiveUsersExcept(searchTerm, exceptions, options, forcedSearchFields) {
		if (exceptions == null) { exceptions = []; }
		if (options == null) { options = {}; }
		if (!_.isArray(exceptions)) {
			exceptions = [exceptions];
		}

		const termRegex = new RegExp(s.escapeRegExp(searchTerm));

		const searchFields = forcedSearchFields || this.settings.get('Accounts_SearchFields').trim().split(',');

		const orStmt = _.reduce(searchFields, function(acc, el) {
			acc.push({ [el.trim()]: termRegex });
			return acc;
		}, []);
		const query = {
			$and: [
				{
					active: true,
					$or: orStmt,
				},
				{
					username: { $exists: true, $nin: exceptions },
				},
			],
		};

		// do not use cache
		return this._db.find(query, this.addExculdedFieldsToOptions(options));
	}

	findUsersByNameOrUsername(nameOrUsername, options) {
		const query = {
			username: {
				$exists: 1,
			},

			$or: [
				{ name: nameOrUsername },
				{ username: nameOrUsername },
			],

			type: {
				$in: ['user'],
			},
		};

		return this.find(query, this.addExculdedFieldsToOptions(options));
	}

	findByUsernameNameOrEmailAddress(usernameNameOrEmailAddress, options) {
		const query = {
			$or: [
				{ name: usernameNameOrEmailAddress },
				{ username: usernameNameOrEmailAddress },
				{ 'emails.address': usernameNameOrEmailAddress },
			],
			type: {
				$in: ['user', 'bot'],
			},
		};

		return this.find(query, this.addExculdedFieldsToOptions(options));
	}

	findLDAPUsers(options) {
		const query = { ldap: true };

		return this.find(query, options);
	}

	findCrowdUsers(options) {
		const query = { crowd: true };

		return this.find(query, options);
	}

	getLastLogin(options) {
		if (options == null) { options = {}; }
		const query = { lastLogin: { $exists: 1 } };
		options.sort = { lastLogin: -1 };
		options.limit = 1;
		const [user] = this.find(query, options).fetch();
		return user && user.lastLogin;
	}

	findUsersByUsernames(usernames, options) {
		const query = {
			username: {
				$in: usernames,
			},
		};

		return this.find(query, this.addExculdedFieldsToOptions(options));
	}

	findUsersByIds(ids, options) {
		const query = {
			_id: {
				$in: ids,
			},
		};
		return this.find(query, this.addExculdedFieldsToOptions(options));
	}

	findUsersWithUsernameByIds(ids, options) {
		const query = {
			_id: {
				$in: ids,
			},
			username: {
				$exists: 1,
			},
		};

		return this.find(query, this.addExculdedFieldsToOptions(options));
	}

	findUsersWithUsernameByIdsNotOffline(ids, options) {
		const query = {
			_id: {
				$in: ids,
			},
			username: {
				$exists: 1,
			},
			status: {
				$in: ['online', 'away', 'busy'],
			},
		};

		return this.find(query, this.addExculdedFieldsToOptions(options));
	}

	getOldest(fields = { _id: 1 }) {
		const query = {
			_id: {
				$ne: 'rocket.cat',
			},
		};

		const options = {
			fields,
			sort: {
				createdAt: 1,
			},
		};

		return this.findOne(query, this.addExculdedFieldsToOptions(options));
	}

	// UPDATE
	addImportIds(_id, importIds) {
		importIds = [].concat(importIds);

		const query = { _id };

		const update = {
			$addToSet: {
				importIds: {
					$each: importIds,
				},
			},
		};

		return this.update(query, update);
	}

	updateLastLoginById(_id) {
		const update = {
			$set: {
				lastLogin: new Date,
			},
		};

		return this.update(_id, update);
	}

	setServiceId(_id, serviceName, serviceId) {
		const update =
		{ $set: {} };

		const serviceIdKey = `services.${ serviceName }.id`;
		update.$set[serviceIdKey] = serviceId;

		return this.update(_id, update);
	}

	setUsername(_id, username) {
		const update =
		{ $set: { username } };

		return this.update(_id, update);
	}

	setEmail(_id, email) {
		const update = {
			$set: {
				emails: [{
					address: email,
					verified: false,
				},
				],
			},
		};

		return this.update(_id, update);
	}

	setEmailVerified(_id, email) {
		const query = {
			_id,
			emails: {
				$elemMatch: {
					address: email,
					verified: false,
				},
			},
		};

		const update = {
			$set: {
				'emails.$.verified': true,
			},
		};

		return this.update(query, update);
	}

	setName(_id, name) {
		const update = {
			$set: {
				name,
			},
		};

		return this.update(_id, update);
	}

	setCustomFields(_id, fields) {
		const values = {};
		Object.keys(fields).forEach((key) => {
			values[`customFields.${ key }`] = fields[key];
		});

		const update = { $set: values };

		return this.update(_id, update);
	}

	setAvatarOrigin(_id, origin) {
		const update = {
			$set: {
				avatarOrigin: origin,
			},
		};

		return this.update(_id, update);
	}

	unsetAvatarOrigin(_id) {
		const update = {
			$unset: {
				avatarOrigin: 1,
			},
		};

		return this.update(_id, update);
	}

	setUserActive(_id, active) {
		if (active == null) { active = true; }
		const update = {
			$set: {
				active,
			},
		};
		if (active) {
			update.$unset = {
				deactivatedUntil: 1,
			};
		}

		return this.update(_id, update);
	}

	deactivate(_id, until, reason) {
		const update = {
			$set: {
				active: false,
				deactivationReason: reason,
			},
		};
		if (until) {
			update.$set.deactivatedUntil = until;
		}

		return this.update(_id, update);
	}

	removeDeactivations() {
		const query = {
			deactivatedUntil: {
				$lte: new Date(),
			},
		};
		const update = {
			$set: {
				active: true,
			},
			$unset: {
				deactivatedUntil: 1,
				deactivationReason: 1,
			},
		};

		return this.update(query, update);
	}


	setAllUsersActive(active) {
		const update = {
			$set: {
				active,
			},
		};

		return this.update({}, update, { multi: true });
	}

	unsetLoginTokens(_id) {
		const update = {
			$set: {
				'services.resume.loginTokens' : [],
			},
		};

		return this.update(_id, update);
	}

	unsetRequirePasswordChange(_id) {
		const update = {
			$unset: {
				requirePasswordChange : true,
				requirePasswordChangeReason : true,
			},
		};

		return this.update(_id, update);
	}

	resetPasswordAndSetRequirePasswordChange(_id, requirePasswordChange, requirePasswordChangeReason) {
		const update = {
			$unset: {
				'services.password': 1,
			},
			$set: {
				requirePasswordChange,
				requirePasswordChangeReason,
			},
		};

		return this.update(_id, update);
	}

	setLanguage(_id, language) {
		const update = {
			$set: {
				language,
			},
		};

		return this.update(_id, update);
	}

	setProfile(_id, profile) {
		const update = {
			$set: {
				'settings.profile': profile,
			},
		};

		return this.update(_id, update);
	}

	clearSettings(_id) {
		const update = {
			$set: {
				settings: {},
			},
		};

		return this.update(_id, update);
	}

	setPreferences(_id, preferences) {
		const settings = Object.assign(
			{},
			...Object.keys(preferences).map((key) => ({ [`settings.preferences.${ key }`]: preferences[key] }))
		);

		const update = {
			$set: settings,
		};
		if (parseInt(preferences.clockMode) === 0) {
			delete update.$set['settings.preferences.clockMode'];
			update.$unset = { 'settings.preferences.clockMode': 1 };
		}

		return this.update(_id, update);
	}

	setUtcOffset(_id, utcOffset) {
		const query = {
			_id,
			utcOffset: {
				$ne: utcOffset,
			},
		};

		const update = {
			$set: {
				utcOffset,
			},
		};

		return this.update(query, update);
	}

	saveUserById(_id, data) {
		const setData = {};
		const unsetData = {};

		if (data.name != null) {
			if (!_.isEmpty(s.trim(data.name))) {
				setData.name = s.trim(data.name);
			} else {
				unsetData.name = 1;
			}
		}

		if (data.email != null) {
			if (!_.isEmpty(s.trim(data.email))) {
				setData.emails = [{ address: s.trim(data.email) }];
			} else {
				unsetData.emails = 1;
			}
		}

		if (data.phone != null) {
			if (!_.isEmpty(s.trim(data.phone))) {
				setData.phone = [{ phoneNumber: s.trim(data.phone) }];
			} else {
				unsetData.phone = 1;
			}
		}

		const update = {};

		if (!_.isEmpty(setData)) {
			update.$set = setData;
		}

		if (!_.isEmpty(unsetData)) {
			update.$unset = unsetData;
		}

		if (_.isEmpty(update)) {
			return true;
		}

		return this.update({ _id }, update);
	}

	setReason(_id, reason) {
		const update = {
			$set: {
				reason,
			},
		};

		return this.update(_id, update);
	}

	unsetReason(_id) {
		const update = {
			$unset: {
				reason: true,
			},
		};

		return this.update(_id, update);
	}

	bannerExistsById(_id, bannerId) {
		const query = {
			_id,
			[`banners.${ bannerId }`]: {
				$exists: true,
			},
		};

		return this.find(query).count() !== 0;
	}

	addBannerById(_id, banner) {
		const query = {
			_id,
			[`banners.${ banner.id }.read`]: {
				$ne: true,
			},
		};

		const update = {
			$set: {
				[`banners.${ banner.id }`]: banner,
			},
		};

		return this.update(query, update);
	}

	setBannerReadById(_id, bannerId) {
		const update = {
			$set: {
				[`banners.${ bannerId }.read`]: true,
			},
		};

		return this.update({ _id }, update);
	}

	removeBannerById(_id, banner) {
		const update = {
			$unset: {
				[`banners.${ banner.id }`]: true,
			},
		};

		return this.update({ _id }, update);
	}

	removeResumeService(_id) {
		const update = {
			$unset: {
				'services.resume': '',
			},
		};

		return this.update({ _id }, update);
	}

	// INSERT
	create(data) {
		const user = {
			createdAt: new Date,
			avatarOrigin: 'none',
		};

		_.extend(user, data);

		return this.insert(user);
	}


	// REMOVE
	removeById(_id) {
		return this.remove(_id);
	}

	/*
Find users to send a message by email if:
- he is not online
- has a verified email
- has not disabled email notifications
- `active` is equal to true (false means they were deactivated and can't login)
*/
	getUsersToSendOfflineEmail(usersIds) {
		const query = {
			_id: {
				$in: usersIds,
			},
			active: true,
			status: 'offline',
			statusConnection: {
				$ne: 'online',
			},
			'emails.verified': true,
		};

		const options = {
			fields: {
				name: 1,
				username: 1,
				emails: 1,
				'settings.preferences.emailNotificationMode': 1,
				language: 1,
			},
		};

		return this.find(query, options);
	}

	findByNameAndRoomId(name, roomId, skip = 0, limit = 50) {
		const timeLabel = `findByNameAndRoomId${ _.random(0, 1000) }`;
		console.time(timeLabel);
		console.log(timeLabel, name, roomId, skip, limit);

		const query = {
			rid: roomId,
		};

		const subscriptionsCount = Subscriptions.find(query).count();
		const allUsersCount = this.find({}).count();

		let users = [];
		const sort = { name: 1 };
		let timeLabel_Strategy;
		if (subscriptionsCount < allUsersCount / 10) {
			timeLabel_Strategy = `${ timeLabel }::thru_subs`;
			console.time(timeLabel_Strategy);
			users = Promise.await(
				Subscriptions.model.rawCollection().aggregate([
					{ $match: { rid: roomId } },
					{ $lookup: {
						from: 'users',
						localField: 'u._id',
						foreignField: '_id',
						as: 'user',
					},
					},
					{ $unwind: '$user' },
					{ $match: { 'user.active': true, 'user.name': name } },
					{ $facet: {
						count: [{ $count: 'total' }],
						data: [
							{ $skip: skip },
							{ $limit: limit },
							{ $project: {
								_id: '$user._id',
								username: '$user.username',
								name: '$user.name',
								status: '$user.status',
								utcOffset: '$user.utcOffset',
								customFields: '$user.customFields',
							},
							},
							{ $sort: sort },
						],
					},
					},
				]).next());
		} else {
			timeLabel_Strategy = `${ timeLabel }::thru_users`;
			console.time(timeLabel_Strategy);
			users = Promise.await(
				this.model.rawCollection().aggregate([{
					$match: {
						active: true,
						name,
					},
				}, {
					$lookup: {
						from: 'rocketchat_subscription',
						let: {
							userId: '$_id',
							roomId,
						},
						pipeline: [{
							$match: {
								$expr: {
									$and: [
										{ $eq: ['$rid', '$$roomId'] },
										{ $eq: ['$u._id', '$$userId'] },
									],
								},
							},
						}],
						as: 'subscription',
					},
				},
				{ $unwind: '$subscription' },
				{ $match: { subscription : { $exists: true } } },
				{ $facet: {
					count: [{ $count: 'total' }],
					data: [
						{ $skip: skip },
						{ $limit: limit },
						{ $project: { username: 1, name: 1, status: 1, utcOffset:1, customFields: 1 } },
						{ $sort: sort },
					],
				},
				},
				], { hint: { name: 1, active: 1 },
				}).next());
		}

		console.timeEnd(timeLabel);
		console.timeEnd(timeLabel_Strategy);
		return users;
	}

	removeOlderResumeTokensByUserId(userId, fromDate) {
		this.update(userId, {
			$pull: {
				'services.resume.loginTokens': {
					when: { $lt: fromDate },
				},
			},
		});
	}

	disableById(userId) {
		this.update({ _id: userId }, { $set: { disabled: true } });
	}

	enableById(userId) {
		this.update({ _id: userId }, { $unset: { disabled: true } });
	}

}

export default new Users(Meteor.users, true);
