import express from 'express';
import Snippet from '../models/Snippet.js';
import RoomHistory from '../models/RoomHistory.js';
import { verifyToken } from './middleware.js';

const router = express.Router();

// @route   POST /api/snippets
// @desc    Save a new code snippet
router.post('/', verifyToken, async (req, res) => {
  const { title, code, language, roomId } = req.body;

  try {
    if (!title || code === undefined || !language) {
      return res.status(400).json({ error: 'Title, code content, and language are required.' });
    }

    const snippet = new Snippet({
      title,
      code,
      language,
      roomId,
      owner: req.user.id
    });

    await snippet.save();
    res.status(201).json(snippet);
  } catch (error) {
    console.error('Error saving snippet:', error);
    res.status(500).json({ error: 'Server error saving code snippet.' });
  }
});

// @route   GET /api/snippets
// @desc    Get all snippets of the logged-in user
router.get('/', verifyToken, async (req, res) => {
  try {
    const snippets = await Snippet.find({ owner: req.user.id }).sort({ updatedAt: -1 });
    res.json(snippets);
  } catch (error) {
    console.error('Error fetching snippets:', error);
    res.status(500).json({ error: 'Server error fetching snippets.' });
  }
});

// @route   GET /api/snippets/room/:roomId
// @desc    Get all snippets created in a specific room
router.get('/room/:roomId', verifyToken, async (req, res) => {
  const { roomId } = req.params;
  try {
    const snippets = await Snippet.find({ roomId }).populate('owner', 'username color').sort({ updatedAt: -1 });
    res.json(snippets);
  } catch (error) {
    console.error('Error fetching room snippets:', error);
    res.status(500).json({ error: 'Server error fetching snippets.' });
  }
});

// @route   GET /api/snippets/:id
// @desc    Get a single snippet
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const snippet = await Snippet.findOne({ _id: req.params.id, owner: req.user.id });
    if (!snippet) {
      return res.status(404).json({ error: 'Snippet not found or unauthorized.' });
    }
    res.json(snippet);
  } catch (error) {
    console.error('Error fetching snippet:', error);
    res.status(500).json({ error: 'Server error fetching snippet details.' });
  }
});

// @route   DELETE /api/snippets/:id
// @desc    Delete a snippet
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const snippet = await Snippet.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
    if (!snippet) {
      return res.status(404).json({ error: 'Snippet not found or unauthorized.' });
    }
    res.json({ message: 'Snippet deleted successfully.' });
  } catch (error) {
    console.error('Error deleting snippet:', error);
    res.status(500).json({ error: 'Server error deleting snippet.' });
  }
});

// @route   GET /api/snippets/history/user
// @desc    Get all session histories for the logged-in user
router.get('/history/user', verifyToken, async (req, res) => {
  try {
    const histories = await RoomHistory.find({ participants: req.user.id })
      .populate('participants', 'username color avatar')
      .sort({ createdAt: -1 });
    res.json(histories);
  } catch (error) {
    console.error('Error fetching user history:', error);
    res.status(500).json({ error: 'Server error fetching session history.' });
  }
});

// @route   GET /api/snippets/history/room/:roomId
// @desc    Get session histories for a specific room
router.get('/history/room/:roomId', verifyToken, async (req, res) => {
  try {
    const histories = await RoomHistory.find({ roomId: req.params.roomId })
      .populate('participants', 'username color avatar')
      .sort({ createdAt: -1 });
    res.json(histories);
  } catch (error) {
    console.error('Error fetching room history:', error);
    res.status(500).json({ error: 'Server error fetching session history.' });
  }
});

// @route   POST /api/snippets/compile
// @desc    Proxy compile code via Judge0 API securely
router.post('/compile', verifyToken, async (req, res) => {
  const { code, languageId, stdin } = req.body;

  if (!languageId || code === undefined) {
    return res.status(400).json({ error: 'Language ID and code content are required.' });
  }

  try {
    const apiURL = process.env.JUDGE0_API_URL || 'https://ce.judge0.com';
    const apiKey = process.env.JUDGE0_RAPIDAPI_KEY;
    const apiHost = process.env.JUDGE0_RAPIDAPI_HOST;

    // Use Base64 encoding for robust character transfer on the wire
    const url = `${apiURL}/submissions?wait=true&base64_encoded=true`;

    const headers = {
      'Content-Type': 'application/json'
    };

    if (apiKey) {
      headers['x-rapidapi-key'] = apiKey;
    }
    if (apiHost) {
      headers['x-rapidapi-host'] = apiHost;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        source_code: Buffer.from(code).toString('base64'),
        language_id: languageId,
        stdin: Buffer.from(stdin || '').toString('base64')
      })
    });

    let data = await response.json();

    // Check if compilation is queued (async mode fallback)
    if (data.token && (!data.status || data.status.id <= 2)) {
      const token = data.token;
      const getUrl = `${apiURL}/submissions/${token}?base64_encoded=true`;
      
      let attempts = 0;
      const maxAttempts = 15;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const pollResponse = await fetch(getUrl, { method: 'GET', headers });
        const pollData = await pollResponse.json();
        
        if (pollData.status && pollData.status.id > 2) {
          data = pollData;
          break;
        }
        attempts++;
      }
    }

    // Decode Base64 fields back to plain text for the client
    const decodeBase64 = (str) => {
      if (!str) return '';
      return Buffer.from(str, 'base64').toString('utf8');
    };

    if (data.stdout) data.stdout = decodeBase64(data.stdout);
    if (data.stderr) data.stderr = decodeBase64(data.stderr);
    if (data.compile_output) data.compile_output = decodeBase64(data.compile_output);
    if (data.message) data.message = decodeBase64(data.message);

    res.json(data);
  } catch (error) {
    console.error('Error proxying compilation:', error);
    res.status(500).json({ error: 'Failed to compile and execute code.' });
  }
});

export default router;
