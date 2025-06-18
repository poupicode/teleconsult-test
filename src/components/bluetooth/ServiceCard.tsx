import React, { useEffect, useState } from "react";
import { Card, Row, Button } from "react-bootstrap";
import MeasureCard from "./MeasureCard";

interface ServiceCardProps {
  service: string;
  measurements: {
    [key: string]: {
      deviceName: string;
      [key: string]: string;
    };
  };
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, measurements }) => {
  return (
    <Card className="p-2 pb-0 card bg-grey w-100 rounded-3">
      <Card.Body className="p-0">
        {/* Nom du service */}
        <h3 className="fs-6 fw-bold text-capitalize mb-0 mt-1">
          {service.replace("_", " ")}
        </h3>
        {/* Si il y a (côté patient), afficher le nom de l'appareil */}
        {measurements.deviceName && (
          <p className="color-red" style={{ fontSize: ".7em" }}>
            Appareil : {String(measurements.deviceName)}
          </p>
        )}

        {/* Quand il y a des mesures, pour chaque mesure de la donnée, faire une card mesure */}
        <div className="w-100 mt-3">
          {Object.keys(measurements).length > 0 ? (
            <MeasureCard measurements={measurements} />
          ) : (
            <p>Aucune mesure disponible</p>
          )}
        </div>

        {/* Bouton pour afficher l'historique */}
        <Button
          className="tertiary-btn w-100 mt-2"
          style={{ fontSize: ".8em" }}
          variant="link"
        >
          Afficher l'historique
        </Button>

        {/* Mettre ici les MesureCard des autres mesures */}
        {/* <div className="w-100 mt-2 bg-blue">
          <></>
        </div> */}
      </Card.Body>
    </Card>
  );
};

export default ServiceCard;
