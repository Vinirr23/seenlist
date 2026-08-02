import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * A PEDIDO — "Feed mais vivo", item 2: quando alguém publica um post
 * novo, NAO insere sozinho na lista - isso empurraria o conteúdo
 * debaixo do dedo de quem já está lendo o Feed (péssima experiência,
 * mesmo padrão que redes sociais grandes usam pra evitar isso). Em
 * vez disso, só CONTA quantos chegaram, mostra um aviso, e só busca
 * de verdade quando a pessoa toca nele.
 */
export function useNewPostsBanner() {
  const [count, setCount] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("realtime-new-posts-banner")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => {
        setCount((n) => n + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function showNewPosts() {
    setCount(0);
    queryClient.invalidateQueries({ queryKey: ["posts"] });
  }

  return { newPostsCount: count, showNewPosts };
}
