import { useState, useEffect } from "react";
import RenderResults from "./RenderResults";
import SendButtonData from "./SendData";

type DoctorServices = {
  [serviceName: string]: Array<object>;
};

export default function DoctorInterface() {
  const [doctorServices, setDoctorServices] = useState<DoctorServices>({});
  const [newData, setNewData] = useState<object | null>(null);

  // Récupération de la donnée de l'input
  const getValueFromInput = (rawDataReceived: object) => {
    // Mettre dans newData la donnée reçue par l'input
    setNewData(rawDataReceived);
  };

  //   Fonction pour comparer si le service de currentData (rawDataReceived) existe dans l'ensemble allServices (doctorServices)
  function checkIsDataReceivedServiceExist(
    currentData: object,
    allServices: DoctorServices
  ) {
    // Stocker le service de la donnée reçue
    const service: string = Object.entries(currentData)[0][0];
    // Stocker les mesures de la donnée reçue
    const measures: object = Object.entries(currentData)[0][1];

    const tempResult: DoctorServices = allServices;

    // Regarder si pour chaque clé dans doctorServices, le service de currentData y correspond
    // Si oui, ajouter à la fin au service les mesures
    // Sinon, créer le service dans tous les services et y ajouter à la fin les mesures
    if (tempResult[service]) {
      tempResult[service].push(measures);
    } else {
      tempResult[service] = [measures];
    }
    // Mettre à jour le state doctorServices
    setDoctorServices(tempResult);
  }

  // Au changement de newData, appeler checkIsDataReceivedServiceExist
  useEffect(() => {
    if (newData) {
      checkIsDataReceivedServiceExist(newData, doctorServices);
      setNewData(null);
    }
    console.log("doctorServices mis à jour :", doctorServices);
  }, [newData, doctorServices]);


  return (
    <>
      <SendButtonData onSendValue={getValueFromInput} />



      {
        Object.entries(doctorServices).map(([serviceName, data]) => {
          return (
            <RenderResults
              // key={serviceName}
              serviceName={serviceName}
              data={data}
            />
          );
        })
      }

    </>
  );
}