'use client';
import React from 'react';
import { ActiveThemeProvider } from '../themes/active-theme';
import QueryProvider from './query-provider';
import { CandidateUserProvider } from './candidate-user-provider';

export default function Providers({
  activeThemeValue,
  hasClerk = false,
  children
}: {
  activeThemeValue: string;
  hasClerk?: boolean;
  children: React.ReactNode;
}) {
  return (
    <ActiveThemeProvider initialTheme={activeThemeValue}>
      <CandidateUserProvider hasClerk={hasClerk}>
        <QueryProvider>{children}</QueryProvider>
      </CandidateUserProvider>
    </ActiveThemeProvider>
  );
}
