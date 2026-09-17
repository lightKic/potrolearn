import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './routes';
import { env } from './config/env';

const app: Express = express();

app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

app.use('/api', routes);

export default app;
