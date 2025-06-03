/**
 * Hook for managing room state persistence with quick return detection
 * Handles restoring room state after page reload and validating persisted rooms
 * Only restores rooms when users return quickly after page reload
 */
import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/app/store';
import { validatePersistedRoom, clearQuickReturnFlag } from '@/features/room/roomSlice';
import { RoomSupabase } from '@/features/room/roomSupabase';

export const useRoomPersistence = () => {
    const dispatch = useDispatch();
    const roomId = useSelector((state: RootState) => state.room.roomId);
    const [wasRoomRestored, setWasRoomRestored] = useState(false);
    const [restoredRoomId, setRestoredRoomId] = useState<string | null>(null);
    const [isQuickReturn, setIsQuickReturn] = useState(false);
    const hasInitialized = useRef(false);

    useEffect(() => {
        const validatePersistedRoomState = async () => {
            console.log('[RoomPersistence] useEffect called, hasInitialized:', hasInitialized.current, 'roomId:', roomId);
            
            // Éviter de s'exécuter plusieurs fois
            if (hasInitialized.current) {
                console.log('[RoomPersistence] Already initialized, skipping');
                return;
            }
            hasInitialized.current = true;

            if (!roomId) {
                console.log('[RoomPersistence] No roomId found, skipping validation');
                return;
            }

            console.log('[RoomPersistence] Starting validation for room:', roomId);

            try {
                console.log('[RoomPersistence] Fetching room from database...');
                // Vérifier si la room existe toujours dans la base de données
                const room = await RoomSupabase.getRoom(roomId);
                const roomExists = room !== null;

                console.log(`[RoomPersistence] Room ${roomId} exists:`, roomExists, 'room data:', room);

                // Valider l'état persisté
                dispatch(validatePersistedRoom({ roomExists }));

                if (roomExists) {
                    console.log(`[RoomPersistence] Successfully restored room: ${room?.short_name} (${roomId})`);
                    // Marquer que la room a été restaurée
                    setWasRoomRestored(true);
                    setRestoredRoomId(roomId);
                } else {
                    console.log('[RoomPersistence] Room does not exist, state will be cleared');
                }
            } catch (error) {
                console.error('[RoomPersistence] Error validating persisted room:', error);
                // En cas d'erreur, considérer que la room n'existe plus
                dispatch(validatePersistedRoom({ roomExists: false }));
            }
        };

        // Petite temporisation pour s'assurer que le Redux store est complètement initialisé
        const timeoutId = setTimeout(() => {
            console.log('[RoomPersistence] Delayed validation triggered');
            validatePersistedRoomState();
        }, 100);

        return () => {
            clearTimeout(timeoutId);
        };
    }, []); // Dépendance vide pour s'exécuter seulement au montage

    return {
        hasPersistedRoom: Boolean(roomId),
        persistedRoomId: roomId,
        wasRoomRestored,
        restoredRoomId,
        isQuickReturn, // New: indicates if this was a quick return restoration
        // Fonction pour réinitialiser le flag de restauration
        clearRestorationFlag: () => {
            setWasRoomRestored(false);
            setRestoredRoomId(null);
            setIsQuickReturn(false);
        }
    };
};
