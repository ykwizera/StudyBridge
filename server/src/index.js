import { env } from './lib/env.js';
import { app } from './app.js';

app.listen(env.PORT, () => console.log(`API listening on http://localhost:${env.PORT}`));