import * as express from 'express';
import * as fs from 'fs';
import * as logger from 'heroku-logger';
import * as http from 'http';
import * as https from 'https';
import * as SocketIO from 'socket.io';

const app = express();
const server = process.env.NODE_ENV === 'development'
	? https.createServer({
		ca: fs.readFileSync('./ssl/cert.pem'),
		cert: fs.readFileSync('./ssl/cert.pem'),
		key: fs.readFileSync('./ssl/key.pem'),
		rejectUnauthorized: false,
		requestCert: false,
	}, app)
	: http.createServer(app);

const port = process.env.PORT || 3434;
server.listen(port);

const io = SocketIO();
io.listen(server);
logger.info(`Starting socket.io on port ${port}.`);

const sockets: { [socketId: string]: SocketIO.Socket } = {};
const userIdPerSessionId: { [sessionId: string]: string} = {};
const socketPerUserId: { [userId: string]: SocketIO.Socket } = {};

io.on('connection', (socket) => {
	sockets[socket.id] = socket;
	const userId = socket.handshake.query.userId;
	socketPerUserId[userId] = socket;
	logger.info(`Client connected: ${socket.id}, userId: ${userId}.`);

	socket.on('data', (remoteUserId: string, data: any) => {
		logger.info('received data for userId ' + remoteUserId);
		const remoteSocket = socketPerUserId[remoteUserId];
		if (!remoteSocket) {
			return logger.error('unknown userId: ' + remoteUserId);
		}

		remoteSocket.emit('data', userId, data);
	});

	socket.on('disconnect', () => {
		logger.info(`Client disconnected: ${socket.id}.`);
		delete sockets[socket.id];
		delete socketPerUserId[userId];
	});

	socket.on('openSession', (sessionId: string) => {
		logger.info(`${userId} opened the sessions ${sessionId}.`);
		userIdPerSessionId[sessionId] = userId;
	});

	socket.on('closeSession', (sessionId: string) => {
		logger.info(`${userId} closed the sessions ${sessionId}.`);
		delete userIdPerSessionId[sessionId];
	});

	socket.on('join', (sessionId: string) => {
		const remoteUserId = userIdPerSessionId[sessionId];
		logger.info(`Join session ${sessionId}, user ${remoteUserId}.`);
		const remoteSocket = socketPerUserId[remoteUserId];
		if (!remoteSocket) { return logger.error('unknown userId: ' + remoteUserId); }
		remoteSocket.emit('join', sessionId, userId);
		socket.emit('sessionUser', sessionId, remoteUserId);
	});
});
