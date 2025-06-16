import React, { useEffect, useState } from "react";
import { Card, Row, Button } from "react-bootstrap";
import MeasureCard from "./MeasureCard";

interface ServiceCardProps {
  service: string;
  measurements: { [measures: string]: string }[];
  showHistory: boolean;
  onToggleHistory: () => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  measurements,
  showHistory,
  onToggleHistory,
}) => {
  return (
    // Card principal pour le service
    <Card className="p-2 pb-0 card bg-grey w-100 rounded-3 mb-3">
      <Card.Body className="p-0">
        {/* Nom du service */}
        <h3 className="fs-6 fw-bold text-capitalize mb-0 mt-1">{service}</h3>

        {/* Quand il y a des mesures, pour chaque mesure de la donnée, faire une card mesure */}
        <div className="w-100 mt-4">
          {Object.keys(measurements).length > 0 ? (
            <MeasureCard measurements={measurements[measurements.length - 1]} />
          ) : (
            // Si aucune mesure, afficher un message
            <p>Aucune mesure disponible</p>
          )}
        </div>

        {/* Bouton pour afficher l'historique */}
        <Button
          className="tertiary-btn w-100 mt-2"
          style={{ fontSize: ".8em" }}
          variant="link"
          onClick={onToggleHistory}
          disabled={measurements.length <= 1}
        >
          Afficher l'historique
        </Button>

        {/* Mettre ici les MesureCard des autres mesures */}
        {showHistory && measurements.length - 1 > 0 && (
          <div className="w-100 mt-2">
            {[...measurements]
              .reverse() // on inverse l'ordre
              .map((measure, index) => (
                <MeasureCard key={index} measurements={measure} />
              ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default ServiceCard;
