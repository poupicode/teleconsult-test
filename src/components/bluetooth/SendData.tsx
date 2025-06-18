/**import { useRef } from "react";

// Type de la donnée envoyée par l'input
type SendDataValueProps = {
  onSendValue: (value: object) => void;
};



// Composant du bouton et de l'input
export default function SendButtonData({ onSendValue }: SendDataValueProps) {
  // Attribution d'une ref à l'input (comme un id) pour le manipuler ensuite
  const inputRef = useRef<HTMLInputElement>(null);

  // Fonction pour récupérer la valeur de l'input au click du bouton
  function handleGetValue() {

    // Stocker la valeur de l'input 
    const value = inputRef.current?.value ?? "";

    // Regarder si la valeur est nulle
    if (value != "" && inputRef.current) {
      // Si elle n'est pas nulle, convertir l'entrée en objet JSON
      try {
        const valueAsObject = JSON.parse(value); // Convertir en objet
        onSendValue(valueAsObject); // L'envoyer via une fonction callback définit en parent et assigner en props
        console.log("Valeur envoyée :", valueAsObject);
        // Vider l'input après l'envoi
        inputRef.current.value=''
      } catch (err) {
        console.error("La chaîne collée n'est pas un JSON valide !", err);
      }
    } else {
      console.error("Le champ est vide !");
    }
  }
  return (
    <>
      <input
        ref={inputRef}
        name="data-input"
        type="text"
        placeholder="Entrer la donnée"
      />
      <button onClick={handleGetValue}>Envoyer la donnée</button>
    </>
  );
}
**/