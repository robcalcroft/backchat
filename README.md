# :ear: backchat

Backchat is a small Node.js proxy utility for recording HTTP traffic and replaying it when the same request is made in the future.

## Usage
1. Install the utility with `yarn add backchat-proxy`
2. Ensure the folder you are using to store the chats is created, by default it is `chats/`
3. Run the utility from your Node.js modules `node_modules/.bin/backchat`, or `backchat` on its own inside `package.json` scripts (see below for arguments)

| Name                        | Description                                                 | Required | Default  |
|-----------------------------|-------------------------------------------------------------|----------|----------|
| `-p`, `--port`              | The port to run the proxy server on                         | no       | `10001`  |
| `-c`, `--chat-location`     | The folder path for the chats to be stored                  | no       | `chats/` |
| `-d`, `--disable-recording` | Disable the recording feature and just use the proxy        | no       | `false`  |
| `-u`, `--proxy-url`         | The URL to proxy all traffic that goes through the proxy to | yes      | n/a      |

**To force a request to override the cached version, simply add `__backchat_override=1` to the URL's query string**
