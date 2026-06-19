import { 
  addUserToRoom, 
  removeUserFromRoom, 
  getRoomUsers, 
  getRoomCode, 
  setRoomCode, 
  getRoomLanguage, 
  setRoomLanguage,
  toggleUserLock
} from '../utils/redisHelper.js';
import { 
  getOTSession, 
  transformAgainstHistory, 
  applyOp, 
  clearOTSession 
} from '../utils/ot.js';
import RoomHistory from '../models/RoomHistory.js';
import User from '../models/User.js';

export const initSocketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket client connected: ${socket.id}`);

    // --- EVENT: JOIN ROOM ---
    socket.on('join-room', async ({ roomId, user }) => {
      if (!roomId || !user) return;

      socket.join(roomId);
      console.log(`User ${user.username} (${user.id}) joined room: ${roomId}`);

      // 1. Fetch current room state (code & language)
      const currentCode = await getRoomCode(roomId);
      const currentLang = await getRoomLanguage(roomId);

      // 2. Initialize OT session for the room if not already done
      const otSession = getOTSession(roomId, currentCode);

      // 3. Add user to the participant tracker
      const users = await addUserToRoom(roomId, socket.id, user);

      // 4. Send initial data back to the joining user
      // Provide the current OT revision number (history length)
      socket.emit('room-joined', {
        code: otSession.code,
        language: currentLang,
        users,
        revision: otSession.history.length,
        adminId: users[0] ? users[0].userId : null // First user is the admin
      });

      // 5. Broadcast updated user list to everyone in the room
      io.to(roomId).emit('user-list-update', {
        users,
        adminId: users[0] ? users[0].userId : null
      });

      // 6. Broadcast notification message in chat
      socket.to(roomId).emit('chat-update', {
        sender: 'System',
        text: `${user.username} has joined the room.`,
        timestamp: new Date().toLocaleTimeString()
      });
    });

    // --- EVENT: CODE UPDATE (OT-driven) ---
    socket.on('code-change', async ({ roomId, op }) => {
      if (!roomId || !op) return;

      // op: { type, position, text, length, baseRevision, userId }
      const otSession = getOTSession(roomId);
      
      // 1. Transform client operation against concurrent changes in history
      const transformedOp = transformAgainstHistory(op, otSession.history, op.baseRevision);

      // 2. Apply the transformed operation to server code buffer
      otSession.code = applyOp(otSession.code, transformedOp);

      // 3. Store in historical log
      otSession.history.push(transformedOp);

      // 4. Save server-wide code content
      await setRoomCode(roomId, otSession.code);

      // 5. Broadcast transformed operation and new revision to all other clients
      // Note: We send to everyone including sender so they know the final accepted server revision
      io.to(roomId).emit('code-update', {
        op: transformedOp,
        revision: otSession.history.length
      });
    });

    // --- EVENT: CHANGE LANGUAGE ---
    socket.on('change-language', async ({ roomId, language }) => {
      if (!roomId || !language) return;

      await setRoomLanguage(roomId, language);
      
      // Broadcast language change to others in the room
      io.to(roomId).emit('language-update', { language });
    });

    // --- EVENT: CURSOR LOCATION SYNC ---
    socket.on('cursor-move', ({ roomId, userId, username, color, cursor }) => {
      if (!roomId) return;
      // cursor: { line, column, selection }
      socket.to(roomId).emit('cursor-update', {
        userId,
        username,
        color,
        cursor
      });
    });

    // --- EVENT: CHAT MESSAGE ---
    socket.on('chat-message', ({ roomId, message }) => {
      if (!roomId || !message) return;
      // message: { text, sender }
      io.to(roomId).emit('chat-update', {
        sender: message.sender,
        text: message.text,
        timestamp: new Date().toLocaleTimeString()
      });
    });

    // --- EVENT: ADMIN CONTROLS (LOCK EDITING) ---
    socket.on('toggle-lock', async ({ roomId, targetUserId, isLocked, requesterUserId }) => {
      if (!roomId || !targetUserId) return;

      // Verify if the requester is the room admin (the first user in the room list)
      const users = await getRoomUsers(roomId);
      const adminUser = users[0];

      if (!adminUser || adminUser.userId !== requesterUserId) {
        return socket.emit('error-msg', { message: 'Unauthorized: Only room admins can lock/unlock users.' });
      }

      // Toggle lock status in the session store
      const updatedUsers = await toggleUserLock(roomId, targetUserId, isLocked);

      // Broadcast user list update
      io.to(roomId).emit('user-list-update', {
        users: updatedUsers,
        adminId: adminUser.userId
      });

      // Broadcast system message to chat
      const targetUser = updatedUsers.find(u => u.userId === targetUserId);
      const targetName = targetUser ? targetUser.username : 'A user';
      io.to(roomId).emit('chat-update', {
        sender: 'System',
        text: `${targetName} has been ${isLocked ? 'locked from' : 'unlocked for'} editing by the admin.`,
        timestamp: new Date().toLocaleTimeString()
      });
    });

    // --- EVENT: SAVE SESSION TO HISTORY ---
    socket.on('save-session', async ({ roomId, language, finalCode, userId }) => {
      if (!roomId) return;

      try {
        const users = await getRoomUsers(roomId);
        const adminUser = users[0];

        // Only allow admin or room participants to save session
        if (!adminUser) return;

        // Fetch participant mongo ObjectIds
        const participantUsernames = users.map(u => u.username);
        const dbUsers = await User.find({ username: { $in: participantUsernames } });
        const participantIds = dbUsers.map(u => u._id);

        const history = new RoomHistory({
          roomId,
          language,
          finalCode,
          participants: participantIds
        });

        await history.save();
        io.to(roomId).emit('session-saved', { message: 'Session history saved to database.' });
      } catch (error) {
        console.error('Error saving session history:', error);
      }
    });

    // --- EVENT: DISCONNECTING ---
    socket.on('disconnecting', async () => {
      // socket.rooms contains socket.id and all joined rooms
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          console.log(`Socket ${socket.id} disconnecting from room: ${roomId}`);
          
          // Fetch user details for notification before removing
          const usersBefore = await getRoomUsers(roomId);
          const leavingUser = usersBefore.find(u => u.socketId === socket.id);

          // Remove user
          const remainingUsers = await removeUserFromRoom(roomId, socket.id);

          if (leavingUser) {
            // Broadcast notification message
            socket.to(roomId).emit('chat-update', {
              sender: 'System',
              text: `${leavingUser.username} has left the room.`,
              timestamp: new Date().toLocaleTimeString()
            });
          }

          if (remainingUsers.length === 0) {
            // Clear OT session history to free memory
            clearOTSession(roomId);
          } else {
            // Broadcast new user list
            io.to(roomId).emit('user-list-update', {
              users: remainingUsers,
              adminId: remainingUsers[0] ? remainingUsers[0].userId : null
            });
          }
        }
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket client disconnected: ${socket.id}`);
    });
  });
};
