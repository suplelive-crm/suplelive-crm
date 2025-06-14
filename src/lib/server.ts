// server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createEvolutionWebhookHandler } from './evolution-api'; // Importe seu handler

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Permite a conexão do seu app React
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Funções que serão chamadas pelo handler quando um evento chegar
const handleQRCode = (instance, qrCode) => {
  console.log(`QR Code para ${instance}:`, qrCode);
  io.emit('qrcode_update', { instance, qrCode });
};

const handleConnection = (instance, status) => {
  console.log(`Conexão para ${instance}:`, status);
  io.emit('connection_update', { instance, status });
};

const handleMessage = (instance, message) => {
  console.log(`Nova mensagem para ${instance}:`, message);
  // EMITIR O EVENTO PARA O FRONT-END
  io.emit('new_message', { instance, message });
};

// Crie o handler usando a função do seu arquivo
const evolutionWebhookHandler = createEvolutionWebhookHandler(
  handleQRCode,
  handleConnection,
  handleMessage
);

// Crie a rota que irá receber o Webhook da Evolution API
app.post('/webhook', (req, res) => {
  console.log('Webhook recebido!');
  evolutionWebhookHandler(req.body); // Processa os dados do webhook
  res.status(200).send('Event received');
});

// Conexão do WebSocket
io.on('connection', (socket) => {
  console.log('Um usuário conectou via WebSocket:', socket.id);
  socket.on('disconnect', () => {
    console.log('Usuário desconectou:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor back-end rodando na porta ${PORT}`);
});