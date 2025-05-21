// components/BluetoothContext.tsx
import { useRef, useState } from 'react';

import ServiceCard from './ServiceCard';
import deviceType from './config';
import {
  configureNotifications
} from './services';
import ButtonConnexionApp from './ButtonConnexionApp';

//device → L’appareil Bluetooth connecté
//server → La connexion GATT active
//service → Le nom du service ('blood_pressure', etc.)
//measurements → Un tableau de mesures décodées (ex. température, tension)

interface ConnectedCard {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer;
  service: string;
  deviceName: string;
  measurements: { name: string; data: string | number }[];
}




export default function BluetoothContext() {
  const [status, setStatus] = useState('En attente...');
  const [connectedCards, setConnectedCards] = useState<ConnectedCard[]>([]);
  const deviceRef = useRef<BluetoothDevice | null>(null);

  const supportedServices = Object.keys(deviceType) as Array<Extract<keyof typeof deviceType, string>>;
  //Établir une connexion Bluetooth entre le navigateur et un appareil compatible,
  // en utilisant les services définis dans supportedServices,
  // puis configurer les notifications.
  const connect = async () => {
    try {
      const filters = supportedServices.map((svc) => ({ services: [svc] }));//filtre avec les services de config.ts
      const device = await navigator.bluetooth.requestDevice({
        filters,
        optionalServices: supportedServices,
      });

      setStatus(`Connexion à ${device.name}...`);
      deviceRef.current = device;

      const server = await device.gatt?.connect();
      setStatus('Connecté !');


      device.addEventListener('gattserverdisconnected', () => reconnectDevice(device));

      if (!server) throw new Error('Impossible d’obtenir le GATT server')

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
          return;  // on stoppe après avoir trouvé ET configuré un service
        } catch {
        }
      }

      setStatus('Aucun service compatible trouvé.');
    } catch (err: any) {
      console.error(err);
      setStatus('Erreur de connexion : ' + err.message);
    }
  };

  //Tenter de reconnecter automatiquement un appareil Bluetooth qui a été déconnecté,
  // et relancer la configuration des notifications sur les services.
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
        } catch { }
      }

      setStatus('Aucun service compatible trouvé.');
    } catch {
      // on réessaie dans 5s
      setTimeout(() => reconnectDevice(device), 5000);
    }
  };

  //Ajouter une nouvelle carte de mesures ou mettre à jour une carte existante pour un appareil Bluetooth
  const addOrUpdateCard = (
    device: BluetoothDevice,
    server: BluetoothRemoteGATTServer,
    service: string,
    measurements: { name: string; data: string | number }[]
  ) => {
    setConnectedCards(prev => {
      const index = prev.findIndex(
        //recherche de card existante
        (card) => card.service === service
      );
      //construction de la nouvelle card
      const updatedCard: ConnectedCard = {
        device,
        server,
        service,
        deviceName: device.name || 'Inconnu',
        measurements,
      };

      //remplacement ou ajout
      if (index !== -1) {
        const copy = [...prev];
        copy[index] = updatedCard;
        return copy;
      }
      return [...prev, updatedCard];
    });
  };

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