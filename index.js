#!/usr/bin/env node

const http = require('http');
const proxy = require('http-proxy');
const zlib = require('zlib');
const url = require('url');
const fs = require('fs');
const minimist = require('minimist');
const querystring = require('querystring');

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

const saveResponse = (response) => {
  const rawBody = [];
  const contentEncodingHeader = response.headers['content-encoding'];
  const path = response.socket._httpMessage.path;
  const isGzipped = !!contentEncodingHeader && contentEncodingHeader.includes('gzip');

  response.on('data', data => rawBody.push(data));

  response.on('end', () => {
    let body = '';
    if (isGzipped) {
      body = zlib.gunzipSync(Buffer.concat(rawBody)).toString();
    } else {
      body = Buffer.concat(rawBody).toString();
    }

    fs.writeFile(`${chatLocation}${getFileNameFromUrl(path)}`, JSON.stringify({
      recorded: Math.round(Date.now() / 1000),
      headers: response.headers,
      body,
    }), (error) => {
      if (error) {
        throw new Error(error.message);
      }
      log(`Wrote ${getFileNameFromUrl(path)} for URL ${path}`);
    });
  });
};

proxyServer.on('proxyReq', (proxyRequest) => {
  // Some services require the `Host` header to be present
  proxyRequest.setHeader('Host', url.parse(proxyUrl).hostname);
});

proxyServer.on('proxyRes', (proxyResponse, request) => {
  if (!disableRecording) {
    return saveResponse(proxyResponse);
  }
  return log(`URL ${proxyResponse.socket._httpMessage.path} not being cached as recording is disabled`);
});

http.createServer((request, response) => {
  fs.readFile(`${chatLocation}${getFileNameFromUrl(request.url)}`, (error, data) => {
    if (error || !!request.headers['x-backchat-override-record']) {
      if (!!request.headers['x-backchat-override-record']) {
        log(`URL ${request.url} being overridden to use proxy`);
      } else {
        log(`URL ${request.url} not found in cache, proxying to ${proxyUrl}`);
      }
      response.setHeader(isBackchatHeaderName, 'no');
      const parsedProxyUrl = url.parse(proxyUrl);
      return proxyServer.web(request, response, {
        target: {
          host: parsedProxyUrl.host,
          port: parsedProxyUrl.port,
          https: parsedProxyUrl.protocol === 'https:',
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
