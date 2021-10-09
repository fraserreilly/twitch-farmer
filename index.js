require("dotenv").config();

const config = require("./config.json");
const tmi = require("tmi.js");
const axios = require("axios");

const currentlyConnected = new Set();
const userIDs = new Set();
const subscribed = new Set();
const banned = new Set();

const client = new tmi.Client({
    connection: {
		reconnect: true,
		secure: true
	},
	identity: {
		username: config.nick,
		password: process.env.TWITCHOAUTH
	},
	channels: []
});

client.on("join", (channel, username, self) => {
    if (self && !currentlyConnected.has(channel)) {
    currentlyConnected.add(channel.slice(1));
    console.log(`${config.nick} successfully joined ${channel.slice(1)}'s stream`);
    }
})

client.on('part', (channel, username, self) => {
    if (self) {
        currentlyConnected.delete(channel.slice(1));
        userIDs.delete(channel.slice(1));
        console.log(`${config.nick} successfully left ${channel.slice(1)}'s stream`);
    }
})
client.on('disconnected', () => {
    currentlyConnected.clear();
    userIDs.clear();
});

client.on("subgift", (channel, username, _, recipient) => {
    if (recipient === config.nick) {
        console.log(`received a subscription gift from user "${username}" in channel "${channel.slice(1)}"`);
        subscribed.add(channel.slice(1))
    }
});

client.on("ban", (channel, username, reason, userstate) => {
    if(username == config.nick) {
        console.log(`${config.nick} is banned in ${channel}`);
        currentlyConnected.delete(channel.slice(1));
        userIDs.delete(channel.slice(1));
    }
});

client.on("reconnect", () => {
    console.log(`Trying to reconnect to the twitch server...`);
});

function onConnectedHandler (addr, port) {
    console.log(`${config.nick} connected to ${addr}:${port}`);
}

async function getPersonalUserID(){
    response = await axios.get(`${config.twitchAPI}users`, {
        params: {
            "login": config.nick
        },
        headers: {
        "Authorization": `Bearer ${process.env.BEARER}`,
        "Client-Id": `${process.env.CLIENT_ID}`
    }})
    .catch(function(e) {
        console.log(e.response);
    })
    return response.data.data[0].id

}

async function getChannels() {
    var params = {
        after: "",
        first: 100
    }
    if (config.watchFollowed === true) {
        const userID = await getPersonalUserID();
        const response = await axios.get(`${config.twitchAPI}streams/followed`, {
            params: {
                user_id: userID,
                cursor: "",
                first: 100
            },
        headers: {
            "Authorization": `Bearer ${process.env.BEARER}`,
            "Client-Id": `${process.env.CLIENT_ID}`
        }})
        .catch(function (e) {
            console.log(e.response);
        })
        for (let user in response.data.data) {
            userIDs.add(response.data.data[user].user_login)
        }
    }
    if (config.channels.length > 0) {
        const response = await axios.get(`${config.twitchAPI}streams`, {
            params: {
                cursor: "",
                first: 100,
                user_login: config.channels
            },
        headers: {
            "Authorization": `Bearer ${process.env.BEARER}`,
            "Client-Id": `${process.env.CLIENT_ID}`
        }})
        .catch(function (e) {
            console.log(e.response);
        })
        for (let user in response.data.data) {
            userIDs.add(response.data.data[user].user_login)
        }
    }
    if (config.games.length > 0) {
        const gamesList = []
        const response = await axios.get(`${config.twitchAPI}games`, {
            params: {
                "name": config.games
            },
            headers: {
                "Authorization": `Bearer ${process.env.BEARER}`,
                "Client-Id": `${process.env.CLIENT_ID}`
            }})
            .catch(function(e) {
                console.log(e.response);
            })
            for (let gameID in response.data.data) {
                if (response.data.data[gameID].id === undefined) {
                    break
                }
                gamesList.push(response.data.data[gameID].id)
            }
        params["game_id"] = gamesList
    }
    var i = currentlyConnected.size
    while (i < config.maxChannels) {
        const response = await axios.get(`${config.twitchAPI}streams`, {
            params: params,
            headers: {
                "Authorization": `Bearer ${process.env.BEARER}`,
                "Client-Id": `${process.env.CLIENT_ID}`
            }})
        .catch(function (e) {
            console.log(e.response);
        })
        i += response.data.data.length
        for (let user in response.data.data) {
            if (response.data.data[user].viewer_count <= config.minViewers || response.data.data[user].viewer_count >= config.maxViewers || response.data.data[user].user_login === undefined) {
                break;
            }
            userIDs.add(response.data.data[user].user_login)
        }
        params["after"] = response.data.pagination.cursor
    }
    userIDs.forEach((user => {
        if(subscribed.has(user)) {
            userIDs.delete(user)
            console.log(`already subscribed to ${user}, removing from queue`)
        }
        if(banned.has(user)) {
            userIDs.delete(user);
            console.log(`banned in ${user}'s channel, skipping`);
        }
    }))
    // for some reason javascript doesn't allow sets to be assigned a new size so this is the temporary solution until it changes
    if (userIDs.size > config.maxChannels) {
        const temp = Array.from(userIDs)
        temp.length = config.maxChannels
        const fixedLengthUserIDs = new Set(temp);
        return fixedLengthUserIDs
    }
    return userIDs
}

async function joinChannels(){
    client.on("connected", onConnectedHandler);
    await client.connect()
    const channels = await getChannels();
    console.log(`connecting to ${channels.size} channels`);
    for (let user of channels) {
        client.join(user);
        await sleep(1000)
    }
}

async function removeInactiveChannels() {
    const active = []
    for (let i = 0; i < currentlyConnected.size; i+=100) {
        var params = {
            after: "",
            first: 100,
            user_login: Array.from(currentlyConnected).slice(i, i+=100)
        }
        const response = await axios.get(`${config.twitchAPI}streams`, {
            params: params,
        headers: {
            "Authorization": `Bearer ${process.env.BEARER}`,
            "Client-Id": `${process.env.CLIENT_ID}`
        }})
        .catch(function (e) {
            console.log(e.response);
        })
        for (let user in response.data.data) {
            if (currentlyConnected.has(response.data.data[user].user_login)) {
                active.push(response.data.data[user].user_login)
            }
        }
        params["after"] = response.data.pagination.cursor
    }
    for (let user of currentlyConnected) {
        if (!active.includes(user, 0)) {
            client.part(user);
            await sleep(1000);
        }
    }
}
async function updateChannels() {
    await removeInactiveChannels();
    const channels = await getChannels();
    for (let user of channels) {
        if (currentlyConnected.size > config.maxChannels) {
            console.log(`${config.nick} connected to ${currentlyConnected.size} streams which is the maximum available, sleeping`);
            return; 
        } else if (!currentlyConnected.has(user)) {
            client.join(user);
            currentlyConnected.add(user);
            await sleep(1000);
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    await joinChannels();
    while (true) {
        await sleep(1200000);
        await updateChannels();
    }
}

run()