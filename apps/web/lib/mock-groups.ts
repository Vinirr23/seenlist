export interface MockGroup {
  slug: string;
  name: string;
  coverUrl: string;
  description: string;
  members: number;
  posts: number;
  hasSpoilers: boolean;
}

export interface MockPost {
  id: string;
  authorName: string;
  authorAvatarUrl: string;
  body: string;
  imageUrl: string | null;
  containsSpoiler: boolean;
  likes: number;
  comments: number;
  createdAt: string;
}

/**
 * TASK-058 — "não precisam ser exatamente esses [grupos]. Apenas
 * gerar dados iniciais" — a própria tarefa autoriza dado mockado
 * aqui. Sem tabela nova: criar `groups`/`group_posts` de verdade
 * exigiria uma migration, e essa tarefa pediu explicitamente "apenas
 * a estrutura visual", não o back-end social completo.
 */
export const MOCK_GROUPS: MockGroup[] = [
  {
    slug: "anime",
    name: "Anime",
    coverUrl: "https://image.tmdb.org/t/p/w780/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg",
    description: "Discuta seus animes favoritos com outros fãs do SeenList. Spoilers rolam por aqui.",
    members: 12480,
    posts: 942,
    hasSpoilers: true,
  },
  {
    slug: "k-drama",
    name: "K-Drama",
    coverUrl: "https://image.tmdb.org/t/p/w780/gpZ0eMRFqcAv5TbYRSbmwakOAg7.jpg",
    description: "Tudo sobre dramas coreanos, dos clássicos aos lançamentos da semana.",
    members: 9870,
    posts: 611,
    hasSpoilers: true,
  },
  {
    slug: "horror",
    name: "Horror",
    coverUrl: "https://image.tmdb.org/t/p/w780/nAxGnGHOsfzufThz20zgmRwKur3.jpg",
    description: "Pra quem gosta de passar medo. Filmes, séries e teorias assustadoras.",
    members: 6320,
    posts: 288,
    hasSpoilers: false,
  },
  {
    slug: "sitcoms",
    name: "Sitcoms",
    coverUrl: "https://image.tmdb.org/t/p/w780/8p6EiFmDDDlUt3sJDbqBcPGxN0N.jpg",
    description: "Risadas garantidas — do clássico ao mais novo lançamento de comédia.",
    members: 5410,
    posts: 203,
    hasSpoilers: false,
  },
  {
    slug: "harry-potter",
    name: "Harry Potter",
    coverUrl: "https://image.tmdb.org/t/p/w780/wuMc08IPKEatf9rnMNXvIDxqP4W.jpg",
    description: "O universo bruxo, livros, filmes e tudo mais sobre Hogwarts.",
    members: 4230,
    posts: 156,
    hasSpoilers: false,
  },
  {
    slug: "sci-fi",
    name: "Sci-Fi",
    coverUrl: "https://image.tmdb.org/t/p/w780/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
    description: "Ficção científica de todos os tipos — espaço, distopias e tecnologia.",
    members: 3980,
    posts: 134,
    hasSpoilers: true,
  },
];

export function getMockGroup(slug: string): MockGroup | undefined {
  return MOCK_GROUPS.find((g) => g.slug === slug);
}

export function getMockPosts(slug: string): MockPost[] {
  return [
    {
      id: `${slug}-1`,
      authorName: "Fã do grupo",
      authorAvatarUrl: "",
      body: "Alguém mais tá acompanhando os últimos episódios? To adorando esse arco!",
      imageUrl: null,
      containsSpoiler: false,
      likes: 24,
      comments: 5,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: `${slug}-2`,
      authorName: "Outro membro",
      authorAvatarUrl: "",
      body: "Não acredito no que aconteceu no final da temporada... mudou tudo!",
      imageUrl: null,
      containsSpoiler: true,
      likes: 41,
      comments: 12,
      createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    },
  ];
}
