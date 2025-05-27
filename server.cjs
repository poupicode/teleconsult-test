// server.js
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3001 });

wss.on('connection', (ws) => {
  console.log('[SERVER] Nouvelle connexion WebSocket');

  ws.on('message', (message) => {
    const parsed = JSON.parse(message);
    console.log('[SERVER] Reçu :', parsed);

    //  On renvoie le message à tous les autres clients connectés
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(parsed));
      }
    });
  });
});
