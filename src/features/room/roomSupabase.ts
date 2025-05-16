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
  static async createRoom(shortNameOverride?: string): Promise<Room | null> {
    try {
      // If a name is explicitly provided, use it
      if (shortNameOverride) {
        const { data, error } = await supabase.from('rooms').insert({ short_name: shortNameOverride }).select().single();
        if (error) throw error;
        return data;
      }

      // Otherwise, generate a random name with an adjective and a noun

      // 1. Get all adjectives
      const { data: adjectivesData, error: adjectivesError } = await supabase
        .from('adjectives')
        .select('adjectives');

      if (adjectivesError || !adjectivesData || adjectivesData.length === 0) {
        console.error('Error fetching adjectives:', adjectivesError);
        throw adjectivesError || new Error('No adjectives found');
      }

      // 2. Get all nouns
      const { data: namesData, error: namesError } = await supabase
        .from('names')
        .select('names');

      if (namesError || !namesData || namesData.length === 0) {
        console.error('Error fetching names:', namesError);
        throw namesError || new Error('No names found');
      }

      // 3. Choose a random adjective and noun
      const randomAdjectiveIndex = Math.floor(Math.random() * adjectivesData.length);
      const randomNameIndex = Math.floor(Math.random() * namesData.length);

      const adjective = adjectivesData[randomAdjectiveIndex].adjectives;
      const name = namesData[randomNameIndex].names;

      // 4. Combine the two to create the short_name
      const short_name = `${adjective} ${name}`;

      console.log(`Generating room with name: ${short_name}`);

      // 5. Create the room with the generated name
      const { data, error } = await supabase.from('rooms').insert({ short_name }).select().single();

      if (error) {
        console.error('Error creating room:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in createRoom:', error);

      // Fallback: if random generation failed, use a default name
      try {
        const fallbackName = `Room-${Date.now()}`;
        const { data, error: fallbackError } = await supabase
          .from('rooms')
          .insert({ short_name: fallbackName })
          .select()
          .single();

        if (fallbackError) throw fallbackError;
        return data;
      } catch (fallbackError) {
        console.error('Error creating room with fallback name:', fallbackError);
        return null;
      }
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