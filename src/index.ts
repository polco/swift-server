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
const sessionIdsPerSocketId: { [socketId: string]: string[] } = {};
const socketIdPerSessionId: { [sessionId: string]: string } = {};

io.on('connection', (socket) => {
	sockets[socket.id] = socket;
	sessionIdsPerSocketId[socket.id] = [];
	logger.info(`Client connected: ${socket.id}.`);

	socket.on('data', (remoteSocketId: string, sessionId: string, data: any) => {
		logger.info('received data for session ' + sessionId);
		const remoteSocket = sockets[remoteSocketId || socketIdPerSessionId[sessionId]];
		if (!remoteSocket) {
			return logger.error('unknown socketId / sessionId', { remoteSocketId, sessionId });
		}

		remoteSocket.emit('data', socket.id, sessionId, data);
	});

	socket.on('disconnect', () => {
		logger.info(`Client disconnected: ${socket.id}.`);
		delete sockets[socket.id];
		const sessions = sessionIdsPerSocketId[socket.id];
		sessions.forEach(sessionId => delete socketIdPerSessionId[sessionId]);
		delete sessionIdsPerSocketId[socket.id];
	});

	socket.on('openSession', (sessionId: string) => {
		logger.info(`Open session ${sessionId} for ${socket.id}.`);
		socketIdPerSessionId[sessionId] = socket.id;
		sessionIdsPerSocketId[socket.id].push(sessionId);
	});

	socket.on('closeSession', (sessionId: string) => {
		logger.info(`Close session ${sessionId} for ${socket.id}.`);
		delete socketIdPerSessionId[sessionId];
		const index = sessionIdsPerSocketId[socket.id].indexOf(sessionId);
		if (index !== -1) { sessionIdsPerSocketId[socket.id].splice(index, 1); }
	});
});
