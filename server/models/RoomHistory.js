import mongoose from 'mongoose';

const roomHistorySchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true
  },
  sessionName: {
    type: String,
    default: function() {
      return `Session ${new Date().toLocaleDateString()}`;
    }
  },
  language: {
    type: String,
    default: 'javascript'
  },
  finalCode: {
    type: String,
    default: ''
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const RoomHistory = mongoose.model('RoomHistory', roomHistorySchema);
export default RoomHistory;
