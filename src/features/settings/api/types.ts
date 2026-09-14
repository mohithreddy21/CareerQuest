export interface UserSettings {
  targetRoles: string[];
  preferredLocations: string[];
  workArrangements: ('remote' | 'hybrid' | 'onsite')[];
  targetSalaryMin: number;
  currency: string;
  aiExplanationDetail: 'concise' | 'detailed';
  autoExtractRequirements: boolean;
  notifyOnHighMatch: boolean;
  privateMode: boolean;
}

export interface UpdateSettingsPayload {
  updates: Partial<UserSettings>;
}
