export interface User {
  id: number;
  email: string;
  name: string;
  username?: string;
  avatar?: string;
  country: string;
  language: string;
  status?: string;
  privacySettings: {
    showLastSeen: boolean;
    showReadReceipts: boolean;
  };
}