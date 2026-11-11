// Load the Express library we installed with `npm install express`.
import express from 'express';

// Create the app. Think of `app` as the server itself.
const app = express();

// The port is the numbered "door" the server listens on.
// The client (Vite) uses 5173, so the server uses 4000 to avoid clashing.
const PORT = 4000;

// Let the server understand JSON sent by the browser (for example login forms).
app.use(express.json());

// A route: "when a browser asks for GET /api/health, reply with this".
// We use it only to check that the server is alive.
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'StudyBridge server is running' });
});

// Start listening for requests on the port.
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});