import * as logger from 'heroku-logger';
import * as SocketIO from 'socket.io';

const io = SocketIO();

const port = process.env.PORT || 3434;
io.listen(port);
logger.info(`Starting socket.io on port ${port}.`);

const sockets: {[id: string]: SocketIO.Socket} = {};

io.on('connection', (socket) => {
	logger.info(`Client connected: ${socket.id}.`);

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
