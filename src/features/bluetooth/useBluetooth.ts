import React, { useState, useRef, useEffect, use } from "react";
import deviceType from "./config";
import { configureNotifications } from "./services";
import { setMeasure, clearMeasures } from "../measures/measureSlice";
import { PeerConnection } from "@/features/room/rtc/peer/connection/peer-connection";

interface ConnectedCard {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer;
  service: string;
  deviceName: string;
  measurements: { name: string; data: string | number }[];
}

interface AllMeasures {
  [deviceType: string]: {
    [measures: string]: string;
  }[];
}

type UseBluetoothOptions = {
  peerConnection?: PeerConnection;
  dispatch?: (action: any) => void;
  allMeasuresStore?: AllMeasures;
};

export function useBluetooth({
  dispatch,
  allMeasuresStore,
  peerConnection,
}: UseBluetoothOptions = {}) {
  // État de connexion Bluetooth
  const [status, setStatus] = useState("En attente...");
  // const [connectedCards, setConnectedCards] = useState<AllMeasures>({}); // Liste des cartes connectées et leurs mesures
  const deviceRef = useRef<BluetoothDevice | null>(null); // Référence à l’appareil connecté

  // Services Bluetooth compatibles définis dans le fichier config
  const supportedServices = Object.keys(deviceType) as Array<
    Extract<keyof typeof deviceType, string>
  >;

  // Fonction de connexion Bluetooth
  // Utilise useCallback pour éviter de recréer la fonction à chaque render
  const connect = React.useCallback(async () => {
    try {
      // Prépare les filtres pour ne chercher que les services supportés
      const filters = supportedServices.map((svc) => ({ services: [svc] }));
      const device = await navigator.bluetooth.requestDevice({
        filters,
        optionalServices: supportedServices,
      });

      // Vérifie si l’appareil est déjà connecté
      setStatus(`Connexion à ${device.name}...`);
      deviceRef.current = device;

      // Connexion GATT à l’appareil
      const server = await device.gatt?.connect();
      setStatus("Connecté !");

      // Écoute les déconnexions pour tenter une reconnexion automatique
      device.addEventListener("gattserverdisconnected", () =>
        reconnectDevice(device)
      );

      // Vérifie si le serveur GATT est disponible
      if (!server) throw new Error("Impossible d’obtenir le GATT server");

      // Pour chaque service compatible, essaye de l’activer
      // et de configurer les notifications
      // Si un service est trouvé, on arrête la recherche
      for (const serviceKey of supportedServices) {
        try {
          await server.getPrimaryService(serviceKey); // test si le service est disponible
          await configureNotifications(
            serviceKey,
            device,
            server,
            (dev, srv, svc, measures) =>
              addOrUpdateCard(dev, srv, svc, measures),
            setStatus
          );
          // Si on arrive ici, le service est actif et les notifications sont configurées
          setStatus(`En attente de mesures pour ${deviceType[serviceKey].deviceName}…`);
          return; // Dès qu'un service marche, on arrête de chercher
        } catch {}
      }

      // Si aucun service compatible n'est trouvé, on met à jour le statut
      // et on vide la référence de l'appareil
      setStatus("Aucun service compatible trouvé.");
    } catch (err: any) {
      console.error(err);
      setStatus("Erreur de connexion : " + err.message);
    }
  }, []);

  // Fonction appelée en cas de déconnexion : tente une reconnexion automatique
  const reconnectDevice = async (device: BluetoothDevice) => {
    setStatus("Tentative de reconnexion…");

    // Si l'appareil n'est pas défini ou n'est pas connecté, on arrête
    try {
      if (device.gatt?.connected) {
        device.gatt.disconnect();
      }

      // Si l'appareil n'est pas connecté, on tente de se reconnecter
      const server = await device.gatt!.connect();
      setStatus("Reconnecté !");

      // Écoute les déconnexions pour tenter une reconnexion automatique
      for (const serviceKey of supportedServices) {
        // Pour chaque service, on essaye de le récupérer et de configurer les notifications
        // Si un service est trouvé, on arrête la recherche
        try {
          await server.getPrimaryService(serviceKey);
          await configureNotifications(
            serviceKey,
            device,
            server,
            (dev, srv, svc, measures) =>
              addOrUpdateCard(dev, srv, svc, measures),
            setStatus
          );
          setStatus(`En attente de mesures pour ${deviceType[serviceKey].deviceName}…`);
          return;
        } catch {}
      }

      setStatus("Aucun service compatible trouvé.");
    } catch {
      setTimeout(() => reconnectDevice(device), 5000);
    }
  };

  // Ref pour savoir si on doit envoyer le store après update
  // Utilisé pour éviter d'envoyer le store à chaque render
  // et ne l'envoyer que quand une nouvelle mesure est ajoutée ou mise à jour
  const shouldSendStoreRef = useRef(false);

  // Stocke ou met à jour une card, et envoie au docteur via WebRTC si dispo
  // Cette fonction est appelée par configureNotifications pour chaque service
  // et permet de mettre à jour le store Redux avec les mesures reçues
  const addOrUpdateCard = (
    device: BluetoothDevice,
    server: BluetoothRemoteGATTServer,
    service: string,
    measurements: { name: string; data: string | number }[]
  ) => {
    // On vérifie si l'appareil est déjà connecté
    // On structure les mesures pour correspondre à la structure attendue à envoyer au store
    const payload = {
      [deviceType[service].deviceName]: measurements.reduce((acc, m) => {
        acc[m.name] = m.data;
        return acc;
      }, {} as Record<string, string | number>),
    };

    console.log("[Bluetooth] Payload à envoyer :", payload);

    // On met à jour le store Redux avec les mesures
    // On utilise la fonction dispatch passée en props si elle existe
    dispatch?.(setMeasure(payload));

    // On indique qu'on veut envoyer le store à jour au prochain render
    // Cela permet de ne pas envoyer le store à chaque mesure reçue
    // mais seulement quand on a des mesures à envoyer
    if (peerConnection?.isDataChannelAvailable()) {
      shouldSendStoreRef.current = true;
    }
  };

  // Fonction pour dédupliquer les mesures
  // Elle parcourt toutes les mesures et supprime les doublons
  function deduplicateMeasures(allMeasures: AllMeasures): AllMeasures {
    const deduped: AllMeasures = {};
    // On parcourt chaque mesure par type d'appareil
    // et on filtre les doublons en utilisant un Set pour chaque type
    for (const deviceType in allMeasures) {
      const arr = allMeasures[deviceType];
      deduped[deviceType] = arr.filter(
        (measure, idx, self) =>
          self.findIndex(
            (m) =>
              Object.keys(measure).length === Object.keys(m).length &&
              Object.keys(measure).every((key) => m[key] === measure[key])
          ) === idx
      );
    }
    // On nettoie le store avant de le mettre à jour
    dispatch?.(clearMeasures()); // Nettoie le store avant de le mettre à jour
    // On met à jour le store avec les mesures dédupliquées
    dispatch?.(setMeasure(deduped)); // Met à jour le store avec les mesures dédupliquées
    return deduped;
  }

  // useEffect pour envoyer la mesure à jour quand le store change
  useEffect(() => {
    // Si on a des mesures à envoyer et que la connexion WebRTC est disponible
    // on envoie les mesures dédupliquées via le DataChannel
    if (
      shouldSendStoreRef.current &&
      peerConnection?.isDataChannelAvailable()
    ) {
      const manager = peerConnection.getDataChannelManager();
      const dedupedMeasures = deduplicateMeasures(allMeasuresStore ?? {});
      console.warn("[Bluetooth] Envoi des mesures allMeasuresStore :", allMeasuresStore);
      console.warn("[Bluetooth] Envoi des mesures dédupliquées :", dedupedMeasures);
      manager.sendMeasurement(dedupedMeasures);
      shouldSendStoreRef.current = false;
    }
  }, [allMeasuresStore, peerConnection]);

  // Retourne les infos de connexion + les cardes + la fonction de connexion
  return { status, connect };
}
