"use client";

import { usePosts } from "@/lib/queries/posts";
import { PostCard } from "./PostCard";
import { CreatePostButton } from "./CreatePostButton";

/**
 * TASK-063 — removida a seção "Descobrir" (cards de séries/filmes em
 * alta) que existia aqui dentro: ela duplicava a aba "DESCOBRIR" ao
 * lado de "FEED" (mesma tela, mesmo conteúdo — trending do TMDB —
 * em dois lugares). Junto foi removida toda a lógica que só existia
 * pra alimentar essa seção (useDiscoverList, o fetch de duração/
 * temporadas por item, o estado de extraInfo). O Feed agora mostra
 * só os posts de texto (usePosts/CreatePostButton), como o resto do
 * comentário original desta tarefa já descrevia como "seção própria".
 *
 * TASK-074 — a exigência de escolher categoria antes de ver o Feed
 * (TASK-059, "enquanto o usuário não selecionar pelo menos uma
 * categoria, o Feed não será exibido") saiu. `usePosts()` nunca
 * chegou a filtrar por categoria de verdade (sempre trouxe todos os
 * posts, em ordem cronológica) — a única coisa que essa exigência
 * fazia era esconder o Feed inteiro atrás de uma tela de onboarding
 * até a pessoa escolher algo. Agora entra direto, mostrando todos os
 * posts pra todo mundo. `FeedOnboarding` ficou sem nenhum lugar que
 * a use — não apagado, só parado, caso vire uma preferência
 * opcional no futuro (não uma barreira de entrada).
 */
export function ExploreFeedTab() {
  const { data: posts, isLoading: postsLoading } = usePosts();

  return (
    <>
      <div className="space-y-4 px-4 pt-4 pb-6">
        {postsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-border bg-surface p-4 text-center text-sm text-muted">
            Ninguém publicou nada ainda. Seja o primeiro — toque no botão + aqui embaixo.
          </p>
        )}
      </div>

      <CreatePostButton />
    </>
  );
}
