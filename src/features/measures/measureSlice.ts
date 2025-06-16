import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AllMeasures {
  [deviceType: string]: {
    [measures: string]: string;
  }[];
}

const initialState: AllMeasures = {};

const measureSlice = createSlice({
  name: "measure",
  initialState,
  reducers: {
    setMeasure(
      state,
      action: PayloadAction<
        | { [deviceType: string]: { [key: string]: string | number } }
        | { [deviceType: string]: { [key: string]: string }[] }
      >
    ) {
      // On vérifie si l'action payload est déjà dans la structure finale
      // C'est-à-dire un objet avec un deviceType comme clé et un tableau d'objets comme valeur
      const deviceType = Object.keys(action.payload)[0];
      const value = action.payload[deviceType];

      // Si c'est déjà un tableau d'objets (donc la structure finale)
      if (Array.isArray(value)) {
        // On remplace le tableau pour ce deviceType
        console.log("Structure finale détectée");
        return action.payload as AllMeasures;
      } else {
        // Sinon, on formate la valeur pour correspondre à la structure finale
        const rawMeasure = value as { [key: string]: string | number };
        const formattedMeasure: { [key: string]: string } = {};

        // On convertit chaque valeur en chaîne de caractères
        // pour s'assurer que toutes les mesures sont stockées en tant que chaînes
        for (const key in rawMeasure) {
          formattedMeasure[key] = String(rawMeasure[key]);
        }

        // On ajoute ou met à jour le tableau pour ce deviceType
        if (state[deviceType]) {
          // Si le deviceType existe déjà, on ajoute la nouvelle mesure
          state[deviceType].push(formattedMeasure);
        } else {
          // Si le deviceType n'existe pas, on crée un nouveau tableau avec la mesure
          state[deviceType] = [formattedMeasure];
        }
      }
    },
    // Action pour nettoyer les mesures, réinitialise l'état à l'initialState
    // Utilisé pour vider le store des mesures, par exemple lors de la déconnexion
    clearMeasures() {
      return initialState;
    },
  },
});

export const { setMeasure, clearMeasures } = measureSlice.actions;
export default measureSlice.reducer;
