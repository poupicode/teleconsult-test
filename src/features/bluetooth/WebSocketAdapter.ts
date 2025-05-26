export class WebSocketAdapter {
  private socket: WebSocket;

  constructor(url: string) {
    this.socket = new WebSocket(url);
  }

  sendMeasurement(payload: object) {
    this.socket.send(JSON.stringify({ type: 'measurement', payload }));
  }

  onMeasurement(callback: (data: object) => void) {
    this.socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'measurement') {
        callback(msg.payload);
      }
    };
  }
}
