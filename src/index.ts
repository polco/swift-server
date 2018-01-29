import * as logger from 'heroku-logger';
import * as SocketIO from 'socket.io';

const io = SocketIO();

const port = process.env.PORT || 3434;
io.listen(port);
logger.info(`Starting socket.io on port ${port}.`);

io.on('connection', (socket) => {
	logger.info(`Client connected: ${socket.id}.`);

	socket.on('data', (msg) => {
		logger.info(`received messaged`, msg);
		socket.emit('data', msg);
	});
});
