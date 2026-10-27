import { registerExperienceRoutes } from './routes/experiences';
import { registerMemoryRoutes } from './routes/memories';
import { handleAnalytics } from '../analytics/worker';
import { registerOfflineRoutes } from './routes/offline';
import { registerPrivateSpaceRoutes } from './routes/private-spaces';
import { registerReceiptRoutes } from './routes/receipts';
import { registerCapsuleRoutes } from './routes/capsules';
import { registerBoardRoutes } from './routes/boards';
import { registerGalleryRoutes } from './routes/photo-gallery';
import { registerCalendarRoutes } from './routes/calendar';
import { registerConnectionRoutes } from './routes/connections';
import { registerTasteHistoryRoutes } from './routes/taste-history';
import { registerRetrospectiveRoutes } from './routes/retrospective';
import { registerInboxRoutes } from './routes/inbox';
import { registerTemplateRoutes } from './routes/templates';
import { resolveSession } from '@aidenjang/auth-client';
import { Hono } from 'hono';
import type { AppEnv } from './context';
import { ApiError } from './data';
import { assertSameOrigin, securityHeaders } from './http';
import { registerArchiveTools } from './routes/archive-tools';
import { registerExportRoutes } from './routes/export';
import { registerItemRoutes } from './routes/items';
import { registerListRoutes } from './routes/lists';
import { registerLogRoutes } from './routes/logs';
import { registerOverviewRoutes } from './routes/overview';
import { registerPhotoRoutes } from './routes/photos';
import { registerPortabilityRoutes } from './routes/portability';
import { registerRoutineRoutes } from './routes/routines';
import { registerActivityAliasRoutes } from './routes/activity-aliases';
import { registerSearchRoutes } from './routes/search';
import { registerPublicShareRoute, registerShareRoutes } from './routes/shares';
import { registerWorkoutRoutes } from './routes/workouts';
import { registerWorkspaceRoutes } from './routes/workspace';
import { registerReviewedCaptureRoutes } from './routes/reviewed-capture';

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

app.all('/api/analytics', (c) => handleAnalytics(c.req.raw, c.env));

publicApi.get('/health', (c) => c.json({ status: 'ok' }));

publicApi.get('/me', async (c) => {
  const session = await resolveSession(c.req.raw, c.env.AUTH_URL);
  if (session.state === 'unavailable')
    throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Accounts is temporarily unavailable');
  return c.json({ user: session.state === 'signed-in' ? session.user : null });
});

registerPublicShareRoute(publicApi);

privateApi.use('*', async (c, next) => {
  const session = await resolveSession(c.req.raw, c.env.AUTH_URL);
  if (session.state === 'unavailable')
    throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Accounts is temporarily unavailable');
  if (session.state === 'signed-out') throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue');
  const expectedAccount = c.req.header('X-Worth-Account');
  if (expectedAccount && expectedAccount !== session.user.id)
    throw new ApiError(409, 'ACCOUNT_CHANGED', 'Accounts changed. Reload Worth before continuing.');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) || c.req.path.endsWith('/export/backup')) {
    const heavy =
      /\/api\/(import|data|export\/backup)$/.test(c.req.path) ||
      /\/api\/lists\/[^/]+\/items\/import$/.test(c.req.path);
    const window = Math.floor(Date.now() / 60000);
    const category = heavy ? 'data' : 'write';
    const row = await c.env.DB.prepare(
      'INSERT INTO request_limits (owner_id, category, window, hits) VALUES (?, ?, ?, 1) ON CONFLICT (owner_id, category, window) DO UPDATE SET hits = hits + 1 RETURNING hits',
    )
      .bind(session.user.id, category, window)
      .first<{ hits: number }>();
    if ((row?.hits ?? 0) > (heavy ? 6 : 120)) {
      c.header('Retry-After', String(60 - (Math.floor(Date.now() / 1000) % 60)));
      throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Wait a minute and try again.');
    }
    await c.env.DB.prepare('DELETE FROM request_limits WHERE window < ?')
      .bind(window - 2)
      .run();
  }
  c.set('ownerId', session.user.id);
  c.set('user', session.user);
  await next();
});

registerArchiveTools(privateApi);
registerWorkspaceRoutes(privateApi);
registerTemplateRoutes(privateApi);
registerInboxRoutes(privateApi);
registerListRoutes(privateApi);
registerItemRoutes(privateApi);
registerReviewedCaptureRoutes(privateApi);
registerLogRoutes(privateApi);
registerExperienceRoutes(privateApi);
registerMemoryRoutes(privateApi);
registerOverviewRoutes(privateApi);
registerRetrospectiveRoutes(privateApi);
registerCalendarRoutes(privateApi);
registerBoardRoutes(privateApi);
registerReceiptRoutes(privateApi);
registerCapsuleRoutes(privateApi);
registerPrivateSpaceRoutes(privateApi);
registerOfflineRoutes(privateApi);
registerTasteHistoryRoutes(privateApi);
registerConnectionRoutes(privateApi);
registerSearchRoutes(privateApi);
registerShareRoutes(privateApi);
registerPhotoRoutes(privateApi);
registerGalleryRoutes(privateApi);
registerExportRoutes(privateApi);
registerPortabilityRoutes(privateApi);
registerWorkoutRoutes(privateApi);
registerRoutineRoutes(privateApi);
registerActivityAliasRoutes(privateApi);

app.route('/api', publicApi);
app.route('/api', privateApi);

app.onError((error, c) => {
  if (error instanceof ApiError) {
    const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
    securityHeaders(headers);
    const retry = c.res.headers.get('Retry-After');
    if (retry) headers.set('Retry-After', retry);
    return new Response(JSON.stringify({ error: error.code, message: error.message }), {
      status: error.status,
      headers,
    });
  }
  console.error(JSON.stringify({ event: 'request_failed', path: c.req.path, message: error.message }));
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  securityHeaders(headers);
  return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Something went wrong' }), {
    status: 500,
    headers,
  });
});

export default app;
