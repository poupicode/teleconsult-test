import { useState, useRef } from 'react';
import deviceType from './config';
import { configureNotifications } from './services';
import { peer } from '@/lib/peerInstance';

interface ConnectedCard {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer;
  service: string;
  deviceName: string;
  measurements: { name: string; data: string | number }[];
}

export function useBluetooth() {
  const [status, setStatus] = useState('En attente...');
  const [connectedCards, setConnectedCards] = useState<ConnectedCard[]>([]);
  const deviceRef = useRef<BluetoothDevice | null>(null);

  const supportedServices = Object.keys(deviceType) as Array<Extract<keyof typeof deviceType, string>>;

  const connect = async () => {
    try {
      const filters = supportedServices.map((svc) => ({ services: [svc] }));
      const device = await navigator.bluetooth.requestDevice({
        filters,
        optionalServices: supportedServices,
      });

      setStatus(`Connexion à ${device.name}...`);
      deviceRef.current = device;

      const server = await device.gatt?.connect();
      setStatus('Connecté !');

      device.addEventListener('gattserverdisconnected', () => reconnectDevice(device));

      if (!server) throw new Error('Impossible d’obtenir le GATT server');

      for (const serviceKey of supportedServices) {
        try {
          await server.getPrimaryService(serviceKey);
          await configureNotifications(
            serviceKey,
            device,
            server,
            addOrUpdateCard,
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
            addOrUpdateCard,
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
  measurements: { name: string; data: string | number }[]
) => {
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

  // 🔁 ENVOI DES DONNÉES VIA WebRTC
  if (peer.isDataChannelAvailable()) {
    const formattedPayload = {
      [service]: measurements
    };
    peer.sendChatMessage(JSON.stringify({
      type: 'measure',
      payload: formattedPayload
    }));
  } else {
    console.warn('DataChannel non disponible');
  }
};

  return { status, connectedCards, connect };
}