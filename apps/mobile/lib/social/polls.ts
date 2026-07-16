import { supabase, getCurrentAuthUser } from "@/lib/supabase";

export interface PollOptionResult {
  id: string;
  text: string;
  voteCount: number;
}

export interface PollData {
  options: PollOptionResult[];
  totalVotes: number;
  /** null enquanto o usuário não votou — voto é definitivo (TASK-163), então isso nunca muda de volta pra null. */
  votedOptionId: string | null;
}

interface PollOptionRow {
  id: string;
  post_id: string;
  label: string;
  position: number;
}

interface PollVoteRow {
  post_id: string;
  option_id: string;
  user_id: string;
}

function buildPollData(postId: string, optionRows: PollOptionRow[], voteRows: PollVoteRow[], currentUserId: string | null): PollData {
  const optionsForPost = optionRows.filter((o) => o.post_id === postId).sort((a, b) => a.position - b.position);
  const votesForPost = voteRows.filter((v) => v.post_id === postId);
  const countByOption = new Map<string, number>();
  for (const vote of votesForPost) {
    countByOption.set(vote.option_id, (countByOption.get(vote.option_id) ?? 0) + 1);
  }
  const votedOptionId = currentUserId ? (votesForPost.find((v) => v.user_id === currentUserId)?.option_id ?? null) : null;

  return {
    options: optionsForPost.map((o) => ({ id: o.id, text: o.label, voteCount: countByOption.get(o.id) ?? 0 })),
    totalVotes: votesForPost.length,
    votedOptionId,
  };
}

/** TASK-163 — mesma ideia de fetchLikeInfoFor/fetchSavedStatusesFor: 1-2 consultas pra todos os posts de enquete visíveis no Feed, não uma por post. */
export async function fetchPollDataFor(postIds: string[]): Promise<Map<string, PollData>> {
  const result = new Map<string, PollData>();
  if (postIds.length === 0) return result;

  const {
    data: { user },
  } = await getCurrentAuthUser();

  const [optionsRes, votesRes] = await Promise.all([
    supabase.from("poll_options").select("id, post_id, label, position").in("post_id", postIds),
    supabase.from("poll_votes").select("post_id, option_id, user_id").in("post_id", postIds),
  ]);
  if (optionsRes.error) throw optionsRes.error;
  if (votesRes.error) throw votesRes.error;

  const optionRows = (optionsRes.data ?? []) as PollOptionRow[];
  const voteRows = (votesRes.data ?? []) as PollVoteRow[];
  const postIdsWithOptions = new Set(optionRows.map((o) => o.post_id));

  for (const postId of postIdsWithOptions) {
    result.set(postId, buildPollData(postId, optionRows, voteRows, user?.id ?? null));
  }
  return result;
}

/** Variante de um post só — usada pela tela de detalhe (`/posts/[id]`), quando o PollBlock não recebe `initial` pronto. */
export async function fetchPollData(postId: string): Promise<PollData | null> {
  const data = await fetchPollDataFor([postId]);
  return data.get(postId) ?? null;
}

/** Cria o post (type "poll", pergunta em `body`) e as opções em seguida, na ordem em que foram digitadas. */
export async function createPollPost(question: string, optionTexts: string[]): Promise<void> {
  const trimmedQuestion = question.trim();
  const trimmedOptions = optionTexts.map((o) => o.trim()).filter((o) => o.length > 0);
  if (!trimmedQuestion) throw new Error("Pergunta vazia.");
  if (trimmedOptions.length < 2) throw new Error("A enquete precisa de pelo menos 2 opções.");

  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      type: "poll",
      body: trimmedQuestion,
      image_url: null,
      media_type: null,
      media_id: null,
      media_title: null,
      media_poster_path: null,
      rating: null,
    })
    .select("id")
    .single();
  if (postError) throw postError;

  const { error: optionsError } = await supabase.from("poll_options").insert(
    trimmedOptions.map((label, index) => ({
      post_id: (post as { id: string }).id,
      label,
      position: index,
    }))
  );
  if (optionsError) throw optionsError;
}

/** Voto definitivo — segunda tentativa quebra por unicidade no banco (`poll_votes_post_id_user_id_key`), tratado aqui como não-erro, mesmo padrão de reportPost. */
export async function votePoll(postId: string, optionId: string): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("poll_votes").insert({ post_id: postId, option_id: optionId, user_id: user.id });
  if (error && (error as { code?: string }).code !== "23505") throw error;
}
