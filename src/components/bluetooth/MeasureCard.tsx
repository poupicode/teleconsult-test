import { Card, Row, Button } from "react-bootstrap";
import { useEffect, useState } from "react";

const MeasureCard = ({
  measurements,
}: {
  measurements: { [measures: string]: string };
}) => {
  return (
    // Card principale pour afficher les mesures
    <Card className="p-1 mt-2 mb-2 bg-white-pink card rounded-3">
      <Card.Body className="p-0">
        <Row className="w-100 m-0" style={{ minHeight: "5em" }}>
          {/* Colonne de gauche : Date de la mesure */}
          <div style={{ width: "28%" }} className="p-0 pe-2">
            <div className="card h-100 bg-white-pink w-100 rounded-2 d-flex align-items-center justify-content-center text-center">
              <small style={{ fontSize: ".75em", lineHeight: "1.2em" }}>
                {/* Séparation en 2 de la "Date de la mesure" */}
                {measurements["Date de la mesure"] ? (
                  <>
                    <span className="d-block">
                      {
                        measurements["Date de la mesure"]
                          .toString()
                          .split(" ")[0]
                      }
                    </span>
                    -
                    <span className="d-block">
                      {
                        measurements["Date de la mesure"]
                          .toString()
                          .split(" ")[1]
                      }
                    </span>
                  </>
                ) : (
                  <span className="d-block">-</span>
                )}
              </small>
            </div>
          </div>
          {/* Colonne de droite : Mesures */}
          <div style={{ width: "72%" }} className="p-0">
            <ul className="m-0">
              {/* Pour chaque mesure, or nom de l'appareil et date de la mesure */}
              {Object.entries(measurements).map(
                ([name, data], index) =>
                  name !== "Date de la mesure" &&
                  name !== "deviceName" && (
                    <li key={index}>
                      <small style={{ fontSize: ".8em" }}>
                        {name.replace(/\([^)]*\)/g, "")} :{" "}
                        <span className="color-red fw-semibold">
                          {String(data)}
                        </span>{" "}
                        <span className="color-lightblue">
                          {name
                            .match(/\(([^)]+)\)/g)
                            ?.toString()
                            .replace(/[()]/g, "")}
                        </span>
                      </small>
                    </li>
                  )
              )}
            </ul>
          </div>
        </Row>
      </Card.Body>
    </Card>
  );
};
export default MeasureCard;
