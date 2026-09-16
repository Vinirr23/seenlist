export type ProfileVisibility = "public" | "followers" | "private";

export interface UserProfile {
  userId: string;
  username: string;
  /** Nome de exibição público — agora mora em profiles, não só em auth.users.user_metadata (que outros usuários nunca conseguiam ler). */
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  bannerUrl: string | null;
  /** Ajuste vertical do corte do banner (0 = topo, 0.5 = centro/padrão, 1 = base) — a pedido ("eu não consigo redimensionar o banner pra ficar do jeito que eu quero"), ver migration `20260917000000_profiles_banner_focal_y.sql`. */
  bannerFocalY: number;
  country: string | null;
  language: string;
  profileVisibility: ProfileVisibility;
  favoritesVisibility: ProfileVisibility;
  libraryVisibility: ProfileVisibility;
  createdAt: string;
}
