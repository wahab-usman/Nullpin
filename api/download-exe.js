export const config = {
  runtime: 'edge',
};

export default async function handler() {
  const githubReleaseUrl =
    'https://github.com/wahab-usman/Nullpin/releases/download/v1.0.0/NullPin-Setup.exe';

  const upstream = await fetch(githubReleaseUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'NullPin-Edge-Proxy/1.0',
    },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response('Installer temporarily unavailable', { status: 502 });
  }

  const headers = new Headers();
  headers.set('Content-Type', 'application/octet-stream');
  headers.set(
    'Content-Disposition',
    'attachment; filename="NullPin-Setup.exe"'
  );
  const contentLength = upstream.headers.get('content-length');
  if (contentLength) {
    headers.set('Content-Length', contentLength);
  }
  headers.set('Cache-Control', 'public, max-age=3600');

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}
