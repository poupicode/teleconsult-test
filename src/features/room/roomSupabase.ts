  /**
   * Room Supabase Service
   * 
   * This file defines the service layer for interacting with Supabase
   * to manage consultation rooms. It handles room creation, retrieval,
   * and real-time subscriptions.
   */
  import { supabase } from '@/lib/supabaseClient';
  import { Role } from './rtc/peer';

  // Define the interface to reflect the database structure
  export interface Room {
    id: string;
    short_name: string;
  }

  export class RoomSupabase {
    /**
     * Creates a new room with either a provided name or a randomly generated one
     * @param shortNameOverride Optional name to use instead of generated name
     * @returns The created room or null if creation failed
     */

    static async getAllRooms(): Promise<Room[] | null> {
  try {
    const { data, error } = await supabase.from("rooms").select("*");
    if (error) {
      console.error("Erreur lors de la récupération des rooms :", error);
      return null;
    }
    return data as Room[];
  } catch (error) {
    console.error("Erreur inconnue lors de getAllRooms :", error);
    return null;
  }
}

static async deleteRoom(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) {
      console.error("Erreur lors de la suppression de la room :", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Erreur inconnue lors de la suppression :", error);
    return false;
  }
}

  static async createRoom(shortName: string): Promise<Room | null> {
    if (!shortName || shortName.trim() === '') {
      console.error('Le nom de la room est requis.');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('rooms')
        .insert({ short_name: shortName })
        .select()
        .single();

      if (error) {
        console.error('Erreur lors de la création de la room :', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Erreur inconnue lors de la création de la room :', error);
      return null;
    }
  }



    /**
     * Retrieves all rooms from the database
     */
    static async getRooms() {
      return supabase.from('rooms').select('*');
    }

    /**
     * Deletes all rooms except the default one
     */
    static async deleteAllRooms() {
      return supabase.from('rooms').delete().neq('id', "2f36f4b6-aefb-11ed-afa1-0242ac120002");
    }

    /**
     * Gets a specific room by its ID
     * @param roomId The ID of the room to retrieve
     * @returns The room data or null if not found
     */
    static async getRoom(roomId: string): Promise<Room | null> {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error || !data) {
        console.error('Error getting room:', error);
        return null;
      }

      return data;
    }

    /**
     * Sets up a real-time subscription to room changes
     * @param callback Function to call when room data changes
     * @returns The subscription object
     */
    static subscribeToRooms(callback: (payload: any) => void) {
      return supabase
        .channel('rooms-changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'rooms' },
          callback)
        .subscribe();
    }

    /**
     * Creates the signaling table if it doesn't exist
     * Note: This would typically be done via Supabase migrations
     */
    static async createSignalingTable() {
      const { error } = await supabase.rpc('create_signaling_table_if_not_exists');
      if (error) {
        console.error('Error creating signaling table:', error);
      }
    }
  }