import { Card, Row, Button } from "react-bootstrap";

const MeasureCard = ({
  measurements,
}: {
  measurements: { name: string; data: string | number }[];
}) => {
  return (
    <Card className="p-1 mb-1 bg-white-pink card rounded-3">
      <Card.Body className="p-0">
        <Row className="w-100 m-0" style={{ minHeight: "5em" }}>
          <div style={{ width: "28%" }} className="p-0 pe-2">
            <div className="card h-100 bg-white-pink w-100 rounded-2 d-flex align-items-center justify-content-center text-center">
              <small style={{ fontSize: ".75em", lineHeight: "1.2em" }}>
                <span className="d-block">
                  {
                    measurements
                      .find((m) => m.name === "Date de la mesure")
                      ?.data.toString()
                      .split(" ")[0]
                  }
                </span>
                -
                <span className="d-block">
                  {
                    measurements
                      .find((m) => m.name === "Date de la mesure")
                      ?.data.toString()
                      .split(" ")[1]
                  }
                </span>
              </small>
            </div>
          </div>
          <div style={{ width: "72%" }} className="p-0">
            <ul className="m-0">
              {measurements.map(
                (item, index) =>
                  item.name !== "Date de la mesure" && (
                    <li key={index}>
                      <small style={{ fontSize: ".8em" }}>
                        {item.name.replace(/\([^)]*\)/g, "")} :{" "}
                        <span className="color-red fw-semibold">
                          {item.data}
                        </span>{" "}
                        <span className="color-lightblue">
                          {item.name
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
