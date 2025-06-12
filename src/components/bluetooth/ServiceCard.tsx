import React, { useEffect } from "react";
import { Card, Row, Button } from "react-bootstrap";
import MeasureCard from "./MeasureCard";

interface ServiceCardProps {
  service: string;
  measurements: { name: string; data: string | number }[];
  deviceName?: string;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  measurements,
  deviceName,
}) => {
  // useEffect(()=>{
  //   console.log(`------------
  //     measurements
  //     --------------`, measurements)
  // }, [measurements])
  return (
    <Card className="p-2 pb-0 card bg-grey w-100 rounded-3">
      <Card.Body className="p-0">
        <h3 className="fs-6 fw-bold text-capitalize mb-0 mt-1">
          {service.replace("_", " ")}
        </h3>
        <p className="mb-3 color-red" style={{ fontSize: ".7em" }}>
          Appareil : {deviceName}
        </p>

        
        {measurements.length > 0 ? (
          <MeasureCard measurements={measurements} />
          
        ) : (
          <p>Aucune mesure disponible</p>
        )}
        <Button
          className="tertiary-btn w-100 mt-2"
          style={{ fontSize: ".8em" }}
          variant="link"
        >
          Afficher l'historique
        </Button>
      </Card.Body>
    </Card>
  );
};

export default ServiceCard;
