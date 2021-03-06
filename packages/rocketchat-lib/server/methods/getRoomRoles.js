import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { settings } from 'meteor/rocketchat:settings';
import { Subscriptions, Users, Roles } from 'meteor/rocketchat:models';
import _ from 'underscore';

Meteor.methods({
	getRoomRoles(rid) {
		check(rid, String);

		if (!Meteor.userId() && settings.get('Accounts_AllowAnonymousRead') === false) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', { method: 'getRoomRoles' });
		}

		check(rid, String);

		const options = {
			sort: {
				'u.username': 1,
			},
			fields: {
				rid: 1,
				u: 1,
				roles: 1,
			},
		};

		const roles = Roles.find({ scope: 'Subscriptions', description: { $exists: 1, $ne: '' } }).fetch();
		const subscriptions = Subscriptions.findByRoomIdAndRoles(rid, _.pluck(roles, '_id'), options).fetch();

		return subscriptions.map((subscription) => {
			const user = Users.findOneByIdWithCustomFields(subscription.u._id);
			subscription.u = user;
			return subscription;
		});
	},
});
