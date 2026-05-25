import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/utils/safeToast';
import { initializeAuth, clearAuthTokens, safeAuthOperation } from '@/utils/authHelpers';
import { logError, getUserFriendlyErrorMessage, isErrorType } from '@/utils/errorLogger';
import { parseErrorMessage } from '@/utils/errorHelpers';

// Type definitions for user roles and statuses
export type UserRole = 'admin' | 'accountant' | 'stock_manager' | 'user';
export type UserStatus = 'active' | 'inactive' | 'pending';

// Helper function to safely format error for display
const formatErrorForDisplay = (error: unknown): string => {
  if (!error) return 'Unknown error occurred';

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object') {
    const errorObj = error as any;
    if (errorObj.message && typeof errorObj.message === 'string') {
      return errorObj.message;
    }
    if (errorObj.error_description && typeof errorObj.error_description === 'string') {
      return errorObj.error_description;
    }
    if (errorObj.details && typeof errorObj.details === 'string') {
      return errorObj.details;
    }
  }

  return 'An unexpected error occurred';
};

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  company_id?: string;
  department?: string;
  position?: string;
  role?: UserRole;
  status?: UserStatus;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  changeUserPassword: (userId: string, newPassword: string) => Promise<{ error: Error | null }>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  clearTokens: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useIsSalesAccount = () => {
  const { profile, loading } = useAuth();
  const isSalesAccount =
    profile?.email?.toLowerCase().trim() === 'sales@layonsconstruction.com' &&
    profile?.role === 'user';
  return { isSalesAccount, isLoading: loading };
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Use refs to prevent stale closures and unnecessary re-renders
  const mountedRef = useRef(true);
  const initializingRef = useRef(false);
  const forceCompletedRef = useRef(false);

  // Toast spam prevention
  const lastNetworkErrorToast = useRef<number>(0);
  const lastPermissionErrorToast = useRef<number>(0);
  const lastGeneralErrorToast = useRef<number>(0);
  const TOAST_COOLDOWN = 10000; // 10 seconds between similar error toasts

  // Fetch user profile from database with error handling and retry logic
  const fetchProfile = useCallback(async (userId: string, showErrorToast: boolean = false): Promise<UserProfile | null> => {
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, avatar_url, phone, company_id, department, position, role, status, last_login, created_at, updated_at')
          .eq('id', userId)
          .maybeSingle(); // Use maybeSingle to handle 0 results gracefully

        if (error) {
          throw error;
        }

        if (!profileData) {
          console.warn(`No profile data found for user ${userId} - this is expected if profile hasn't been created yet`);
          return null;
        }

        if (profileData.email) {
          profileData.email = profileData.email.toLowerCase();
        }
        return profileData;
      } catch (fetchError) {
        lastError = fetchError;

        // Check if it's a network error
        const errorMsg = (fetchError instanceof Error) ? fetchError.message : String(fetchError);
        const isNetworkError = errorMsg.includes('Failed to fetch') ||
                              errorMsg.includes('Network') ||
                              errorMsg.includes('timeout') ||
                              errorMsg.includes('ECONNREFUSED') ||
                              errorMsg.includes('ENOTFOUND') ||
                              errorMsg.includes('NetworkError') ||
                              errorMsg.includes('CORS') ||
                              errorMsg.includes('fetch');

        if (isNetworkError && attempt < maxRetries - 1) {
          // Wait before retrying (exponential backoff: 500ms, 1s, 2s)
          const delayMs = 500 * Math.pow(2, attempt);
          console.warn(`Profile fetch network error (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delayMs}ms... Error: ${errorMsg}`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        // Format error message properly to avoid [object Object]
        let errorMessage = 'Unknown error';
        let errorDetails = '';
        if (fetchError instanceof Error) {
          errorMessage = fetchError.message;
          errorDetails = fetchError.stack ? ` Stack: ${fetchError.stack.substring(0, 100)}` : '';
        } else if (typeof fetchError === 'string') {
          errorMessage = fetchError;
        } else if (fetchError && typeof fetchError === 'object') {
          const errObj = fetchError as any;
          errorMessage = errObj.message || errObj.error_description || errObj.details || String(fetchError);
          errorDetails = errObj.hint ? ` Hint: ${errObj.hint}` : '';
        }

        // Log comprehensive error info for debugging (but suppress from user by default)
        console.warn(`Profile fetch error for user ${userId}: ${errorMessage}${errorDetails} (attempt ${attempt + 1}/${maxRetries}). App will continue without full profile.`);

        // Handle specific error types using the error type checker
        if (isErrorType(fetchError, 'auth')) {
          console.warn('Profile fetch failed due to expired token - user may need to re-authenticate');
          return null; // Don't show error toast for auth issues
        }

        if (isErrorType(fetchError, 'network')) {
          console.warn('Profile fetch failed due to network issue - app will continue without full profile');
          // Don't show toast for network errors on profile fetch - it's not critical
          // The app can work with just the auth user info
          return null;
        }

        if (isErrorType(fetchError, 'permission')) {
          console.warn('Profile fetch failed due to permissions');

          // Only show permission error if explicitly requested
          if (showErrorToast) {
            const now = Date.now();
            if (now - lastPermissionErrorToast.current > TOAST_COOLDOWN) {
              lastPermissionErrorToast.current = now;
              setTimeout(() => toast.error(
                'Permission error accessing profile. Please sign in again.',
                { duration: 4000 }
              ), 0);
            }
          }
          return null;
        }

        // Only show general error if explicitly requested (profile fetch is non-critical for app operation)
        if (showErrorToast) {
          const friendlyMessage = getUserFriendlyErrorMessage(fetchError);
          const now = Date.now();
          if (now - lastGeneralErrorToast.current > TOAST_COOLDOWN) {
            lastGeneralErrorToast.current = now;
            setTimeout(() => toast.error(
              `Failed to load user profile: ${friendlyMessage}`,
              { duration: 4000 }
            ), 0);
          }
        }

        return null;
      }
    }

    return null;
  }, []);

  // Update last login timestamp silently
  const updateLastLogin = useCallback(async (userId: string) => {
    try {
      await supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      logError('Error updating last login:', error, { userId, context: 'updateLastLogin' });
    }
  }, []);

  // Handle auth state changes with improved error handling
  const handleAuthStateChange = useCallback(async (event: string, newSession: Session | null) => {
    if (!mountedRef.current || initializingRef.current) return;

    
    try {
      // Batch state updates to prevent multiple renders
      if (newSession?.user) {
        const userProfile = await fetchProfile(newSession.user.id);
        
        if (mountedRef.current) {
          setSession(newSession);
          setUser(newSession.user);
          setProfile(userProfile);
          
          // Update last login for sign-in events, but don't await to prevent blocking
          if (event === 'SIGNED_IN' && userProfile) {
            updateLastLogin(newSession.user.id).catch(err =>
              logError('Sign-in last login update failed:', err, {
                userId: newSession.user.id,
                context: 'handleAuthStateChange'
              })
            );
          }
        }
      } else {
        if (mountedRef.current) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      }
    } catch (error) {
      logError('Error in auth state change:', error, {
        event,
        hasSession: !!newSession,
        context: 'handleAuthStateChange'
      });

      // If we get invalid token errors, clear tokens
      if (isErrorType(error, 'auth')) {
        const errorMessage = getUserFriendlyErrorMessage(error);
        if (errorMessage.includes('Invalid Refresh Token') ||
            errorMessage.includes('Refresh Token Not Found')) {
          clearAuthTokens();
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchProfile, updateLastLogin]);

  // Initialize auth state - simple and robust
  useEffect(() => {
    if (initializingRef.current) return;
    initializingRef.current = true;
    mountedRef.current = true;

    let completed = false;

    const completeInit = () => {
      if (!completed && mountedRef.current) {
        completed = true;
        setLoading(false);
        setInitialized(true);
      }
    };

    // CRITICAL: Ensure initialization completes within 3 seconds no matter what
    const hardTimeout = setTimeout(() => {
      console.warn('⚠️ Hard timeout: completing initialization');
      completeInit();
    }, 3000);

    const initializeAuthState = async () => {
      try {
        console.log('🚀 Starting auth initialization...');

        // Simple session check with timeout
        const sessionTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Session check timeout')), 1500);
        });

        try {
          const { data: sessionData } = await Promise.race([
            supabase.auth.getSession(),
            sessionTimeoutPromise
          ]) as any;

          if (sessionData?.session?.user && mountedRef.current) {
            console.log('✅ Session found, setting auth state');
            setSession(sessionData.session);
            setUser(sessionData.session.user);

            // Fetch profile in background with timeout
            const profileTimeoutPromise = new Promise<UserProfile | null>((resolve) => {
              setTimeout(() => {
                console.warn('⏱️ Profile fetch timeout (5s)');
                resolve(null);
              }, 5000);
            });

            Promise.race([
              fetchProfile(sessionData.session.user.id),
              profileTimeoutPromise
            ])
              .then(profile => {
                if (mountedRef.current) {
                  setProfile(profile || {
                    id: sessionData.session.user.id,
                    email: (sessionData.session.user.email || '').toLowerCase(),
                    role: 'user',
                    status: 'active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  } as UserProfile);
                }
              })
              .catch(() => {
                if (mountedRef.current) {
                  setProfile({
                    id: sessionData.session.user.id,
                    email: (sessionData.session.user.email || '').toLowerCase(),
                    role: 'user',
                    status: 'active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  } as UserProfile);
                }
              });
          }
        } catch (sessionError) {
          console.log('ℹ️ No active session');
        }

        completeInit();
      } catch (error) {
        console.error('❌ Initialization error:', error);
        completeInit();
      }
    };

    initializeAuthState();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    return () => {
      clearTimeout(hardTimeout);
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, handleAuthStateChange]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await safeAuthOperation(async () => {
      setLoading(true);
      return await supabase.auth.signInWithPassword({
        email,
        password,
      });
    }, 'signIn');

    if (error) {
      setLoading(false);
      // Ensure error is a proper Error object with a message property
      const errorMessage = parseErrorMessage(error);
      const formattedError = new Error(errorMessage || 'Authentication failed');
      return { error: formattedError as AuthError };
    }

    if (data?.error) {
      setLoading(false);
      // Ensure error is a proper Error object with a message property
      const errorMessage = parseErrorMessage(data.error);
      const formattedError = new Error(errorMessage || 'Authentication failed');
      return { error: formattedError as AuthError };
    }

    // Update auth state and wait for profile load before clearing loading
    try {
      const session = (data as any)?.data?.session;
      const signedInUser = session?.user;
      if (signedInUser) {
        console.log('📝 Setting session and user state after sign in');
        setSession(session);
        setUser(signedInUser);

        try {
          // Fetch profile with timeout before clearing loading state
          // This ensures components render with correct role/email filtering
          const profileTimeoutPromise = new Promise<UserProfile | null>((resolve) => {
            setTimeout(() => {
              console.warn('⏱️ Profile fetch timeout during sign in (5s)');
              resolve(null);
            }, 5000); // 5 second timeout for sign in flow
          });

          console.log('🔍 Starting profile fetch with 5s timeout...');
          const userProfile = await Promise.race([
            fetchProfile(signedInUser.id),
            profileTimeoutPromise
          ]);

          if (mountedRef.current) {
            if (userProfile) {
              if (userProfile.email) {
                userProfile.email = userProfile.email.toLowerCase();
              }
              setProfile(userProfile);
              console.log('✅ Profile loaded successfully during sign in');
            } else {
              // Create minimal profile as fallback to allow app to function
              const fallbackProfile: UserProfile = {
                id: signedInUser.id,
                email: (signedInUser.email || '').toLowerCase(),
                role: 'user',
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              setProfile(fallbackProfile);
              console.warn('⚠️ Profile fetch returned null, using fallback profile');
            }

            // Now safe to clear loading state - profile is set
            console.log('✅ Clearing loading state after profile setup');
            setLoading(false);

            // Continue with background retry for profile if needed
            if (!userProfile) {
              console.log('🔄 Starting background profile retry...');
              const retryTimeoutPromise = new Promise<UserProfile | null>((resolve) => {
                setTimeout(() => {
                  console.warn('⏱️ Profile retry timeout');
                  resolve(null);
                }, 10000); // 10 second timeout for background retry
              });

              Promise.race([
                fetchProfile(signedInUser.id),
                retryTimeoutPromise
              ])
                .then(retryProfile => {
                  if (mountedRef.current && retryProfile) {
                    setProfile(retryProfile);
                    console.log('✅ Profile loaded on background retry');
                  }
                })
                .catch(retryError => {
                  logError('Profile retry failed:', retryError, {
                    userId: signedInUser.id,
                    context: 'signIn'
                  });
                });
            }
          }
        } catch (profileError) {
          console.error('❌ Error during profile fetch in signIn:', profileError);
          // Ensure we clear loading even if profile fetch fails
          setLoading(false);
          // Create minimal fallback profile
          const fallbackProfile: UserProfile = {
            id: signedInUser.id,
            email: (signedInUser.email || '').toLowerCase(),
            role: 'user',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          setProfile(fallbackProfile);
        }
      } else {
        console.warn('⚠️ No user returned from sign in');
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Unexpected error in signIn:', error);
      setLoading(false);
    }
    setTimeout(() => toast.success('Signed in successfully'), 0);
    return { error: null };
  }, [fetchProfile]);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    const { data, error } = await safeAuthOperation(async () => {
      setLoading(true);
      return await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
    }, 'signUp');

    if (error) {
      setLoading(false);
      // Ensure error is a proper Error object with a message property
      let formattedError: Error;
      if (error instanceof Error) {
        formattedError = error;
      } else if (error && typeof error === 'object') {
        const errObj = error as any;
        const message = errObj.message || errObj.error_description || errObj.details || 'Sign up failed';
        formattedError = new Error(typeof message === 'string' ? message : JSON.stringify(message));
      } else {
        formattedError = new Error(String(error) || 'Sign up failed');
      }
      return { error: formattedError as AuthError };
    }

    if (data?.error) {
      setLoading(false);
      // Ensure error is a proper Error object with a message property
      let formattedError: Error;
      if (data.error instanceof Error) {
        formattedError = data.error;
      } else if (data.error && typeof data.error === 'object') {
        const errObj = data.error as any;
        const message = errObj.message || errObj.error_description || errObj.details || 'Sign up failed';
        formattedError = new Error(typeof message === 'string' ? message : JSON.stringify(message));
      } else {
        formattedError = new Error(String(data.error) || 'Sign up failed');
      }
      return { error: formattedError as AuthError };
    }

    setTimeout(() => toast.success('Account created successfully'), 0);
    setLoading(false);
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    try {
      console.log('���� Starting sign out process...');
      setLoading(true);

      const { error } = await supabase.auth.signOut();

      if (error) {
        // Better error message handling
        let errorMsg = 'Error signing out';
        if (error instanceof Error) {
          errorMsg = error.message;
        } else if (typeof error === 'string') {
          errorMsg = error;
        } else if (error && typeof error === 'object') {
          const errObj = error as any;
          // Try common error object properties
          if (errObj.message && typeof errObj.message === 'string') {
            errorMsg = errObj.message;
          } else if (errObj.error_description && typeof errObj.error_description === 'string') {
            errorMsg = errObj.error_description;
          } else if (errObj.status) {
            errorMsg = `Network error (status ${errObj.status})`;
          } else {
            errorMsg = 'Network error during sign out';
          }
        }

        logError('❌ Sign out error:', errorMsg, { context: 'signOut' });

        // Still clear local state on error - user may have network issues
        setUser(null);
        setProfile(null);
        setSession(null);
        clearAuthTokens();

        // Network errors during sign out are non-critical since we clear local state anyway
        setTimeout(() => toast.info('Signed out locally (connection issue)'), 0);
      } else {
        console.log('✅ Supabase sign out successful');

        // Clear state immediately
        setUser(null);
        setProfile(null);
        setSession(null);

        // Clear local storage
        clearAuthTokens();

        setTimeout(() => toast.success('Signed out successfully'), 0);
        console.log('🎉 Sign out complete!');
      }
    } catch (error) {
      // Handle network errors gracefully
      let errorMsg = 'Unknown error';
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'string') {
        errorMsg = error;
      } else if (error && typeof error === 'object') {
        const errObj = error as any;
        if (errObj.message && typeof errObj.message === 'string') {
          errorMsg = errObj.message;
        } else if (errObj.error_description && typeof errObj.error_description === 'string') {
          errorMsg = errObj.error_description;
        } else if (errObj.status) {
          errorMsg = `Network error (status ${errObj.status})`;
        } else {
          errorMsg = 'Network error during sign out';
        }
      }

      logError('❌ Sign out exception:', errorMsg, { context: 'signOut' });

      // Clear local state anyway to allow user to proceed
      setUser(null);
      setProfile(null);
      setSession(null);
      clearAuthTokens();

      // Network errors during sign out are not critical - we've already cleared local state
      setTimeout(() => toast.info('Signed out locally (connection issue)'), 0);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { data, error } = await safeAuthOperation(async () => {
      return await supabase.auth.resetPasswordForEmail(email);
    }, 'resetPassword');

    if (error) {
      // Ensure error is a proper Error object with a message property
      let formattedError: Error;
      if (error instanceof Error) {
        formattedError = error;
      } else if (error && typeof error === 'object') {
        const errObj = error as any;
        const message = errObj.message || errObj.error_description || errObj.details || 'Password reset failed';
        formattedError = new Error(typeof message === 'string' ? message : JSON.stringify(message));
      } else {
        formattedError = new Error(String(error) || 'Password reset failed');
      }
      return { error: formattedError as AuthError };
    }

    if (data?.error) {
      // Ensure error is a proper Error object with a message property
      let formattedError: Error;
      if (data.error instanceof Error) {
        formattedError = data.error;
      } else if (data.error && typeof data.error === 'object') {
        const errObj = data.error as any;
        const message = errObj.message || errObj.error_description || errObj.details || 'Password reset failed';
        formattedError = new Error(typeof message === 'string' ? message : JSON.stringify(message));
      } else {
        formattedError = new Error(String(data.error) || 'Password reset failed');
      }
      return { error: formattedError as AuthError };
    }

    setTimeout(() => toast.success('Password reset email sent'), 0);
    return { error: null };
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) {
      return { error: new Error('No user logged in') };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        logError('Error updating profile:', error, { context: 'updateProfile', userId: user.id });
        setTimeout(() => toast.error('Failed to update profile'), 0);
        return { error: new Error(error.message) };
      }

      // Refresh profile data
      await refreshProfile();
      setTimeout(() => toast.success('Profile updated successfully'), 0);
      return { error: null };
    } catch (error) {
      logError('Error updating profile exception:', error, { context: 'updateProfile', userId: user.id });
      setTimeout(() => toast.error('Failed to update profile'), 0);
      return { error: error as Error };
    }
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;

    const userProfile = await fetchProfile(user.id);
    if (userProfile && mountedRef.current) {
      setProfile(userProfile);
    }
  }, [user, fetchProfile]);

  const changeUserPassword = useCallback(async (userId: string, newPassword: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        const errorMsg = 'Not authenticated. Please sign in again.';
        setTimeout(() => toast.error(errorMsg), 0);
        return { error: new Error(errorMsg) };
      }

      console.log('📝 Attempting to change password for user:', userId);

      const { data, error } = await supabase.functions.invoke('change-user-password', {
        body: {
          userId,
          newPassword,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('Response from edge function:', { data, error });

      if (error) {
        logError('Error changing user password:', error, { context: 'changeUserPassword', targetUserId: userId, errorDetails: String(error) });
        let errorMessage = formatErrorForDisplay(error);
        if (!errorMessage || errorMessage === 'An unexpected error occurred') {
          errorMessage = 'Failed to send request to edge function. Please try again.';
        }
        setTimeout(() => toast.error(`Failed to change password: ${errorMessage}`), 0);
        return { error: new Error(errorMessage) };
      }

      if (data?.success) {
        console.log('✅ Password changed successfully');
        setTimeout(() => toast.success('Password changed successfully'), 0);
        return { error: null };
      } else {
        const errorMsg = data?.error || 'Failed to change password';
        console.log('❌ Password change failed:', errorMsg);
        setTimeout(() => toast.error(errorMsg), 0);
        return { error: new Error(errorMsg) };
      }
    } catch (error) {
      logError('Error changing user password exception:', error, { context: 'changeUserPassword', targetUserId: userId });
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('💥 Unexpected error:', errorMessage);
      setTimeout(() => toast.error(`Failed to change password: ${errorMessage}`), 0);
      return { error: error as Error };
    }
  }, []);

  // Add function to manually clear tokens
  const clearTokens = useCallback(() => {
    clearAuthTokens();
    setUser(null);
    setProfile(null);
    setSession(null);
    toast.info('Authentication tokens cleared. Please sign in again.');
  }, []);

  // Compute derived state
  const isAuthenticated = !!user;
  const isAdmin = profile?.role === 'admin';

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading: loading && !forceCompletedRef.current,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
    changeUserPassword,
    isAuthenticated,
    isAdmin,
    refreshProfile,
    clearTokens,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
