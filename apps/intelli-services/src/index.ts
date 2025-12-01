import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { gameRoutes } from './routes/game';

// Load environment variables
import 'dotenv/config';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://127.0.0.1:3000'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
}));

// Health check
app.get('/health', (c) => {
    return c.json({ 
        status: 'ok', 
        service: 'intelli-services',
        timestamp: new Date().toISOString() 
    });
});

// API Routes
app.route('/api/game', gameRoutes);

// Start server
const port = parseInt(process.env.PORT || '4000', 10);

console.log('');
console.log('🚀 IntelliVNG Services starting...');
console.log(`📍 Server: http://localhost:${port}`);
console.log('');
console.log('📡 API endpoints:');
console.log(`   POST /api/game/generate        - Generate a visual novel from idea`);
console.log(`   POST /api/game/generate-image  - Generate image (sprite/avatar/background)`);
console.log(`   GET  /api/game/projects        - List all projects`);
console.log(`   GET  /api/game/projects/:id    - Get project by ID`);
console.log(`   PUT  /api/game/projects/:id    - Update project`);
console.log(`   GET  /health                   - Health check`);
console.log('');

serve({
    fetch: app.fetch,
    port,
});

