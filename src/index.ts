import * as express from 'express';
import * as fs from 'fs';
import * as logger from 'heroku-logger';
import * as http from 'http';
import * as https from 'https';
import * as SocketIO from 'socket.io';

const app = express();
const server = process.env.NODE_ENV === 'developement'
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

const sockets: { [id: string]: SocketIO.Socket } = {};

io.on('connection', (socket) => {
	logger.info(`Client connected: ${socket.id}.`);
	sockets[socket.id] = socket;

	socket.on('data', (msg) => {
		logger.info(`received messaged`, msg);
		const remoteSocket = sockets[msg.remoteId];
		if (!remoteSocket) {
			return logger.error('unknown remoteId', msg.remoteId);
		}

		remoteSocket.emit('data', {
			data: msg.data,
			fromId: socket.id
		});
	});

	socket.on('disconnect', () => {
		logger.info(`Client disconnected: ${socket.id}.`);
		delete sockets[socket.id];
	});
});
