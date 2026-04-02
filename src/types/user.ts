export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  country: string;
  language: string;
  status?: string;
  privacySettings: {
    showLastSeen: boolean;
    showReadReceipts: boolean;
  };
}