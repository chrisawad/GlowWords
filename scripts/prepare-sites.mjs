import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const serverDirectory = resolve(root, 'dist', 'server');
const metadataDirectory = resolve(root, 'dist', '.openai');

await rm(serverDirectory, { recursive: true, force: true });
await mkdir(serverDirectory, { recursive: true });
await mkdir(metadataDirectory, { recursive: true });

const worker = `const worker = {
  async fetch(request, env) {
    let response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get('accept')?.includes('text/html');

    if (response.status === 404 && request.method === 'GET' && acceptsHtml) {
      const fallbackUrl = new URL('/index.html', request.url);
      response = await env.ASSETS.fetch(new Request(fallbackUrl, request));
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const html = (await response.text()).replaceAll(
        '__SITE_ORIGIN__',
        new URL(request.url).origin,
      );
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      return new Response(html, { status: response.status, headers });
    }

    return response;
  },
};

export default worker;
`;

await writeFile(resolve(serverDirectory, 'index.js'), worker, 'utf8');
await copyFile(
  resolve(root, '.openai', 'hosting.json'),
  resolve(metadataDirectory, 'hosting.json'),
);
