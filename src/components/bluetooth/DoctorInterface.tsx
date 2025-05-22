import { useEffect, useState } from 'react';
import RenderResults from './RenderResults';
import { peer } from '@/lib/peerInstance';

type DoctorServices = {
  [serviceName: string]: Array<object>;
};

export default function DoctorInterface() {
  const [doctorServices, setDoctorServices] = useState<DoctorServices>({});
  const [newData, setNewData] = useState<object | null>(null);

  // On écoute les messages WebRTC du type "measure"
  useEffect(() => {
    peer.onChatMessage((msg) => {
      if (msg.type === 'measure') {
        console.log('Mesure reçue via WebRTC :', msg.payload);
        setNewData(msg.payload);
      }
    });
  }, []);

  const checkIsDataReceivedServiceExist = (currentData: object, allServices: DoctorServices) => {
    const service: string = Object.entries(currentData)[0][0];
    const measures: object = Object.entries(currentData)[0][1];
    const tempResult: DoctorServices = { ...allServices };

    if (tempResult[service]) {
      tempResult[service].push(measures);
    } else {
      tempResult[service] = [measures];
    }

    setDoctorServices(tempResult);
  };

  useEffect(() => {
    if (newData) {
      checkIsDataReceivedServiceExist(newData, doctorServices);
      setNewData(null);
    }
  }, [newData, doctorServices]);

  return (
    <>
      {Object.entries(doctorServices).map(([serviceName, data]) => (
        <RenderResults serviceName={serviceName} data={data} />
      ))}
    </>
  );
}
