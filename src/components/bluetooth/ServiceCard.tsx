// components/ServiceCard.tsx
import React from 'react';

interface ServiceCardProps {
  service: string;
  measurements: { name: string; data: string | number }[];
  deviceName: string;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, measurements, deviceName }) => {
  return (
    <div className="border rounded-lg p-4 w-full max-w-md shadow-md">
      <h3 className="text-lg font-semibold capitalize mb-2">{service.replace('_', ' ')}</h3>
      <p className="text-sm text-gray-600 mb-2">Appareil : {deviceName}</p>
      <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
        {measurements.length > 0 ? (
          measurements.map((item, index) => (
            <li key={index}>
              <strong>{item.name}</strong> : {item.data}
            </li>
          ))
        ) : (
          <li>Aucune mesure disponible</li>
        )}
      </ul>
    </div>
  );
};

export default ServiceCard;