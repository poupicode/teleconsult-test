import { useBluetooth } from '../../features/bluetooth/useBluetooth';
import ServiceCard from './ServiceCard';
import ButtonConnexionApp from './ButtonConnexionApp';
import { PeerConnection } from '@/features/room/rtc/peer/connection/peer-connection';

// Définition des props attendues pour le composant : un objet PeerConnection
interface BluetoothContextProps {
  peerConnection: PeerConnection;
}

export default function BluetoothContext({ peerConnection }: BluetoothContextProps) {
// Initialisation du hook Bluetooth avec une fonction de rappel "onMeasurement"
  // Cette fonction est appelée à chaque nouvelle mesure reçue via Bluetooth
  const { status, connectedCards, connect } = useBluetooth({
    onMeasurement: (payload) => {
      // Vérifie que le peerConnection est disponible et que le canal de données est prêt
  if (!peerConnection || !peerConnection.isDataChannelAvailable()) return;
// Récupère le gestionnaire du dataChannel et envoie la mesure au "docteur"
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
