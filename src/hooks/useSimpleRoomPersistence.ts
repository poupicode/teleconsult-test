/**
 * Hook simplifié pour la persistance des salles
 * Gère la restauration rapide sans complexité excessive
 */
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { roomIdUpdated } from '@/features/room/roomSlice';
import { RoomSupabase } from '@/features/room/roomSupabase';

interface PersistedRoomData {
  roomId: string;
  timestamp: number;
}

export const useSimpleRoomPersistence = () => {
  const dispatch = useDispatch();
  const [restorationInfo, setRestorationInfo] = useState<{
    wasRestored: boolean;
    roomId: string | null;
    isQuickReturn: boolean;
  }>({
    wasRestored: false,
    roomId: null,
    isQuickReturn: false
  });

  useEffect(() => {
    const handleRoomRestoration = async () => {
      try {
        const persistedData = localStorage.getItem('quickRoomPersist');
        if (!persistedData) {
          console.log('[SimpleRoomPersistence] No persisted room data found');
          return;
        }

        const data: PersistedRoomData = JSON.parse(persistedData);
        const now = Date.now();
        const timeDiff = now - data.timestamp;
        
        // Fenêtre de retour rapide : 30 secondes
        const QUICK_RETURN_WINDOW = 30 * 1000;
        // Timeout maximum : 5 minutes
        const MAX_PERSISTENCE_TIME = 5 * 60 * 1000;

        console.log(`[SimpleRoomPersistence] Found persisted room ${data.roomId}, time difference: ${timeDiff}ms`);

        // Si trop vieux, on nettoie
        if (timeDiff > MAX_PERSISTENCE_TIME) {
          console.log('[SimpleRoomPersistence] Persisted data too old, clearing');
          localStorage.removeItem('quickRoomPersist');
          return;
        }

        // Si pas dans la fenêtre de retour rapide, on ne restaure pas
        if (timeDiff > QUICK_RETURN_WINDOW) {
          console.log('[SimpleRoomPersistence] Not a quick return, clearing data');
          localStorage.removeItem('quickRoomPersist');
          return;
        }

        // Vérifier que la room existe toujours
        console.log('[SimpleRoomPersistence] Verifying room exists in database...');
        const room = await RoomSupabase.getRoom(data.roomId);
        
        if (!room) {
          console.log('[SimpleRoomPersistence] Room no longer exists, clearing data');
          localStorage.removeItem('quickRoomPersist');
          return;
        }

        // Restaurer la room
        console.log(`[SimpleRoomPersistence] Quick return detected! Restoring room: ${room.short_name}`);
        dispatch(roomIdUpdated(data.roomId));
        
        setRestorationInfo({
          wasRestored: true,
          roomId: data.roomId,
          isQuickReturn: true
        });

        // Nettoyer après restauration
        localStorage.removeItem('quickRoomPersist');

      } catch (error) {
        console.error('[SimpleRoomPersistence] Error during restoration:', error);
        localStorage.removeItem('quickRoomPersist');
      }
    };

    // Exécuter seulement au montage
    handleRoomRestoration();
  }, [dispatch]);

  // Fonction pour sauvegarder une room pour retour rapide
  const saveForQuickReturn = (roomId: string) => {
    try {
      const data: PersistedRoomData = {
        roomId,
        timestamp: Date.now()
      };
      localStorage.setItem('quickRoomPersist', JSON.stringify(data));
      console.log(`[SimpleRoomPersistence] Saved room ${roomId} for quick return`);
    } catch (error) {
      console.warn('[SimpleRoomPersistence] Failed to save for quick return:', error);
    }
  };

  // Fonction pour nettoyer les données de persistance
  const clearPersistence = () => {
    localStorage.removeItem('quickRoomPersist');
    setRestorationInfo({
      wasRestored: false,
      roomId: null,
      isQuickReturn: false
    });
  };

  return {
    wasRoomRestored: restorationInfo.wasRestored,
    restoredRoomId: restorationInfo.roomId,
    isQuickReturn: restorationInfo.isQuickReturn,
    saveForQuickReturn,
    clearPersistence,
    clearRestorationFlag: () => {
      setRestorationInfo(prev => ({
        ...prev,
        wasRestored: false
      }));
    }
  };
};
