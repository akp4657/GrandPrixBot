# GrandPrixBot

Discord bot for automatic Challonge score reporting and winner role management.

## Runtime configuration

Set `DISCORD_POSTS_CHANNEL_ID` for the input channel and `ADMIN_POSTS_CHANNEL_ID` for failure reports. Set `DATA_DIR=/data` on Render when using a persistent disk.

`config.json` contains two or more Challonge slugs. Administrators can replace them with `/configure-tournaments`. Winner totals are stored in `winner-state.json`.

## Score reporting

Post `@Player1 3 - 2 @Player2` in the configured input channel. Mentions are optional, and extra text such as channel names or bot mentions is ignored while matching participant names. The bot matches names against Challonge participants and open matches across every configured tournament, updates Challonge, and reacts with a thumbs-up. Failures are sent to the admin channel.

Enable Discord's **Message Content Intent** and run `npm run deploy:dev` after command changes.

Administrators can use `/winner-counts` to receive Open and NB win totals as formatted JSON.
