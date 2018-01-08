#!/usr/bin/env node

const http = require('http');
const proxy = require('http-proxy');
const zlib = require('zlib');
const url = require('url');
const fs = require('fs');
const args = require('minimist');

const port = args.port || args.p || 10001;
const chatLocation = args['chat-location'] || args.c || 'chats/';
const disableRecording = args['disable-recording'] || args.d || false;
const proxyUrl = args['proxy-url'] || args.u;
const isBackchatHeaderName = 'x-from-backchat-cache';

if (!proxyUrl) {
  throw new Error('A --proxy-url argument must be given');
}

const proxyServer = proxy.createProxyServer({});

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
    });
  });
};

proxyServer.on('proxyReq', (proxyRequest) => {
  // Some services require the `Host` header to be present
  proxyRequest.setHeader('Host', url.parse(proxyUrl).hostname);
});

proxyServer.on('proxyRes', (proxyResponse) => {
  if (!disableRecording) {
    saveRequest(proxyResponse);
  }
});

http.createServer((request, response) => {
  fs.readFile(`${chatLocation}${getFileNameFromUrl(request.url)}`, (error, data) => {
    if (error) {
      // When a file isn't available in the cache we request it and add to the cache
      response.setHeader(isBackchatHeaderName, 'no');
      return proxyServer.web(request, response, { target: proxyUrl });
    }
    const chat = JSON.parse(data);

    delete chat.headers['content-encoding'];

    response.writeHead(200, {
      ...chat.headers,
      [isBackchatHeaderName]: 'yes',
    });

    return response.end(chat.body);
  });
}).listen(port, () => console.log(`Backchat server running on port ${port}`));
