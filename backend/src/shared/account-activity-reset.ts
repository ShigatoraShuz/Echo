/** The local JSON repository permits one backend writer; SQL guards cover database writers. */
export const resettingAccounts = new Set<string>();
