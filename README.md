# backchat

Backchat is a small Node.js utility for recording HTTP traffic and replaying it when the same request is made in the future.

## Usage
1. Install the utlity with `yarn add backchat-proxy`
2. Run the utility from your Node.js modules `node_modules/.bin/backchat` (see below for arguments)

| Name                        | Description                                                 | Required | Default  |
|-----------------------------|-------------------------------------------------------------|----------|----------|
| `-p`, `--port`              | The port to run the proxy server on                         | no       | `10001`  |
| `-c`, `--chat_location`     | The folder path for the chats to be stored                  | no       | `chats/` |
| `-d`, `--disable_recording` | Disable the recording feature and just use the proxy        | no       | `false`  |
| `-u`, `--proxy_url`         | The URL to proxy all traffic that goes through the proxy to | yes      | n/a      |