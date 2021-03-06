import { Meteor } from 'meteor/meteor';
import { Rooms, Messages, Subscriptions } from 'meteor/rocketchat:models';
import { callbacks } from 'meteor/rocketchat:callbacks';

export const removeUserFromRoom = function(rid, user, options = {}) {
	const room = Rooms.findOneById(rid);

	if (room) {
		callbacks.run('beforeLeaveRoom', user, room);

		const subscription = Subscriptions.findOneByRoomIdAndUserId(rid, user._id, { fields: { _id: 1 } });

		if (subscription) {
			const removedUser = user;
			if (options.byUser) {
				Messages.createUserRemovedWithRoomIdAndUser(rid, user, {
					u: options.byUser,
				});
			} else {
				Messages.createUserLeaveWithRoomIdAndUser(rid, removedUser);
			}
		}

		Subscriptions.removeByRoomIdAndUserId(rid, user._id);

		if (room.t !== 'd') {
			Meteor.defer(function() {
				// TODO: CACHE: maybe a queue?
				callbacks.run('afterLeaveRoom', { user, subscription }, room);
			});
		}
	}
};
