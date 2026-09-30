import { resolveSession } from '@aidenjang/auth-client';
import { Hono } from 'hono';
import type { AppEnv } from './context';
import { ApiError } from './data';
import { assertSameOrigin, securityHeaders } from './http';
import { registerListRoutes } from './routes/lists';
import { registerRecordRoutes } from './routes/records';
import { registerShareRoutes, registerPublicShareRoute } from './routes/shares';
import { registerPhotoRoutes } from './routes/photos';

const app = new Hono<AppEnv>();
const publicApi = new Hono<AppEnv>();
const privateApi = new Hono<AppEnv>();

app.use('/api/*', async (c, next) => {
  assertSameOrigin(c.req.raw);
  await next();
  const headers = new Headers(c.res.headers);
  securityHeaders(headers);
  c.res = new Response(c.res.body, { status: c.res.status, headers });
});

publicApi.get('/health', (c) => c.json({ status: 'ok' }));

publicApi.get('/me', async (c) => {
  const session = await resolveSession(c.req.raw, c.env.AUTH_URL);
  if (session.state === 'unavailable') throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Accounts is temporarily unavailable');
  return c.json({ user: session.state === 'signed-in' ? session.user : null });
});

registerPublicShareRoute(publicApi);

privateApi.use('*', async (c, next) => {
  const session = await resolveSession(c.req.raw, c.env.AUTH_URL);
  if (session.state === 'unavailable') throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Accounts is temporarily unavailable');
  if (session.state === 'signed-out') throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue');
  c.set('ownerId', session.user.id);
  c.set('user', session.user);
  await next();
});

registerListRoutes(privateApi);
registerRecordRoutes(privateApi);
registerShareRoutes(privateApi);
registerPhotoRoutes(privateApi);

app.route('/api', publicApi);
app.route('/api', privateApi);

app.onError((error, c) => {
  if (error instanceof ApiError) {
    const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
    securityHeaders(headers);
    return new Response(JSON.stringify({ error: error.code, message: error.message }), { status: error.status, headers });
  }
  console.error(JSON.stringify({ event: 'request_failed', path: c.req.path, message: error.message }));
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  securityHeaders(headers);
  return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Something went wrong' }), { status: 500, headers });
});

export default app;
