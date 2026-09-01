const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

const players = new Map();

const server = http.createServer((req, res) => {

    let filePath = path.join(
        __dirname,
        req.url === "/" ? "index.html" : req.url
    );

    if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
    }

    const ext = path.extname(filePath);

    const types = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json"
    };

    res.writeHead(200, {
        "Content-Type":
            types[ext] || "text/plain"
    });

    fs.createReadStream(filePath).pipe(res);
});

const wss = new WebSocket.Server({
    server
});

function randomSpawn() {

    return {
        x: (Math.random() - 0.5) * 30,
        y: 1,
        z: (Math.random() - 0.5) * 30
    };
}

function createPlayer(ws) {

    const id =
        Math.random()
            .toString(36)
            .substring(2, 10);

    const spawn = randomSpawn();

    const player = {

        id,

        x: spawn.x,
        y: spawn.y,
        z: spawn.z,

        yaw: 0,
        pitch: 0,

        flashlight: true,

        monster: false
    };

    players.set(id, {
        ws,
        data: player
    });

    return player;
}

function getMonster() {

    for (const player of players.values()) {

        if (player.data.monster) {
            return player.data.id;
        }
    }

    return null;
}

function send(ws, data) {

    if (
        ws.readyState ===
        WebSocket.OPEN
    ) {

        ws.send(
            JSON.stringify(data)
        );
    }
}

function broadcast(data) {

    const message =
        JSON.stringify(data);

    for (const player of players.values()) {

        if (
            player.ws.readyState ===
            WebSocket.OPEN
        ) {

            player.ws.send(message);
        }
    }
}

function sendPlayers() {

    const list = [];

    for (const player of players.values()) {

        list.push(
            player.data
        );
    }

    broadcast({
        type: "players",
        players: list
    });
}

wss.on("connection", (ws) => {

    console.log("Spieler verbunden");

    const player =
        createPlayer(ws);

    // Wenn noch kein Monster existiert,
    // wird der erste Spieler Monster.

    if (getMonster() === null) {

        player.monster = true;

    }

    send(ws, {

        type: "welcome",

        id: player.id,

        monster: player.monster
    });

    sendPlayers();


    ws.on("message", (raw) => {

        let message;

        try {

            message =
                JSON.parse(raw.toString());

        } catch {

            return;
        }


        const entry =
            players.get(player.id);

        if (!entry) return;


        const p =
            entry.data;


        // Position

        if (
            message.type ===
            "state"
        ) {

            if (
                typeof message.x ===
                "number"
            )
                p.x = message.x;

            if (
                typeof message.y ===
                "number"
            )
                p.y = message.y;

            if (
                typeof message.z ===
                "number"
            )
                p.z = message.z;

            if (
                typeof message.yaw ===
                "number"
            )
                p.yaw =
                    message.yaw;

            if (
                typeof message.pitch ===
                "number"
            )
                p.pitch =
                    message.pitch;

            if (
                typeof message.flashlight ===
                "boolean"
            )
                p.flashlight =
                    message.flashlight;

            sendPlayers();
        }


        // Blendgranate

        if (
            message.type ===
            "flashbang"
        ) {

            broadcast({

                type: "flashbang",

                x: p.x,
                y: p.y,
                z: p.z,

                owner: p.id

            });
        }


        // Monster-Aktion

        if (
            message.type ===
            "monsterAction"
        ) {

            if (p.monster) {

                broadcast({

                    type:
                        "monsterAction",

                    action:
                        message.action,

                    owner:
                        p.id

                });
            }
        }

    });


    ws.on("close", () => {

        console.log(
            "Spieler getrennt:",
            player.id
        );

        players.delete(
            player.id
        );


        // Wenn Monster gegangen ist,
        // wird ein neuer Spieler Monster.

        if (
            player.monster &&
            players.size > 0
        ) {

            const next =
                players.values()
                    .next()
                    .value;

            if (next) {

                next.data.monster =
                    true;

                send(next.ws, {

                    type: "role",

                    monster: true

                });
            }
        }


        sendPlayers();
    });

});

server.listen(
    PORT,
    () => {

        console.log(
            `Horror Server läuft auf Port ${PORT}`
        );

    }
);
