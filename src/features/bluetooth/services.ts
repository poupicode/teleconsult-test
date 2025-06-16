// services.ts
import deviceType, { type DeviceType } from "./config";

type addOrUpdateCardFn = (
  device: BluetoothDevice,
  server: BluetoothRemoteGATTServer,
  service: string,
  results: { name: string; data: string | number }[]
) => void;

type SetStatusFn = (text: string) => void;

// Configure les notifications pour un service donné (blood_pressure, health_thermometer, etc.)
export async function configureNotifications(
  serviceKey: Extract<keyof DeviceType, string>,
  device: BluetoothDevice,
  server: BluetoothRemoteGATTServer,
  addOrUpdateCard: addOrUpdateCardFn,
  setStatus: SetStatusFn
) {
  // Vérifie si le service est supporté
  const service = await server.getPrimaryService(serviceKey);
  // Récupère la configuration des caractéristiques pour ce service
  const charsConfig = deviceType[serviceKey].characteristics;

  // Stocker la dernière mesure reçue pour éviter d'écraser la dernière mesure envoyée de l'historique de l'appareil
  // et pour éviter de faire trop de requêtes à l'API
  let lastMeasure: { name: string; data: string | number }[] = [];
  // Timer pour regarder si la dernière mesure a été reçue (timer d'inactivité)
  // et pour éviter de faire trop de requêtes à l'API
  let debounceTimer: NodeJS.Timeout | null = null;

  // Pour chaque characteristic déclarée dans config.ts
  for (const [charKey, cfg] of Object.entries(charsConfig)) {
    // Vérifie si la caractéristique est supportée
    const characteristic = await service.getCharacteristic(charKey);
    await characteristic.startNotifications();

    // Configure la notification pour cette caractéristique
    // On utilise un listener pour recevoir les notifications
    characteristic.addEventListener("characteristicvaluechanged", (event) => {
      const val = (event.target as BluetoothRemoteGATTCharacteristic).value!; //BluetoothRemoteGATTCharacteristic représente une “caractéristique” GATT distante (un point de lecture/écriture ou de notification) sur le périphérique Bluetooth.
      // Vérifie si la valeur est valide
      const flags = val.getUint8(0);
      // Vérifie si le premier octet contient des flags
      const results: { name: string; data: string | number }[] = [];

      // Champs fixes (SFLOAT à offset défini)
      // On parcourt les définitions de champs fixes dans la configuration
      // et on les décode en fonction de leur offset et de leur valeur
      for (const [, def] of Object.entries(cfg)) {
        if (def && typeof def === "object" && "value" in def) {
          const raw = cfg.decoder(val, def.value);
          results.push({ name: def.name, data: raw.toFixed(1) });
        }
      }

      // Calcul du curseur juste après le plus grand offset fixe
      // On récupère les offsets fixes pour les champs qui ont une valeur définie
      // et on calcule le curseur à partir du plus grand offset fixe
      const fixedOffsets = Object.values(cfg)
        .filter((d: any) => d && typeof d === "object" && "value" in d)
        .map((d: any) => d.value + 2);
      let cursor = fixedOffsets.length ? Math.max(...fixedOffsets) : 1;

      // Champs conditionnels (flags + offset)
      // On parcourt les définitions de champs conditionnels dans la configuration
      // et on les décode en fonction de leur flag et de leur offset
      for (const [, def] of Object.entries(cfg)) {
        if (
          def &&
          typeof def === "object" &&
          "data" in def &&
          typeof def.data === "number"
        ) {
          if ((flags & def.data) !== 0) {
            const off = (def as any).offset ?? cursor;
            const raw = (cfg.decoder as any)(val, off);
            results.push({ name: def.name, data: raw.toFixed(1) });
            cursor = off + 2;
          }
        }
      }

      // Champs personnalisés avec leur propre decoder
      // On parcourt les définitions de champs personnalisés dans la configuration
      // et on les décode en fonction de leur offset et de leur fonction de décodage
      // Ici, on suppose que le champ personnalisé est un champ de date
      for (const [, def] of Object.entries(cfg)) {
        if (
          def &&
          typeof def === "object" &&
          "decoder" in def &&
          typeof def.decoder === "function"
        ) {
          const off = def.offset ?? cursor;
          const raw = def.decoder(val, off);
          const data = raw instanceof Date ? raw.toLocaleString() : raw;
          results.push({ name: def.name, data });
          cursor = off + 7; // date format Bluetooth = 7 octets
        }
      }

      // Si on a déjà une dernière mesure, on la fusionne avec les nouvelles mesures
      lastMeasure = results;

      // Si on a un timer de debounce en cours, on le réinitialise
      // pour éviter d'envoyer trop de requêtes à l'API
      if (debounceTimer) clearTimeout(debounceTimer);

      // On démarre un nouveau timer de debounce
      // pour envoyer la dernière mesure après un délai d'inactivité
      debounceTimer = setTimeout(() => {
        console.log("✅ Dernière mesure reçue, on l’envoie :", lastMeasure);

        // On ajoute ou met à jour la carte avec la dernière mesure reçue
        // et on envoie le statut au parent
        addOrUpdateCard(device, server, serviceKey, lastMeasure);
        setStatus(
          `Dernière mesure reçue pour ${deviceType[serviceKey].deviceName} à ${new Date().toLocaleString()}`
        );

        // On réinitialise le timer de debounce et la dernière mesure
        // pour éviter d'envoyer la même mesure plusieurs fois
        if (debounceTimer) clearTimeout(debounceTimer);
        lastMeasure = [];
      }, 1000); // Délai de 1 seconde pour éviter les requêtes trop fréquentes

    });
  }

  // Une fois les notifications configurées, on envoie un message de statut
  // pour indiquer que l'on attend les mesures
  setStatus(`En attente des mesures sur ${deviceType[serviceKey].deviceName}…`);
}
