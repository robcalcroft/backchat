const http = require('http');
const proxy = require('http-proxy');
const zlib = require('zlib');
const url = require('url');
const fs = require('fs');

const port = process.env.PORT || 10001;
const chatLocation = process.env.CHAT_LOCATION || 'chats/';
const disableRecording = !!process.env.DISABLE_RECORDING;
const proxyUrl = process.env.PROXY_URL;
const isBackchatHeaderName = 'x-from-backchat-cache';

if (!proxyUrl) {
  throw new Error('A PROXY_URL environment variable must be present');
}

const proxyServer = proxy.createProxyServer({});

const getFileNameFromUrl = url => `${Buffer.from(url).toString('base64')}.json`;

const saveRequest = (response) => {
  let rawBody = [];
  const isGzipped = response.headers['content-encoding'] === 'gzip';

  response.on('data', data => rawBody.push(data));

  response.on('end', () => {
    let body = '';
    if (isGzipped) {
      body = zlib.gunzipSync(Buffer.concat(rawBody)).toString();
    } else {
      body = Buffer.concat(rawBody).toString();
    }
    debugger;

    fs.writeFile(`${chatLocation}${getFileNameFromUrl(response.socket._httpMessage.path)}`, JSON.stringify({
      recorded: Math.round(Date.now() / 1000),
      headers: response.headers,
      body,
    }),(error) => {
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

proxyServer.on('proxyRes', (proxyResponse, request, response) => {
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
    response.end(chat.body);
  });
}).listen(port, () => console.log(`Backchat server running on port ${port}`));
