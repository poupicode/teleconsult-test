import { useState, useRef, useEffect } from 'react';
import deviceType from './config';
import { configureNotifications } from './services';

interface ConnectedCard {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer;
  service: string;
  deviceName: string;
  measurements: { name: string; data: string | number }[];
}

type UseBluetoothOptions = {
  onMeasurement?: (payload: object) => void; // callback à appeler quand une mesure est lue
};

export function useBluetooth({ onMeasurement }: UseBluetoothOptions = {}) {
  // État de connexion Bluetooth
  const [status, setStatus] = useState('En attente...');
  const [connectedCards, setConnectedCards] = useState<ConnectedCard[]>([]);
  const deviceRef = useRef<BluetoothDevice | null>(null);

  // Services Bluetooth compatibles définis dans le fichier config
  const supportedServices = Object.keys(deviceType) as Array<Extract<keyof typeof deviceType, string>>;

  // Fonction principale pour se connecter à un appareil Bluetooth
  const connect = async () => {
    try {
      // Filtre les services disponibles
      const filters = supportedServices.map((svc) => ({ services: [svc] }));
      const device = await navigator.bluetooth.requestDevice({
        filters,
        optionalServices: supportedServices,
      });

      setStatus(`Connexion à ${device.name}...`);
      deviceRef.current = device;

      // Connexion GATT à l’appareil
      const server = await device.gatt?.connect();
      setStatus('Connecté !');

      // Gère la reconnexion automatique si l'appareil se déconnecte
      device.addEventListener('gattserverdisconnected', () => reconnectDevice(device));

      if (!server) throw new Error('Impossible d’obtenir le GATT server');

      // Pour chaque service compatible, essaye de l’activer
      for (const serviceKey of supportedServices) {
        try {
          await server.getPrimaryService(serviceKey); // test si le service est disponible
          await configureNotifications(
            serviceKey,
            device,
            server,
            (dev, srv, svc, measures) => addOrUpdateCard(dev, srv, svc, measures, onMeasurement),
            setStatus
          );
          return; // Dès qu'un service marche, on arrête de chercher
        } catch {}
      }

      setStatus('Aucun service compatible trouvé.');
    } catch (err: any) {
      console.error(err);
      setStatus('Erreur de connexion : ' + err.message);
    }
  };

  // Tentative de reconnexion automatique après déconnexion
  const reconnectDevice = async (device: BluetoothDevice) => {
    setStatus('Tentative de reconnexion…');
    try {
      const server = await device.gatt!.connect();
      setStatus('Reconnecté !');

      for (const serviceKey of supportedServices) {
        try {
          await server.getPrimaryService(serviceKey);
          await configureNotifications(
            serviceKey,
            device,
            server,
            (dev, srv, svc, measures) => addOrUpdateCard(dev, srv, svc, measures, onMeasurement),
            setStatus
          );
          return;
        } catch {}
      }

      setStatus('Aucun service compatible trouvé.');
    } catch {
      setTimeout(() => reconnectDevice(device), 5000);
    }
  };

  // Stocke ou met à jour une carde, et envoie au docteur via WebRTC si dispo
  const addOrUpdateCard = (
    device: BluetoothDevice,
    server: BluetoothRemoteGATTServer,
    service: string,
    measurements: { name: string; data: string | number }[],
    sendMeasurement?: (payload: object) => void
  ) => {
    // Transforme les mesures en un objet clé/valeur
    const payload = {
      [service]: measurements.reduce((acc, m) => {
        acc[m.name] = m.data;
        return acc;
      }, {} as Record<string, string | number>)
    };
      console.log('[Patient] Mesure prête à être envoyée via WebRTC :', payload);

    // Envoie la mesure si un callback est fourni
    if (sendMeasurement) {
      sendMeasurement(payload); // envoie la mesure via WebRTC
    }

    // Met à jour la carte dans l’état React
    setConnectedCards((prev) => {
      const index = prev.findIndex((card) => card.service === service);
      const updatedCard: ConnectedCard = {
        device,
        server,
        service,
        deviceName: device.name || 'Inconnu',
        measurements,
      };
      if (index !== -1) {
        const copy = [...prev];
        copy[index] = updatedCard;
        return copy;
      }
      return [...prev, updatedCard];
    });
  };

  // Retourne les infos de connexion + les cardes + la fonction de connexion
  return { status, connectedCards, connect };
}
