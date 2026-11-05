// Password gate for the whole site (HTTP Basic auth, checked on Vercel before any file is served).
// Any username works; the password is below. Delete this file to open the site to everyone.
const PASSWORD = 'swynke';

export const config = { matcher: '/:path*' };

export default function middleware(request) {
  const auth = request.headers.get('authorization') || '';
  const [scheme, encoded] = auth.split(' ');
  if (scheme === 'Basic' && encoded) {
    try {
      const decoded = atob(encoded);
      const password = decoded.slice(decoded.indexOf(':') + 1);
      if (password === PASSWORD) {
        return new Response(null, { headers: { 'x-middleware-next': '1' } });
      }
    } catch (e) {}
  }
  return new Response('This site is private for now. Enter the password to continue.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Swynke", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
