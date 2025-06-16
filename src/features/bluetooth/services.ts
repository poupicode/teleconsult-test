// services.ts
import deviceType, { type DeviceType } from "./config";

type receivedMeasureTraitmentFn = (
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
  receivedMeasureTraitment: receivedMeasureTraitmentFn,
  setStatus: SetStatusFn
) {
  const service = await server.getPrimaryService(serviceKey);
  const charsConfig = deviceType[serviceKey].characteristics;

  let lastMeasure: { name: string; data: string | number }[] = [];
  let debounceTimer: NodeJS.Timeout | null = null;

  // Pour chaque characteristic déclarée dans config.ts
  for (const [charKey, cfg] of Object.entries(charsConfig)) {
    const characteristic = await service.getCharacteristic(charKey);
    await characteristic.startNotifications();

    characteristic.addEventListener("characteristicvaluechanged", (event) => {
      const val = (event.target as BluetoothRemoteGATTCharacteristic).value!; //BluetoothRemoteGATTCharacteristic représente une “caractéristique” GATT distante (un point de lecture/écriture ou de notification) sur le périphérique Bluetooth.
      const flags = val.getUint8(0);
      const results: { name: string; data: string | number }[] = [];

      // Champs fixes (SFLOAT à offset défini)
      for (const [, def] of Object.entries(cfg)) {
        if (def && typeof def === "object" && "value" in def) {
          const raw = cfg.decoder(val, def.value);
          results.push({ name: def.name, data: raw.toFixed(1) });
        }
      }

      // Calcul du curseur juste après le plus grand offset fixe
      const fixedOffsets = Object.values(cfg)
        .filter((d: any) => d && typeof d === "object" && "value" in d)
        .map((d: any) => d.value + 2);
      let cursor = fixedOffsets.length ? Math.max(...fixedOffsets) : 1;

      // Champs conditionnels (flags + offset)
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

      //Champs personnalisés avec leur propre decoder
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

      lastMeasure = results;

      if (debounceTimer) clearTimeout(debounceTimer);

      debounceTimer = setTimeout(() => {
        console.log("✅ Dernière mesure reçue, on l’envoie :", lastMeasure);
        receivedMeasureTraitment(device, server, serviceKey, lastMeasure);
        setStatus(
          `Dernière mesure reçue pour ${serviceKey} à ${new Date().toLocaleString()}`
        );
        lastMeasure = [];
      }, 500); // ← tu peux ajuster ce délai si besoin

      // Mise à jour de l’UI
      // receivedMeasureTraitment(device, server, serviceKey, results);
      // setStatus(
      //   `Mesures reçues pour ${serviceKey} à ${new Date().toLocaleString()}`
      // );
    });
  }

  setStatus(`En attente des mesures sur ${serviceKey}…`);
}
