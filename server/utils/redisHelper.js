import { createClient } from 'redis';

let client = null;
let isRedisConnected = false;

// Custom in-memory store fallback
const memoryStore = {
  rooms: {} // roomId -> { code: '', language: 'javascript', users: [], lockedUsers: [] }
};

const getMemoryRoom = (roomId) => {
  if (!memoryStore.rooms[roomId]) {
    memoryStore.rooms[roomId] = {
      code: '// Start collaborating here...\n',
      language: 'javascript',
      users: []
    };
  }
  return memoryStore.rooms[roomId];
};

export const connectRedis = async () => {
  const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  client = createClient({
    url: REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 3) return new Error('Redis connection failed');
        return Math.min(retries * 1000, 3000);
      }
    }
  });

  client.on('error', (err) => {
    console.warn('Redis Client Error, falling back to local memory store:', err.message);
    isRedisConnected = false;
  });

  try {
    await client.connect();
    console.log('Successfully connected to Redis Server');
    isRedisConnected = true;
  } catch (error) {
    console.warn('Redis connection failed, running room cache in-memory.');
    isRedisConnected = false;
    client = null;
  }
};

// --- ROOM INTERFACE APIS ---

// Get current room code content
export const getRoomCode = async (roomId) => {
  if (isRedisConnected && client) {
    try {
      const code = await client.get(`room:code:${roomId}`);
      return code !== null ? code : '// Start collaborating here...\n';
    } catch (err) {
      console.error('Redis getRoomCode error:', err);
    }
  }
  return getMemoryRoom(roomId).code;
};

// Save room code content
export const setRoomCode = async (roomId, code) => {
  if (isRedisConnected && client) {
    try {
      await client.set(`room:code:${roomId}`, code);
      return;
    } catch (err) {
      console.error('Redis setRoomCode error:', err);
    }
  }
  getMemoryRoom(roomId).code = code;
};

// Get current room programming language
export const getRoomLanguage = async (roomId) => {
  if (isRedisConnected && client) {
    try {
      const lang = await client.get(`room:lang:${roomId}`);
      return lang !== null ? lang : 'javascript';
    } catch (err) {
      console.error('Redis getRoomLanguage error:', err);
    }
  }
  return getMemoryRoom(roomId).language;
};

// Set current room programming language
export const setRoomLanguage = async (roomId, language) => {
  if (isRedisConnected && client) {
    try {
      await client.set(`room:lang:${roomId}`, language);
      return;
    } catch (err) {
      console.error('Redis setRoomLanguage error:', err);
    }
  }
  getMemoryRoom(roomId).language = language;
};

// Add a participant to a room
export const addUserToRoom = async (roomId, socketId, user) => {
  // user structure: { id, username, color, avatar }
  const participant = {
    socketId,
    userId: user.id,
    username: user.username,
    color: user.color,
    avatar: user.avatar,
    isLocked: false // Admin control lock/unlock editing state
  };

  if (isRedisConnected && client) {
    try {
      const key = `room:users:${roomId}`;
      const usersStr = await client.get(key);
      let users = usersStr ? JSON.parse(usersStr) : [];
      // Remove any prior stale connection of same user or socket
      users = users.filter(u => u.socketId !== socketId && u.userId !== user.id);
      users.push(participant);
      await client.set(key, JSON.stringify(users));
      return users;
    } catch (err) {
      console.error('Redis addUserToRoom error:', err);
    }
  }

  // Memory fallback
  const room = getMemoryRoom(roomId);
  room.users = room.users.filter(u => u.socketId !== socketId && u.userId !== user.id);
  room.users.push(participant);
  return room.users;
};

// Remove user from a room
export const removeUserFromRoom = async (roomId, socketId) => {
  if (isRedisConnected && client) {
    try {
      const key = `room:users:${roomId}`;
      const usersStr = await client.get(key);
      if (usersStr) {
        let users = JSON.parse(usersStr);
        users = users.filter(u => u.socketId !== socketId);
        if (users.length === 0) {
          // If no users left, clear Redis keys to prevent memory leaks
          await client.del(key);
          await client.del(`room:code:${roomId}`);
          await client.del(`room:lang:${roomId}`);
        } else {
          await client.set(key, JSON.stringify(users));
        }
        return users;
      }
      return [];
    } catch (err) {
      console.error('Redis removeUserFromRoom error:', err);
    }
  }

  // Memory fallback
  if (memoryStore.rooms[roomId]) {
    const room = memoryStore.rooms[roomId];
    room.users = room.users.filter(u => u.socketId !== socketId);
    if (room.users.length === 0) {
      delete memoryStore.rooms[roomId];
      return [];
    }
    return room.users;
  }
  return [];
};

// Fetch list of current room users
export const getRoomUsers = async (roomId) => {
  if (isRedisConnected && client) {
    try {
      const usersStr = await client.get(`room:users:${roomId}`);
      return usersStr ? JSON.parse(usersStr) : [];
    } catch (err) {
      console.error('Redis getRoomUsers error:', err);
    }
  }
  return getMemoryRoom(roomId).users;
};

// Set lock/unlock status for a specific user
export const toggleUserLock = async (roomId, userId, isLocked) => {
  if (isRedisConnected && client) {
    try {
      const key = `room:users:${roomId}`;
      const usersStr = await client.get(key);
      if (usersStr) {
        const users = JSON.parse(usersStr);
        const userIndex = users.findIndex(u => u.userId === userId);
        if (userIndex !== -1) {
          users[userIndex].isLocked = isLocked;
          await client.set(key, JSON.stringify(users));
        }
        return users;
      }
      return [];
    } catch (err) {
      console.error('Redis toggleUserLock error:', err);
    }
  }

  // Memory fallback
  const room = getMemoryRoom(roomId);
  const user = room.users.find(u => u.userId === userId);
  if (user) {
    user.isLocked = isLocked;
  }
  return room.users;
};
