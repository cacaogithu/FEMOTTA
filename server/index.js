import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import uploadRoutes from './routes/upload.js';
import resultsRoutes from './routes/results.js';
import imageRoutes from './routes/images.js';
import chatRoutes from './routes/chat.js';
import reEditRoutes from './routes/reEdit.js';
import feedbackRoutes from './routes/feedback.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/upload', uploadRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/re-edit', reEditRoutes);
app.use('/api/feedback', feedbackRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
