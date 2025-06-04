/**
 * Hook for handling beforeunload events to track user departure
 * Records departure timestamp for quick return detection
 */
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/app/store';
import { recordDeparture } from '@/features/room/roomSlice';

export const useBeforeUnload = () => {
    const dispatch = useDispatch();
    const roomId = useSelector((state: RootState) => state.room.roomId);

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            // Only record departure if user is in a room
            if (roomId) {
                console.log('[BeforeUnload] Recording departure timestamp for room:', roomId);
                dispatch(recordDeparture());
            }
        };

        // Add event listener for page unload
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Also handle visibility change (tab switching, minimizing, etc.)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && roomId) {
                console.log('[VisibilityChange] Recording departure timestamp for room:', roomId);
                dispatch(recordDeparture());
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Cleanup
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [dispatch, roomId]);
};
