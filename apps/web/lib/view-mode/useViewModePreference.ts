"use client";

import { useEffect, useState } from "react";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";

export type ViewMode = "grid" | "list";

function isViewMode(value: unknown): value is ViewMode {
  return value === "grid" || value === "list";
}

/**
 * Ajuste: a versão anterior (`ViewModeProvider`) era um único valor
 * global — trocar em Séries também mudaria Filmes e Perfil, que não
 * é o que foi pedido ("o botão afeta apenas a tela atual"). Virou um
 * hook simples, sem Context nenhum: cada tela chama com sua própria
 * `scope` ("series-library", "movies-library") e tem sua própria
 * chave de armazenamento, totalmente independente das outras.
 *
 * Mesma estratégia de persistência de sempre — `localStorage`
 * responde na hora, `user_metadata` do Supabase mantém entre
 * dispositivos, sem tabela nova.
 *
 * BUG REAL CORRIGIDO (2026-08-27, reportado — "na tela home/séries
 * está mostrando 2 esqueletons") — 2 rodadas até achar a causa raiz
 * de verdade:
 *
 * RODADA 1 (correção incompleta): `viewMode` começava sempre em
 * "grid" e só era corrigido pro valor real (`localStorage`) dentro de
 * um `useEffect`, ou seja, DEPOIS da 1ª renderização — o esqueleto
 * mudava de formato (grade → lista) na hora que o efeito rodava,
 * parecendo "2 esqueletons" em sequência. 1ª tentativa: ler o
 * `localStorage` direto no valor inicial do `useState` ("lazy
 * initializer", síncrono, antes da 1ª pintura). Reportado como AINDA
 * quebrado — a causa raiz de verdade é outra, mais funda:
 *
 * RODADA 2 (causa raiz de verdade): esta tela roda tanto no
 * SERVIDOR (Next.js gera o HTML inicial) quanto no NAVEGADOR — e só o
 * navegador tem acesso a `localStorage`; no servidor, `typeof window
 * === "undefined"` sempre cai no padrão "grid". Isso por si só não é
 * problema NENHUM tela normal — o problema é só quando o formato
 * visual da tela MUDA dependendo desse valor (caso do esqueleto, desde
 * a correção de formato em `HomeSkeleton.tsx`). Se a pessoa tem "lista"
 * salva, o HTML gerado no servidor (sem saber disso) mostra o
 * esqueleto em formato GRADE; ao ligar o JavaScript no navegador
 * (hidratação), o valor de verdade ("lista") é descoberto e a tela
 * muda de formato — só que essa troca acontece DEPOIS que o navegador
 * já pintou o HTML do servidor na tela (isso acontece antes mesmo do
 * JavaScript come çar a rodar), então a pessoa via a MESMA sequência
 * de novo (esqueleto formato A, depois formato B), só que agora
 * causada pela diferença servidor/navegador, não mais pelo efeito
 * atrasado da Rodada 1. Reproduz sobretudo ao recarregar a página
 * inteira (`F5`) nessa tela — o caso mais comum ao testar mudanças de
 * código localmente.
 *
 * CORREÇÃO DE VERDADE: `isReady` — só vira `true` depois que o valor
 * de `viewMode` já foi conferido no NAVEGADOR (dentro do `useEffect`,
 * que só roda no cliente, nunca no servidor). Enquanto `isReady` for
 * `false` (servidor inteiro + o instante inicial no navegador antes do
 * efeito rodar), quem usa este hook não deve desenhar NADA que dependa
 * do formato (nem esqueleto, nem grade, nem lista) — só depois de
 * `isReady` é seguro escolher o formato certo, já sem risco de trocar
 * de formato na frente da pessoa.
 */
export function useViewModePreference(scope: string) {
  const storageKey = `seenlist:viewMode:${scope}`;
  const metadataKey = `viewMode_${scope}`;

  const [viewMode, setViewModeState] = useState<ViewMode>("grid");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (isViewMode(stored)) {
      setViewModeState(stored);
      setIsReady(true);
      return;
    }
    // Sem nada salvo ainda neste navegador — "grid" já é a melhor
    // suposição possível, não precisa esperar a rede pra liberar a
    // tela pra desenhar (evita atraso à toa na 1ª visita).
    setIsReady(true);
    const supabase = createClient();
    // CORREÇÃO DE PERFORMANCE (achado real, auditoria) — `getUser()`
    // faz chamada de rede; só roda quando ainda não tem valor salvo
    // no localStorage (primeira visita a este `scope` no navegador),
    // então já era pouco frequente, mas `getCurrentAuthUser()` (local,
    // sem rede) resolve o mesmo dado sem custo nenhum.
    getCurrentAuthUser(supabase).then(({ data }) => {
      const saved = data.user?.user_metadata?.[metadataKey];
      if (isViewMode(saved)) setViewModeState(saved);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só precisa rodar uma vez por scope, não a cada render
  }, [scope]);

  function setViewMode(next: ViewMode) {
    setViewModeState(next);
    window.localStorage.setItem(storageKey, next);
    const supabase = createClient();
    supabase.auth.updateUser({ data: { [metadataKey]: next } }).catch((error) => {
      console.error(`[view-mode] Falha ao salvar preferência de visualização (${scope})`, error);
    });
  }

  return { viewMode, setViewMode, isReady };
}
