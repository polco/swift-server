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
const socketPerSessionId: { [sessionId: string]: SocketIO.Socket} = {};
const sessionIdsPerSocketId: {[socketId: string]: string[]} = {};

io.on('connection', (socket) => {
	sockets[socket.id] = socket;
	logger.info(`Client connected: ${socket.id}.`);

	socket.on('data', (remoteSocketId: string, data: any) => {
		logger.info('received data for remoteSocketId ' + remoteSocketId);
		const remoteSocket = sockets[remoteSocketId];
		if (!remoteSocket) {
			return logger.error('unknown remoteSocketId: ' + remoteSocketId);
		}

		remoteSocket.emit('data', socket.id, data);
	});

	socket.on('disconnect', () => {
		logger.info(`Client disconnected: ${socket.id}.`);
		delete sockets[socket.id];
		const sessionIds = sessionIdsPerSocketId[socket.id];
		if (sessionIds) {
			sessionIds.forEach(sessionId => delete socketPerSessionId[sessionId]);
			delete sessionIdsPerSocketId[socket.id];
		}
	});

	socket.on('openSession', (sessionId: string) => {
		logger.info(`${socket.id} opened the sessions ${sessionId}.`);
		if (!sessionIdsPerSocketId[socket.id]) { sessionIdsPerSocketId[socket.id] = []; }
		sessionIdsPerSocketId[socket.id].push(sessionId);
		socketPerSessionId[sessionId] = socket;
	});

	socket.on('closeSession', (sessionId: string) => {
		logger.info(`${socket.id} closed the sessions ${sessionId}.`);
		delete socketPerSessionId[sessionId];
		const sessionIds = sessionIdsPerSocketId[socket.id];
		if (sessionIds) {
			const index = sessionIds.indexOf(sessionId);
			if (index !== -1) {
				sessionIds.splice(index, 1);
				if (sessionIds.length === 0) {
					delete sessionIdsPerSocketId[socket.id];
				}
			}
		}
	});

	socket.on('join', (sessionId: string, userId: string) => {
		const remoteSocket = socketPerSessionId[sessionId];
		if (!remoteSocket) { return logger.error('unknown sessionId: ' + sessionId); }
		logger.info(`Join session ${sessionId}, clientId: ${remoteSocket.id}.`);
		remoteSocket.emit('join', sessionId, socket.id, userId);
		socket.emit('sessionClient', sessionId, remoteSocket.id);
	});
});
