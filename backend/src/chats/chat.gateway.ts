import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket'], // только WebSocket, без polling
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor() {
    console.log('🔥 ChatGateway constructor called!');
  }

  handleConnection(client: Socket) {
    console.log(`✅ Client connected: ${client.id}`);
    client.emit('connected', { message: 'Welcome to WebSocket!' });
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Client disconnected: ${client.id}`);
  }
}