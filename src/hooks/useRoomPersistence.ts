/**
 * Hook for managing room state persistence
 * Handles restoring room state after page reload and validating persisted rooms
 */
import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/app/store';
import { validatePersistedRoom } from '@/features/room/roomSlice';
import { RoomSupabase } from '@/features/room/roomSupabase';

export const useRoomPersistence = () => {
    const dispatch = useDispatch();
    const roomId = useSelector((state: RootState) => state.room.roomId);
    const [wasRoomRestored, setWasRoomRestored] = useState(false);
    const [restoredRoomId, setRestoredRoomId] = useState<string | null>(null);
    const hasInitialized = useRef(false);

    useEffect(() => {
        const validatePersistedRoomState = async () => {
            // Éviter de s'exécuter plusieurs fois
            if (hasInitialized.current) {
                return;
            }
            hasInitialized.current = true;

            if (!roomId) {
                return;
            }

            console.log('[RoomPersistence] Validating persisted room:', roomId);

            try {
                // Vérifier si la room existe toujours dans la base de données
                const room = await RoomSupabase.getRoom(roomId);
                const roomExists = room !== null;

                console.log(`[RoomPersistence] Room ${roomId} exists:`, roomExists);

                // Valider l'état persisté
                dispatch(validatePersistedRoom({ roomExists }));

                if (roomExists) {
                    console.log(`[RoomPersistence] Successfully restored room: ${room?.short_name} (${roomId})`);
                    // Marquer que la room a été restaurée
                    setWasRoomRestored(true);
                    setRestoredRoomId(roomId);
                }
            } catch (error) {
                console.error('[RoomPersistence] Error validating persisted room:', error);
                // En cas d'erreur, considérer que la room n'existe plus
                dispatch(validatePersistedRoom({ roomExists: false }));
            }
        };

        // Valider seulement au montage du composant (après reload)
        validatePersistedRoomState();
    }, []); // Dépendance vide pour s'exécuter seulement au montage

    return {
        hasPersistedRoom: Boolean(roomId),
        persistedRoomId: roomId,
        wasRoomRestored,
        restoredRoomId,
        // Fonction pour réinitialiser le flag de restauration
        clearRestorationFlag: () => {
            setWasRoomRestored(false);
            setRestoredRoomId(null);
        }
    };
};
