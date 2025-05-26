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
  onMeasurement?: (payload: object) => void; // Fonction appelée à chaque nouvelle mesure
};

export function useBluetooth({ onMeasurement }: UseBluetoothOptions = {}) {
  const [status, setStatus] = useState('En attente...');
  const [connectedCards, setConnectedCards] = useState<ConnectedCard[]>([]); // Liste des cartes connectées et leurs mesures
  const deviceRef = useRef<BluetoothDevice | null>(null); // Référence à l’appareil connecté

  // Liste des services supportés à partir de la config
  const supportedServices = Object.keys(deviceType) as Array<Extract<keyof typeof deviceType, string>>;

  const connect = async () => {
    try {
      // Prépare les filtres pour ne chercher que les services supportés
      const filters = supportedServices.map((svc) => ({ services: [svc] }));
      const device = await navigator.bluetooth.requestDevice({
        filters,
        optionalServices: supportedServices,
      });

      setStatus(`Connexion à ${device.name}...`);
      deviceRef.current = device;

      const server = await device.gatt?.connect();
      setStatus('Connecté !');

      // Écoute les déconnexions pour tenter une reconnexion automatique
      device.addEventListener('gattserverdisconnected', () => reconnectDevice(device));

      if (!server) throw new Error('Impossible d’obtenir le GATT server');

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
    } catch (err: any) {
      console.error(err);
      setStatus('Erreur de connexion : ' + err.message);
    }
  };

  // Fonction appelée en cas de déconnexion : tente une reconnexion automatique
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

  const addOrUpdateCard = (
    device: BluetoothDevice,
    server: BluetoothRemoteGATTServer,
    service: string,
    measurements: { name: string; data: string | number }[],
    sendMeasurement?: (payload: object) => void
  ) => {
    const payload = {
      [service]: measurements.reduce((acc, m) => {
        acc[m.name] = m.data;
        return acc;
      }, {} as Record<string, string | number>)
    };
      console.log('[Patient] Mesure prête à être envoyée via WebRTC :', payload);

    if (sendMeasurement) {
      sendMeasurement(payload); // envoie la mesure via WebRTC
    }

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

  return { status, connectedCards, connect };
}
