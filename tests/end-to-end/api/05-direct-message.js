import { expect } from 'chai';

import {
	getCredentials,
	api,
	request,
	credentials,
	directMessage,
	apiUsername,
	apiEmail,
} from '../../data/api-data.js';
import { password } from '../../data/user.js';
import { adminUsername } from '../../data/user';

describe('[Direct Messages]', function() {
	this.retries(0);

	before((done) => getCredentials(done));

	it('/chat.postMessage', (done) => {
		request.post(api('chat.postMessage'))
			.set(credentials)
			.send({
				channel: 'rocket.cat',
				text: 'This message was sent using the API',
			})
			.expect('Content-Type', 'application/json')
			.expect(200)
			.expect((res) => {
				expect(res.body).to.have.property('success', true);
				expect(res.body).to.have.nested.property('message.msg', 'This message was sent using the API');
				expect(res.body).to.have.nested.property('message.rid');
				directMessage._id = res.body.message.rid;
			})
			.end(done);
	});

	it('/im.setTopic', (done) => {
		request.post(api('im.setTopic'))
			.set(credentials)
			.send({
				roomId: directMessage._id,
				topic: 'a direct message with rocket.cat',
			})
			.expect('Content-Type', 'application/json')
			.expect(200)
			.expect((res) => {
				expect(res.body).to.have.property('success', true);
			})
			.end(done);
	});


	describe('[/im.{accept,decline}]', () => {
		let user;
		before((done) => {
			const username = `user.test.${ Date.now() }`;
			const email = `${ username }@rocket.chat`;
			request.post(api('users.create'))
				.set(credentials)
				.send({ email, name: username, username, password })
				.end((err, res) => {
					user = res.body.user;
					done();
				});
		});

		let userCredentials;
		before((done) => {
			request.post(api('login'))
				.send({
					user: user.username,
					password,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					userCredentials = {};
					userCredentials['X-Auth-Token'] = res.body.data.authToken;
					userCredentials['X-User-Id'] = res.body.data.userId;
				})
				.end(done);
		});

		let testDM = {};
		before((done) => {
			request.post(api('im.create'))
				.set(credentials)
				.send({
					username: user.username,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body).to.have.property('room');
					expect(res.body).to.have.nested.property('room._id');
					expect(res.body).to.have.nested.property('room.ts');
					expect(res.body).to.have.nested.property('room.t', 'd');
					expect(res.body).to.have.nested.property('room.msgs', 0);
					expect(res.body).to.have.nested.property('room.usernames').and.to.have.lengthOf(2);
					testDM = res.body.room;
				})
				.end(done);
		});
		after((done) => {
			request.post(api('users.delete')).set(credentials).send({
				userId: user._id,
			}).end(done);
			user = undefined;
		});
		it('should accept invite', (done) => {
			request.post(api('im.accept'))
				.set(userCredentials)
				.send({
					roomId: testDM._id,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
				})
				.end(done);
		});
		it('should decline invite', (done) => {
			request.post(api('im.decline'))
				.set(userCredentials)
				.send({
					roomId: testDM._id,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
				})
				.end(done);
		});
	});


	describe('[/im.p2pCalls}]', () => {
		let user;
		before((done) => {
			const username = `user.test.${ Date.now() }`;
			const email = `${ username }@rocket.chat`;
			request.post(api('users.create'))
				.set(credentials)
				.send({ email, name: username, username, password })
				.expect((res) => {
					user = res.body.user;
				})
				.end(done);
		});

		let userCredentials;
		before((done) => {
			request.post(api('login'))
				.send({
					user: user.username,
					password,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					userCredentials = {};
					userCredentials['X-Auth-Token'] = res.body.data.authToken;
					userCredentials['X-User-Id'] = res.body.data.userId;
				})
				.end(done);
		});

		let testDM = {};
		before((done) => {
			request.post(api('im.create'))
				.set(credentials)
				.send({
					username: user.username,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body).to.have.property('room');
					expect(res.body).to.have.nested.property('room._id');
					expect(res.body).to.have.nested.property('room.ts');
					expect(res.body).to.have.nested.property('room.t', 'd');
					expect(res.body).to.have.nested.property('room.msgs', 0);
					expect(res.body).to.have.nested.property('room.usernames').and.to.have.lengthOf(2);
					testDM = res.body.room;
				})
				.end(done);
		});
		after((done) => {
			request.post(api('users.delete')).set(credentials).send({
				userId: user._id,
			}).end(done);
			user = undefined;
		});
		it('should start p2p call', (done) => {
			request.post(api('im.p2pCallStart'))
				.set(userCredentials)
				.send({
					roomId: testDM._id,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
				})
				.end(done);
		});
		it('should raise if start again', (done) => {
			request.post(api('im.p2pCallStart'))
				.set(userCredentials)
				.send({
					roomId: testDM._id,
				})
				.expect('Content-Type', 'application/json')
				.expect(400)
				.expect((res) => {
					expect(res.body).to.have.property('success', false);
					expect(res.body).to.have.property('error');
					expect(res.body).to.have.property('errorType');
				})
				.end(done);
		});
		it('should decline p2p call', (done) => {
			request.post(api('im.p2pCallDecline'))
				.set(userCredentials)
				.send({
					roomId: testDM._id,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
				})
				.end(done);
		});
		it('should start p2p call', (done) => {
			request.post(api('im.p2pCallStart'))
				.set(userCredentials)
				.send({
					roomId: testDM._id,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
				})
				.end(done);
		});
		it('should accept p2p call', (done) => {
			request.post(api('im.p2pCallAccept'))
				.set(userCredentials)
				.send({
					roomId: testDM._id,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
				})
				.end(done);
		});
		it('should end p2p call', (done) => {
			request.post(api('im.p2pCallEnd'))
				.set(userCredentials)
				.send({
					roomId: testDM._id,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
				})
				.end(done);
		});
	});

	describe('Testing DM info', () => {
		let testDM = {};
		let dmMessage = {};
		it('creating new DM...', (done) => {
			request.post(api('im.create'))
				.set(credentials)
				.send({
					username: 'rocket.cat',
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					testDM = res.body.room;
				})
				.end(done);
		});
		it('sending a message...', (done) => {
			request.post(api('chat.sendMessage'))
				.set(credentials)
				.send({
					message: {
						text: 'Sample message',
						rid: testDM._id,
					},
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
					dmMessage = res.body.message;
				})
				.end(done);
		});
		it('REACTing with last message', (done) => {
			request.post(api('chat.react'))
				.set(credentials)
				.send({
					emoji: ':squid:',
					messageId: dmMessage._id,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
				})
				.end(done);
		});
		it('STARring last message', (done) => {
			request.post(api('chat.starMessage'))
				.set(credentials)
				.send({
					messageId: dmMessage._id,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
				})
				.end(done);
		});
		it('PINning last message', (done) => {
			request.post(api('chat.pinMessage'))
				.set(credentials)
				.send({
					messageId: dmMessage._id,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
				})
				.end(done);
		});
		it('should return all DM messages where the last message of array should have the "star" array with USERS star ONLY', (done) => {
			request.get(api('im.messages'))
				.set(credentials)
				.query({
					roomId: testDM._id,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body).to.have.property('messages').and.to.be.an('array');
					const { messages } = res.body;
					const lastMessage = messages.filter((message) => message._id === dmMessage._id)[0];
					expect(lastMessage).to.have.property('starred').and.to.be.an('array');
					expect(lastMessage.starred[0]._id).to.be.equal(adminUsername);
				})
				.end(done);
		});
		it('block user', (done) => {
			request.post(api('im.blockUser'))
				.set(credentials)
				.send({
					username: 'rocket.cat',
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
				})
				.end(done);
		});
		it('should not send a message after block', (done) => {
			request.post(api('chat.sendMessage'))
				.set(credentials)
				.send({
					message: {
						text: 'Sample message',
						rid: testDM._id,
					},
				})
				.expect('Content-Type', 'application/json')
				.expect(400)
				.expect((res) => {
					expect(res.body).to.have.property('success', false);
				})
				.end(done);
		});
		it('remove DM', (done) => {
			request.post(api('rooms.delete'))
				.set(credentials)
				.send({
					roomId: testDM._id,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
				})
				.end(done);
		});
		it('should not send a message after deletion', (done) => {
			request.post(api('chat.sendMessage'))
				.set(credentials)
				.send({
					message: {
						text: 'Sample message',
						rid: testDM._id,
					},
				})
				.expect('Content-Type', 'application/json')
				.expect(400)
				.expect((res) => {
					expect(res.body).to.have.property('success', false);
				})
				.end(done);
		});
		it('recreating new DM...', (done) => {
			request.post(api('im.create'))
				.set(credentials)
				.send({
					userId: 'rocket.cat',
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					testDM = res.body.room;
				})
				.end(done);
		});
		it('should not send a message after creation', (done) => {
			request.post(api('chat.sendMessage'))
				.set(credentials)
				.send({
					message: {
						text: 'Sample message',
						rid: testDM._id,
					},
				})
				.expect('Content-Type', 'application/json')
				.expect(400)
				.expect((res) => {
					expect(res.body).to.have.property('success', false);
				})
				.end(done);
		});
		it('unblock user', (done) => {
			request.post(api('im.unblockUser'))
				.set(credentials)
				.send({
					username: 'rocket.cat',
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
				})
				.end(done);
		});
		it('should send a message after unblock', (done) => {
			request.post(api('chat.sendMessage'))
				.set(credentials)
				.send({
					message: {
						text: 'Sample message',
						rid: testDM._id,
					},
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
				})
				.end(done);
		});
	});

	it('/im.history', (done) => {
		request.get(api('im.history'))
			.set(credentials)
			.query({
				roomId: directMessage._id,
				userId: 'rocket.cat',
			})
			.expect('Content-Type', 'application/json')
			.expect(200)
			.expect((res) => {
				expect(res.body).to.have.property('success', true);
				expect(res.body).to.have.property('messages');
			})
			.end(done);
	});

	it('/im.list', (done) => {
		request.get(api('im.list'))
			.set(credentials)
			.expect('Content-Type', 'application/json')
			.expect(200)
			.expect((res) => {
				expect(res.body).to.have.property('success', true);
				expect(res.body).to.have.property('count');
				expect(res.body).to.have.property('total');
			})
			.end(done);
	});

	it('/im.list.everyone', (done) => {
		request.get(api('im.list.everyone'))
			.set(credentials)
			.expect('Content-Type', 'application/json')
			.expect(200)
			.expect((res) => {
				expect(res.body).to.have.property('success', true);
				expect(res.body).to.have.property('count');
				expect(res.body).to.have.property('total');
			})
			.end(done);
	});

	it('/im.counters', (done) => {
		request.get(api('im.counters'))
			.set(credentials)
			.query({
				roomId: directMessage._id,
			})
			.expect('Content-Type', 'application/json')
			.expect(200)
			.expect((res) => {
				expect(res.body).to.have.property('success', true);
				expect(res.body).to.have.property('joined', true);
				expect(res.body).to.have.property('members');
				expect(res.body).to.have.property('unreads');
				expect(res.body).to.have.property('unreadsFrom');
				expect(res.body).to.have.property('msgs');
				expect(res.body).to.have.property('latest');
				expect(res.body).to.have.property('userMentions');
			})
			.end(done);
	});

	describe('fname property', () => {
		const username = `fname_${ apiUsername }`;
		const name = `Name fname_${ apiUsername }`;
		const updatedName = `Updated Name fname_${ apiUsername }`;
		const email = `fname_${ apiEmail }`;
		let userId;
		let directMessageId;

		before((done) => {
			request.post(api('users.create'))
				.set(credentials)
				.send({
					email,
					name,
					username,
					password,
					active: true,
					roles: ['user'],
					joinDefaultChannels: true,
					verified: true,
				})
				.expect((res) => {
					userId = res.body.user._id;
				})
				.end(done);
		});

		before((done) => {
			request.post(api('chat.postMessage'))
				.set(credentials)
				.send({
					channel: `@${ username }`,
					text: 'This message was sent using the API',
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body).to.have.nested.property('message.msg', 'This message was sent using the API');
					expect(res.body).to.have.nested.property('message.rid');
					directMessageId = res.body.message.rid;
				})
				.end(done);
		});

		it('should have fname property', (done) => {
			request.get(api('subscriptions.getOne'))
				.set(credentials)
				.query({
					roomId: directMessageId,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body.subscription).to.have.property('name', username);
					expect(res.body.subscription).to.have.property('fname', name);
				})
				.end(done);
		});

		it('should update user\'s name', (done) => {
			request.post(api('users.update'))
				.set(credentials)
				.send({
					userId,
					data: {
						name: updatedName,
					},
				})
				.expect((res) => {
					expect(res.body.user).to.have.property('name', updatedName);
				})
				.end(done);
		});

		it('should have fname property updated', (done) => {
			request.get(api('subscriptions.getOne'))
				.set(credentials)
				.query({
					roomId: directMessageId,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body.subscription).to.have.property('name', username);
					expect(res.body.subscription).to.have.property('fname', updatedName);
				})
				.end(done);
		});
	});
	describe('/im.members', () => {
		it('should return and array with two members', (done) => {
			request.get(api('im.members'))
				.set(credentials)
				.query({
					roomId: directMessage._id,
				})
				.expect('Content-Type', 'application/json')
				.expect(200)
				.expect((res) => {
					expect(res.body).to.have.property('success', true);
					expect(res.body).to.have.property('count').and.to.be.equal(2);
					expect(res.body).to.have.property('offset').and.to.be.equal(0);
					expect(res.body).to.have.property('total').and.to.be.equal(2);
					expect(res.body).to.have.property('members').and.to.have.lengthOf(2);
				})
				.end(done);
		});
	});
});
