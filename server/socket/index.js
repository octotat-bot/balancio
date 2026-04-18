import Message from '../models/Message.js';
import Group from '../models/Group.js';
import User from '../models/User.js';

let ioInstance = null;

export const getIO = () => ioInstance; // available to controllers that don't have req.io

export const initializeSocket = (io) => {
    ioInstance = io;

    io.on('connection', (socket) => {
        socket.on('join_group', async ({ groupId, userId }) => {
            try {
                socket.join(groupId);
            } catch (error) {
                console.error('Error joining group:', error);
            }
        });

        socket.on('leave_group', ({ groupId }) => {
            socket.leave(groupId);
        });

        socket.on('join_user', ({ userId }) => {
            socket.join(`user_${userId}`);
        });

        socket.on('send_message', async (data) => {
            try {
                const { groupId, userId, content } = data;

                if (!content || !content.trim()) return;

                const message = await Message.create({
                    group: groupId,
                    sender: userId,
                    content
                });

                await message.populate('sender', 'name email avatar');

                io.to(groupId).emit('receive_message', message);

            } catch (error) {
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        socket.on('typing', ({ groupId, userId, userName, isTyping }) => {
            socket.to(groupId).emit('user_typing', { userId, userName, isTyping });
        });

        socket.on('nudge', ({ groupId, toUserId, fromUserName }) => {
            io.to(groupId).emit('receive_nudge', { toUserId, fromUserName });
        });

        socket.on('disconnect', () => { });
    });
};

export const sendNotificationToUser = (userId, type, data) => {
    if (ioInstance) {
        ioInstance.to(`user_${userId}`).emit('notification', { type, data });
    }
};
