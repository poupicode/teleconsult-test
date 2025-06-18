/**import { useState } from "react";

interface RenderResultsProps {
  serviceName: string;
  data: Array<object>;
}

export default function RenderResults({
  serviceName,
  data,
}: RenderResultsProps) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div style={{ border: "1px solid black", margin: "10px", padding: "10px" }}>
      <h2 style={{ color: "blue" }}>{serviceName}</h2>
      <ul>
        {Object.values(data[data.length - 1]).map((charValues) => {
          return (
            <li key={charValues.toString()}>
              {charValues.name} : {charValues.data}
            </li>
          );
        })}
      </ul>
      <br />

      <div>
        <h3 style={{ color: "green", margin: 0 }}>Historique</h3>
        <button onClick={() => setShowHistory((prev) => !prev)}>
          {showHistory ? "Cacher" : "Afficher"}
        </button>
      </div>

      {showHistory && (
        <ul>
          {data.map((measure, index) => {
            return (
              <li key={index}>
                <ul
                  style={{
                    border: "1px solid black",
                    margin: "10px",
                    padding: "10px",
                  }}
                >
                  {Object.values(measure).map((charValues) => {
                    return (
                      <li key={charValues.toString()}>
                        {charValues.name} : {charValues.data}{" "}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
**/