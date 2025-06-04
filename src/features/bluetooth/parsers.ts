export const readSfloat16 = (dataView: DataView, offset: number): number => {
  const raw = dataView.getUint16(offset, true); // lecture sur 2 octets (little endian)
  let mantissa = raw & 0x0FFF;
  let exponent = raw >> 12;

  if (mantissa >= 0x0800) mantissa -= 0x1000;
  if (exponent >= 0x0008) exponent -= 0x10;

  return mantissa * Math.pow(10, exponent);
};


export function readIEEE11073Float(dataView: DataView, offset: number): number {
  const raw = dataView.getUint32(offset, true); // lecture en little-endian

  let mantissa = raw & 0x00FFFFFF; // bits 0 à 23
  let exponent = raw >> 24;          // bits 24 à 31

  // Convertit mantissa en signé
  if (mantissa >= 0x800000) {
    mantissa -= 0x1000000;
  }

  // Convertit exponent en signé
  if (exponent >= 0x80) {
    exponent -= 0x100;
  }

  return mantissa * Math.pow(10, exponent);
}


export function readDateTime(dataView: DataView, offset: number): Date {
  const year = dataView.getUint16(offset, true); // 2 octets, little endian
  const month = dataView.getUint8(offset + 2) - 1; // mois: 1-12 => JS: 0-11
  const day = dataView.getUint8(offset + 3);
  const hour = dataView.getUint8(offset + 4);
  const minute = dataView.getUint8(offset + 5);
  const second = dataView.getUint8(offset + 6);

  return new Date(year, month, day, hour, minute, second);
}
