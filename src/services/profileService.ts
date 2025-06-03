/**
 * Profile Service
 * 
 * This service handles fetching user profile data from the database.
 * It ensures the role is always retrieved from the authoritative source (profiles table).
 */
import { supabase } from '@/lib/supabaseClient';

export interface UserProfile {
  id: string;
  username: string;
  user_kind: 'patient' | 'practitioner';
  avatar_url?: string;
  website?: string;
}

export class ProfileService {
  /**
   * Fetches user profile from the profiles table
   * @param userId The user's ID
   * @returns User profile data or null if not found
   */
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, user_kind, avatar_url, website')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      return null;
    }
  }

  /**
   * Updates user profile in the profiles table
   * @param userId The user's ID
   * @param updates The fields to update
   * @returns Updated profile data or null if update failed
   */
  static async updateUserProfile(userId: string, updates: Partial<Omit<UserProfile, 'id'>>): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select('id, username, user_kind, avatar_url, website')
        .single();

      if (error) {
        console.error('Error updating user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in updateUserProfile:', error);
      return null;
    }
  }
}
