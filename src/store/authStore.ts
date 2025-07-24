import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { ErrorHandler } from '@/lib/error-handler';

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,

  signIn: async (email: string, password: string) => {
    try {
      set({ loading: true });
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        throw error;
      }

      ErrorHandler.showSuccess('Login realizado com sucesso!', 'Bem-vindo de volta!');
    } catch (error) {
      ErrorHandler.showError(error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (email: string, password: string) => {
    try {
      set({ loading: true });
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) {
        throw error;
      }

      ErrorHandler.showSuccess('Conta criada com sucesso!', 'Bem-vindo ao OmniCRM!');
    } catch (error) {
      ErrorHandler.showError(error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    try {
      set({ loading: true });
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      set({ user: null });
      ErrorHandler.showSuccess('Logout realizado', 'Até logo!');
    } catch (error) {
      ErrorHandler.showError(error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  initialize: async () => {
    try {
      set({ loading: true });
      
      // Check for existing session first
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        throw error;
      }
      
      set({ user: session?.user ?? null, loading: false });

      // Set up auth state listener
      supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        set({ user: session?.user ?? null, loading: false });
      });
    } catch (error) {
      set({ loading: false });
      ErrorHandler.showError(error);
    }
  },
}));