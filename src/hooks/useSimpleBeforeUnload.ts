/**
 * Hook simplifié pour enregistrer les départs de page
 */
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';

export const useSimpleBeforeUnload = (saveForQuickReturn: (roomId: string) => void) => {
  const roomId = useSelector((state: RootState) => state.room.roomId);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (roomId) {
        console.log('[SimpleBeforeUnload] Saving room for quick return:', roomId);
        saveForQuickReturn(roomId);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && roomId) {
        console.log('[SimpleBeforeUnload] Page hidden, saving room for quick return:', roomId);
        saveForQuickReturn(roomId);
      }
    };

    // Ajouter les event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Nettoyage
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [roomId, saveForQuickReturn]);
};
