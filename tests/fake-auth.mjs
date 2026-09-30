import { createServer } from 'node:http';

const port = 34100;
const user = { id: 'local-preview-user', email: 'preview@example.test', displayName: 'Preview' };

createServer((request, response) => {
  if (request.url?.startsWith('/auth/me')) {
    const signedIn = (request.headers.cookie ?? '').includes('platform_session=');
    response.writeHead(signedIn ? 200 : 401, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(signedIn ? { user } : {}));
    return;
  }
  if (request.url === '/preview-login') {
    response.writeHead(302, {
      'Set-Cookie': 'platform_session=local-preview; Path=/; SameSite=Lax; HttpOnly',
      Location: 'http://localhost:34300/',
    });
    response.end();
    return;
  }
  response.writeHead(404).end();
}).listen(port, '127.0.0.1', () => console.log(`Worth preview auth on http://localhost:${port}`));
