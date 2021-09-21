# twitch-subscription-farmer

## About
Node.js application that allows you to farm channels for gifted subs

## Installation

1. Check out twitch-subscription-farmer to your desired directory
```
$ git clone https://github.com/fraserreilly/twitch-farmer your_directory
```
2. Install node_modules
```
$ npm i while in your directory or run the initialize.bat file
```
## Usage
### Prerequisites
You need to get your OAUTH token, bearer token and client ID. 
First get your bearer token [here](https://twitchapps.com/tmi/).  
Then get your client ID by following the steps [here](https://dev.twitch.tv/docs/api/) **you'll need this to get your OAUTH token also**.
Then get your OAUTH token [here](https://twitchapps.com/tokengen/) **make sure to include "user:read:follows" in the scopes field**.
After getting your OAUTH token, bearer token and client ID, rename "_template.env" to ".env" and replace the made up values:
```
TWITCHOAUTH="OAUTH"
BEARER='bearer'
CLIENT_ID="client_id"
```
**Change "config_template.json" to "config.json"**
**Make sure you change the nick in "config.json" to your twitch username in lower case**
### (Optional) Configuration
There are several options you can tweak in the "config.json" file:
* "maxChannels": The maximum amount of channels the application will try and connect to
* "minViewers": The maximum amount of viewers per channel the application will try and connect to
* "maxViewers": The maximum amount of viewers per channel the application will try and connect to
* "watchFollowed": Change to true if you want the application to connect to your followed live streamers **the application will always connect to these before other streams**
* "channels": List of channels the application will try and connect to, leave empty if you don't have any specific channels to watch that you don't follow **the application will always connect to these before other streams but after followed streams**
* "games": List of games that the application will get channels from, leave empty if you don't want to get streams from specific games

Examples of games and channels:
```
channels = ["sodapoppin", "tfue", "loltyler1"] **make sure that these names are lowercase**
games = ["VALORANT", "Just Chatting", "League of Legends"] **make sure this is the full name of the game**
```
### Running the application
To run the application open the start.bat file or execute:
```
node index.js
```

## DISCLAIMER
twitch-farmer was made for personal use only. If you find any improvments or bugs in the code let me know. If you have any problems while running this app, please refer to above.
