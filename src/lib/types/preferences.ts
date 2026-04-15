export interface UserPreferences {
  equipment: string[];
  grinder?: string;
  tasteProfile: {
    likedOrigins: string[];
    likedProcesses: string[];
    avoidProcesses: string[];
    preferredBodyLevel: string;
    preferredAcidityLevel: string;
  };
  defaultAmount: string;
  onboardingComplete: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  equipment: [],
  tasteProfile: {
    likedOrigins: [],
    likedProcesses: [],
    avoidProcesses: [],
    preferredBodyLevel: "medium",
    preferredAcidityLevel: "medium",
  },
  defaultAmount: "solo",
  onboardingComplete: false,
};
