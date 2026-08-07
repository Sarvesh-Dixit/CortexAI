/**
 * Vercel Serverless Function entry point.
 * Wraps the Express app in a try-catch so startup errors
 * return a meaningful JSON response instead of a blank 500.
 */

let app: any;
let initError: Error | null = null;

try {
  app = require('../src/app').default || require('../src/app').app || require('../src/app');
} catch (err: any) {
  initError = err;
  console.error('[Vercel] Failed to initialize app:', err.message, err.stack);
}

export default function handler(req: any, res: any) {
  if (initError) {
    res.status(500).json({
      error: 'Server initialization failed',
      message: initError.message,
      stack: process.env.NODE_ENV === 'development' ? initError.stack : undefined,
    });
    return;
  }

  return app(req, res);
}
