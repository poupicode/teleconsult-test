import { useBluetooth } from '../../features/bluetooth/useBluetooth';
import ServiceCard from './ServiceCard';
import ButtonConnexionApp from './ButtonConnexionApp';
import { PeerConnection } from '@/features/room/rtc/peer/connection/peer-connection';

interface BluetoothContextProps {
  peerConnection: PeerConnection;
}

export default function BluetoothContext({ peerConnection }: BluetoothContextProps) {
  // 👉 On injecte une fonction d'envoi directement dans le hook
  const { status, connectedCards, connect } = useBluetooth({
    onMeasurement: (payload) => {
  if (!peerConnection || !peerConnection.isDataChannelAvailable()) return;

  const manager = peerConnection.getDataChannelManager();
  manager.sendMeasurement(payload);
}

  });

  return (
    <div className="p-4 border rounded-md space-y-4">
      <h2 className="font-bold text-lg">Connexion Bluetooth</h2>
      <ButtonConnexionApp label="Se connecter" onClick={connect} variant="primary" />
      <p>État : {status}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {connectedCards.map((card) => (
          <ServiceCard
            key={`${card.device.id}-${card.service}`}
            service={card.service}
            measurements={card.measurements}
            deviceName={card.deviceName}
          />
        ))}
      </div>
    </div>
  );
}
