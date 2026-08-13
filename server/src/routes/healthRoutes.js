import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'TalkDB backend is running.' });
});

export default router;
