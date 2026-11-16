// Local development entry point. On Vercel, api/index.ts serves the same app.
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const { default: app } = await import('./app.js');
const port = Number(process.env.API_PORT ?? 3001);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
