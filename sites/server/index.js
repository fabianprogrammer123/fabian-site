const INDEX_FILE = 'index.html';

function assetCandidates(pathname) {
  if (pathname.endsWith('/')) return [`${pathname}${INDEX_FILE}`];
  if (pathname.split('/').pop()?.includes('.')) return [pathname];
  return [pathname, `${pathname}/${INDEX_FILE}`];
}

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { allow: 'GET, HEAD' }
      });
    }

    if (!env?.ASSETS?.fetch) {
      return new Response('Static assets unavailable', { status: 503 });
    }

    const requestUrl = new URL(request.url);
    let pathname;
    try {
      pathname = decodeURIComponent(requestUrl.pathname);
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    for (const candidate of assetCandidates(pathname)) {
      const assetUrl = new URL(requestUrl);
      assetUrl.pathname = candidate;
      const response = await env.ASSETS.fetch(new Request(assetUrl, request));
      if (response.status !== 404) return response;
    }

    return new Response('Not found', { status: 404 });
  }
};
