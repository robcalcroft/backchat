#!/usr/bin/env node

const http = require('http');
const proxy = require('http-proxy');
const zlib = require('zlib');
const url = require('url');
const fs = require('fs');
const minimist = require('minimist');

const args = minimist(process.argv);
const port = args.port || args.p || 10001;
const chatLocation = args['chat-location'] || args.c || 'chats/';
const disableRecording = args['disable-recording'] || args.d || false;
const proxyUrl = args['proxy-url'] || args.u;
const isBackchatHeaderName = 'x-from-backchat-cache';

if (!proxyUrl) {
  throw new Error('A --proxy-url argument must be given');
}

if (!chatLocation.includes('/')) {
  throw new Error('--chat-location must contain a /, either at the end or in the middle i.e. other-chats/ or chats/main');
}

const proxyServer = proxy.createProxyServer({});

const log = message => console.log(`[${new Date().toISOString()}] - ${message}`);

const getFileNameFromUrl = urlForFileName => `${Buffer.from(urlForFileName).toString('base64')}.json`;

const saveRequest = (response) => {
  const rawBody = [];
  const isGzipped = response.headers['content-encoding'] === 'gzip';

  response.on('data', data => rawBody.push(data));

  response.on('end', () => {
    let body = '';
    if (isGzipped) {
      body = zlib.gunzipSync(Buffer.concat(rawBody)).toString();
    } else {
      body = Buffer.concat(rawBody).toString();
    }

    fs.writeFile(`${chatLocation}${getFileNameFromUrl(response.socket._httpMessage.path)}`, JSON.stringify({ // eslint-disable-line no-underscore-dangle
      recorded: Math.round(Date.now() / 1000),
      headers: response.headers,
      body,
    }), (error) => {
      if (error) {
        throw new Error(error.message);
      }
      log(`Wrote ${getFileNameFromUrl(response.socket._httpMessage.path)} for URL ${response.socket._httpMessage.path}`); // eslint-disable-line no-underscore-dangle
    });
  });
};

proxyServer.on('proxyReq', (proxyRequest) => {
  // Some services require the `Host` header to be present
  proxyRequest.setHeader('Host', url.parse(proxyUrl).hostname);
});

proxyServer.on('proxyRes', (proxyResponse) => {
  if (!disableRecording) {
    return saveRequest(proxyResponse);
  }
  return log(`URL ${proxyResponse.socket._httpMessage.path} not being cached as recording is disabled`); // eslint-disable-line no-underscore-dangle
});

http.createServer((request, response) => {
  fs.readFile(`${chatLocation}${getFileNameFromUrl(request.url)}`, (error, data) => {
    if (error) {
      log(`URL ${request.url} not found in cache, proxying to ${proxyUrl}`);
      response.setHeader(isBackchatHeaderName, 'no');
      const parsedUrl = url.parse(proxyUrl);
      return proxyServer.web(request, response, {
        target: {
          host: parsedUrl.host,
          port: parsedUrl.port,
          https: parsedUrl.protocol === 'https:',
        },
      });
    }

    log(`URL ${request.url} found in cache returning contents`);

    const chat = JSON.parse(data);

    delete chat.headers['content-encoding'];

    response.writeHead(200, {
      ...chat.headers,
      [isBackchatHeaderName]: 'yes',
    });

    return response.end(chat.body);
  });
}).listen(port, () => log(`Backchat server for ${proxyUrl} running on port ${port}`));
