'use client';

import React, { createContext, useContext } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';

export interface CandidateUserData {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
  emailAddresses?: { emailAddress: string }[];
  imageUrl?: string | null;
}

const CandidateUserContext = createContext<{
  user: CandidateUserData | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  signOut: (options?: { redirectUrl?: string }) => Promise<void>;
}>({
  user: null,
  isLoaded: true,
  isSignedIn: false,
  signOut: async () => {}
});

function ClerkBridge({ children }: { children: React.ReactNode }) {
  const clerk = useUser();
  const { signOut } = useClerk();
  return (
    <CandidateUserContext.Provider
      value={{
        user: clerk.user ?? null,
        isLoaded: clerk.isLoaded,
        isSignedIn: Boolean(clerk.isSignedIn),
        signOut: async (options) => {
          await signOut(options);
        }
      }}
    >
      {children}
    </CandidateUserContext.Provider>
  );
}

export function CandidateUserProvider({
  hasClerk,
  children
}: {
  hasClerk: boolean;
  children: React.ReactNode;
}) {
  if (hasClerk) {
    return <ClerkBridge>{children}</ClerkBridge>;
  }

  return (
    <CandidateUserContext.Provider
      value={{
        user: null,
        isLoaded: true,
        isSignedIn: false,
        signOut: async () => {
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/sign-in';
          }
        }
      }}
    >
      {children}
    </CandidateUserContext.Provider>
  );
}

export function useCandidateUser() {
  return useContext(CandidateUserContext);
}
