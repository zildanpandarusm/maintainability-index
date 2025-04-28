import express from 'express';
import cors from 'cors';
import maintainabilityRoutes from './routes/maintainability-index.route.js';

const app = express();
const port = 5050;

app.use(
  cors({
    credentials: true,
    origin: 'https://maintainability-index.vercel.app',
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/maintainability', maintainabilityRoutes);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
