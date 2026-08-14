import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/healthRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import queryRoutes from './routes/queryRoutes.js';

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
}));
app.use(express.json());

app.use('/api/health', healthRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/query', queryRoutes);

export default app;
