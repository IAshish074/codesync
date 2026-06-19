/**
 * CodeSync Operational Transformation (OT) Engine
 * Represent edits as operations:
 * - Insert: { type: 'insert', position: offset, text: 'chars', userId }
 * - Delete: { type: 'delete', position: offset, length: count, userId }
 */

// Applies a single operation to a string
export const applyOp = (text, op) => {
  if (op.type === 'insert') {
    return text.slice(0, op.position) + op.text + text.slice(op.position);
  } else if (op.type === 'delete') {
    return text.slice(0, op.position) + text.slice(op.position + op.length);
  }
  return text;
};

// Transforms opA relative to opB (returns opA')
// This answers: if opA and opB were run concurrently, what is opA' that can be run after opB?
export const transformOp = (opA, opB) => {
  // Clone opA to avoid mutation
  const res = { ...opA };

  if (opA.type === 'insert' && opB.type === 'insert') {
    if (opA.position < opB.position) {
      // opA is before opB, position remains same
      return res;
    } else if (opA.position > opB.position) {
      // opB inserted text before opA, shift opA to the right
      res.position += opB.text.length;
      return res;
    } else {
      // Tie breaker: positions are identical.
      // We resolve based on sorting userIds alphabetically.
      if (opA.userId > opB.userId) {
        res.position += opB.text.length;
      }
      return res;
    }
  }

  if (opA.type === 'insert' && opB.type === 'delete') {
    if (opA.position <= opB.position) {
      // opA is before or at the start of deletion
      return res;
    } else if (opA.position >= opB.position + opB.length) {
      // opA is after the entire deleted chunk, shift to the left
      res.position -= opB.length;
      return res;
    } else {
      // opA is inside the deleted chunk, shift to start of deleted chunk
      res.position = opB.position;
      return res;
    }
  }

  if (opA.type === 'delete' && opB.type === 'insert') {
    if (opA.position < opB.position) {
      if (opA.position + opA.length <= opB.position) {
        // Deletion ends before insertion
        return res;
      } else {
        // Insertion falls inside deleted region.
        // We must expand the deletion range to cover the newly inserted text.
        res.length += opB.text.length;
        return res;
      }
    } else {
      // Insertion is before deletion. Shift deletion position to the right
      res.position += opB.text.length;
      return res;
    }
  }

  if (opA.type === 'delete' && opB.type === 'delete') {
    const endA = opA.position + opA.length;
    const endB = opB.position + opB.length;

    if (endA <= opB.position) {
      // A is completely before B
      return res;
    }
    if (opA.position >= endB) {
      // A is completely after B, shift left
      res.position -= opB.length;
      return res;
    }

    // Overlapping deletions
    if (opA.position >= opB.position && endA <= endB) {
      // A is completely inside B, it becomes no-op
      res.length = 0;
      return res;
    }
    if (opA.position < opB.position && endA > endB) {
      // A completely swallows B
      res.length -= opB.length;
      return res;
    }
    if (opA.position >= opB.position && opA.position < endB) {
      // A overlaps B from the right
      const overlap = endB - opA.position;
      res.position = opB.position;
      res.length -= overlap;
      return res;
    }
    if (opA.position < opB.position && endA > opB.position) {
      // A overlaps B from the left
      const overlap = endA - opB.position;
      res.length -= overlap;
      return res;
    }
  }

  return res;
};

// Transform a client operation against a list of concurrent server operations (history)
export const transformAgainstHistory = (clientOp, history, startRevision) => {
  let transformedOp = { ...clientOp };
  
  for (let i = startRevision; i < history.length; i++) {
    const historyOp = history[i];
    if (historyOp.userId !== clientOp.userId) {
      transformedOp = transformOp(transformedOp, historyOp);
    }
  }
  
  return transformedOp;
};

// Helper to keep track of active room OT sessions in memory on the server
const roomSessions = {}; // roomId -> { history: [], code: '' }

export const getOTSession = (roomId, initialCode = '') => {
  if (!roomSessions[roomId]) {
    roomSessions[roomId] = {
      history: [],
      code: initialCode
    };
  }
  return roomSessions[roomId];
};

export const clearOTSession = (roomId) => {
  delete roomSessions[roomId];
};
