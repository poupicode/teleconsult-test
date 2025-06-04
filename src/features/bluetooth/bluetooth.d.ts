// Étend l'interface Navigator pour inclure la propriété "bluetooth"
interface Navigator {
  bluetooth: Bluetooth;
}

// Représente l'objet Bluetooth principal, exposé via navigator.bluetooth
interface Bluetooth {
  // Méthode pour demander à l'utilisateur de sélectionner un appareil Bluetooth
  requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;

  // Méthode expérimentale pour obtenir les appareils déjà autorisés
  getDevices?(): Promise<BluetoothDevice[]>;
}

// Options passées à requestDevice pour filtrer les appareils visibles
interface RequestDeviceOptions {
  filters?: BluetoothLEScanFilter[]; // Filtres pour trouver un appareil spécifique
  optionalServices?: BluetoothServiceUUID[]; // Services supplémentaires à exposer après connexion
  acceptAllDevices?: boolean; // Permet de se connecter à n'importe quel appareil (sans filtre)
}

// Représente un filtre pour le scan d’un appareil Bluetooth LE
interface BluetoothLEScanFilter {
  services?: BluetoothServiceUUID[]; // Filtrage par UUID de service
  name?: string;
  namePrefix?: string; // Préfixe du nom de l'appareil (utile pour filtrer dynamiquement)
}

// Représente un périphérique Bluetooth obtenu via requestDevice() ou getDevices()
interface BluetoothDevice extends EventTarget {
  id: string; // ID unique attribué par le navigateur
  name?: string; // Nom de l'appareil (si fourni par le périphérique)
  gatt?: BluetoothRemoteGATTServer; // Accès au serveur GATT de l'appareil
  uuids?: string[]; // Liste des UUID des services exposés
  watchingAdvertisements?: boolean; // Indique si on observe les publicités BLE
  watchingAdvertisementsTimeout?: number; // Délai avant arrêt automatique des publicités

  // Méthode pour "oublier" l'appareil (révoquer l'accès)
  forget(): Promise<void>;

  // Écouteur pour gérer la déconnexion automatique
  addEventListener(
    type: "gattserverdisconnected", // Événement déclenché lors de la perte de connexion
    listener: (this: BluetoothDevice, ev: Event) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
}

// Représente le serveur GATT auquel l'appareil expose ses services
interface BluetoothRemoteGATTServer {
  device: BluetoothDevice; // L'appareil auquel le serveur appartient
  connected: boolean; // Indique si on est connecté
  connect(): Promise<BluetoothRemoteGATTServer>; // Connexion au serveur GATT
  disconnect(): void; // Déconnexion propre du serveur
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>; // Accès à un service GATT
  getPrimaryServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>; // Accès à tous les services GATT
}

// Représente un service GATT (comme "blood_pressure", "battery", etc.)
interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>; // Accès à une caractéristique spécifique
}

// Représente une caractéristique GATT (ex. une mesure, une info de config, etc.)
interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  uuid: string; // UUID unique de la caractéristique
  value?: DataView; // Valeur actuelle lue ou notifiée

  // Active les notifications pour recevoir des mises à jour automatiques
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;

  // Arrête les notifications
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;

  // Écouteur pour les mises à jour de valeur (comme une mesure de capteur)
  addEventListener(
    type: "characteristicvaluechanged", // Événement déclenché quand une nouvelle valeur est reçue
    listener: (this: BluetoothRemoteGATTCharacteristic, ev: Event) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
}

// Type générique accepté pour identifier un service : UUID string ou entier
type BluetoothServiceUUID = number | string;

// Type générique accepté pour identifier une caractéristique : UUID string ou entier
type BluetoothCharacteristicUUID = number | string;
