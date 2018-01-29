import * as debug from 'debug';
import * as SocketIO from 'socket.io';

const log = debug('swift');

const io = SocketIO();
io.listen(3434);

io.on('connection', (socket) => {
	log('got connection', socket.id);

	socket.on('data', (msg) => {
		log('message', msg);
	});
});
