import express from 'express';
import cors from 'cors';
import maintainabilityRoutes from './routes/maintainability-index.route.js';

const app = express();
const port = 5050;

const corsOptions = {
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true,
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors(corsOptions));

// Routes
app.use('/api/maintainability', maintainabilityRoutes);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
