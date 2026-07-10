export type ProfileVisibility = "public" | "followers" | "private";

export interface UserProfile {
  userId: string;
  username: string;
  /** Nome de exibição público — agora mora em profiles, não só em auth.users.user_metadata (que outros usuários nunca conseguiam ler). */
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  bannerUrl: string | null;
  country: string | null;
  language: string;
  profileVisibility: ProfileVisibility;
  favoritesVisibility: ProfileVisibility;
  libraryVisibility: ProfileVisibility;
  createdAt: string;
}
