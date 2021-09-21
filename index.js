require("dotenv").config();

const config = require("./config.json");
const tmi = require("tmi.js");
const axios = require("axios");

const currentlyConnected = new Set();
const userIDs = new Set()

const client = new tmi.Client({
	options: { debug: false },
	identity: {
		username: config.nick,
		password: process.env.TWITCHOAUTH
	},
	channels: []
});

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
    const params = {
        after: "",
        first: 100
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
        if (response.data.data[user].viewer_count <= config.minViewers || response.data.data[user].viewer_count >= config.maxViewers || response.data.data[user].user_login === undefined) {
            break;
        }
        userIDs.add(response.data.data[user].user_login)
    }
    if (userIDs.size > config.maxChannels) {
        userIDs.size = config.maxChannels
    }
    return userIDs
}

async function joinChannels(){
    client.on("connected", onConnectedHandler);
    await client.connect()
    const channels = Array.from(await getChannels());
    if (channels.length > config.maxChannels) {
        channels.length = config.maxChannels
    }
    console.log(`Connecting to ${channels.length} channels`)
    for (let user in channels) {
            client.join(channels[user]);
            console.log(`${config.nick} successfully joined ${channels[user]}'s stream`);
            currentlyConnected.add(channels[user]);
            await sleep(1000);
    }
}

function onConnectedHandler (addr, port) {
    console.log(`${config.nick} Connected to ${addr}:${port}`);
}

async function removeInactiveChannels() {
    const response = await axios.get(`${config.twitchAPI}streams`, {
        params: {
            after: "",
            first: 100,
            user_login: Array.from(currentlyConnected)
        },
    headers: {
        "Authorization": `Bearer ${process.env.BEARER}`,
        "Client-Id": `${process.env.CLIENT_ID}`
    }})
    .catch(function (e) {
        console.log(e.response);
    })
    for (let user in response.data.data) {
        if (response.data.data[user].user_login in Array.from(currentlyConnected)) {
            break;
        }
        userIDs.delete(response.data.data[user].user_login)
        currentlyConnected.delete(response.data.data[user].user_login)
        client.part(response.data.data[user].user_login)
    }
}
async function updateChannels() {
    const channels = Array.from(await getChannels());
    await removeInactiveChannels();
    for (let user in channels) {
        if (currentlyConnected.size < config.maxChannels) {
            client.join(channels[user]);
            currentlyConnected.add(channels[user]);
            console.log(`${config.nick} successfully joined ${channels[user]}'s stream`);
            await sleep(1000);
        } else {
            console.log(`${config.nick} already connected to ${currentlyConnected.size} streams, sleeping`);
            return;
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    joinChannels();
    while (true) {
        await sleep(1200000);
        updateChannels();
    }
}

run()