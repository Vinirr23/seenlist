import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { View, Pressable, Alert, FlatList, ScrollView, StyleSheet, ActivityIndicator, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  interpolate,
  Easing,
  type SharedValue,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchMyLists, fetchListItems, removeFromList, deleteList, removeCoOwner, leaveSharedList, type UserList, type ListItem } from "@/lib/lists";
import { fetchListWatchProgress, fetchSharedEpisodeInfo, markNextEpisode, rewindEpisode, toggleMovieWatched, type ListWatchProgress, type SharedEpisodeInfo } from "@/lib/listWatchProgress";
import { supabase } from "@/lib/supabase";
import { InviteCoOwnerSheet } from "@/components/social/InviteCoOwnerSheet";
import { EpisodeWatchedButton } from "@/components/series-detail/EpisodeWatchedButton";
import { OptionSheet } from "@/components/settings/OptionSheet";
import { usePosterCardWidth, POSTER_GRID_GAP } from "@/components/media/PosterGrid";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { PageError } from "@/components/media/PageError";
import { SectionTitle } from "@/components/media/SectionTitle";
import { ViewAllButton } from "@/components/media/ViewAllButton";
import { Avatar } from "@/components/common/Avatar";
import { Screen, Text, Skeleton, PressableScale, GlassTargetProvider, AmbientGlow, ScreenHeader, Glass } from "@/components/ui";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { hapticTick } from "@/lib/haptics";
import { colors, radius, spacing, fontSize, fontFamily, elevation, scrim, tint } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { useCurrentUser } from "@/lib/useCurrentUser";

/**
 * TASK-172 — porta de `ListDetailView.tsx` do web.
 *
 * CORREÇÃO (a pedido — mesmo achado #3 já corrigido no Perfil,
 * "sem limite nenhum na busca") — `fetchListItems` busca TODO item
 * de uma lista, sem limite (correto — uma lista custom pode crescer
 * bastante com o tempo). Trocado `ScrollView`+`.map()` por `FlatList`
 * (`numColumns={3}`, virtualizada).
 *
 * REDESIGN "DETALHE DA LISTA" (2026-10-07, aprovado pelo usuário —
 * ver `claude/SEENLIST-FEATURE-2026-10-07-redesign-detalhe-lista.md`)
 * — auditoria prévia aprovada, depois implementação. Três mudanças
 * principais, nenhuma de dado/permissão, só de apresentação:
 *
 * 1. O "X" permanente em cima de todo pôster virou um "•••" discreto
 *    (`scrim.control`, sem círculo grande) que abre o `OptionSheet`
 *    já usado em `PostCard.tsx`/`SeasonAccordion`/tela de episódio
 *    pra "Remover da lista" — mesmo padrão de menu que já existe no
 *    app em 3 lugares, não um gesto novo (`long press` não tem
 *    nenhum precedente no app; "modo de edição" também não).
 * 2. "Apagar lista" (dono) e "Sair da lista" (co-dono) saíram de
 *    ícones soltos no `right` do header e viraram a mesma ação via
 *    "•••" único — reduz a competição visual com o título, sem mudar
 *    NENHUMA regra de permissão (o `Alert.alert` de confirmação que
 *    já existia pros dois continua exatamente igual, só é disparado
 *    de dentro do `OptionSheet` agora).
 * 3. "Convidar pra co-dono"/status de co-dono viraram uma pill
 *    compacta (mesma linguagem visual de `GenreChips.tsx` — `tint.subtle`
 *    + `radius.full`) em vez de uma linha de largura total com o
 *    mesmo peso tipográfico de uma ação primária.
 *
 * Pôster em si: saiu do `<Glass>` (era o mesmo excesso que a grade de
 * "Minhas listas" já tinha tirado) — agora é `Image` pura com
 * `radius.poster`, dentro de `PressableScale`.
 *
 * Erro de busca (achado real da auditoria, não documentado antes) —
 * esta tela nunca tratava falha de `fetchMyLists`/`fetchListItems`;
 * ficava presa no skeleton pra sempre. Agora usa `PageError` (mesmo
 * padrão de `lists/index.tsx`).
 */
/**
 * NOVO (2026-10-14 — mockup aprovado: "substituir o avatar isolado por
 * dois avatares parcialmente sobrepostos"). `stacked=false` preserva
 * 1:1 o visual de antes (só o avatar do "outro" participante) — usado
 * pro convite ainda PENDENTE, onde só existe 1 participante de fato.
 */
function ParticipantAvatarStack({
  stacked,
  selfAvatarUrl,
  selfName,
  otherAvatarUrl,
  otherName,
}: {
  stacked: boolean;
  selfAvatarUrl: string | null;
  selfName: string;
  otherAvatarUrl: string | null;
  otherName: string;
}) {
  if (!stacked) {
    return <Avatar uri={otherAvatarUrl} name={otherName} style={styles.coOwnerAvatar} textStyle={styles.coOwnerAvatarInitials} />;
  }
  return (
    <View style={styles.avatarStack}>
      <Avatar uri={selfAvatarUrl} name={selfName} style={styles.avatarStackAvatar} textStyle={styles.coOwnerAvatarInitials} />
      <Avatar uri={otherAvatarUrl} name={otherName} style={[styles.avatarStackAvatar, styles.avatarStackOverlap]} textStyle={styles.coOwnerAvatarInitials} />
    </View>
  );
}

/**
 * CARTÃO GRANDE, PADRÃO "CONTINUAR ACOMPANHANDO" (2026-10-14, a pedido
 * explícito — "deixa igual ao padrão de série/home com as mesmas
 * funções e animações") — porte fiel da coreografia de
 * `ContinueWatchingListRow.tsx` (Home/Séries): pulso no botão, anel +
 * partículas ao marcar, selo verde "✓ Assistido" com spinner durante a
 * escrita real, e um slide lateral trocando o conteúdo pro próximo
 * episódio só depois que o dado novo chegou de verdade. Mockup
 * aprovado: https://claude.ai/artifact/CPUfBmDFRbWKG3i8aeTarb.
 *
 * DIFERENÇAS DELIBERADAS em relação à Home (nunca uma cópia cega):
 * 1. Sem fase "exiting"/colapso — lá o card SAI da lista quando a
 *    série termina (é "continuar assistindo"); aqui a série nunca sai
 *    da lista compartilhada só por ter sido concluída junto, então o
 *    card só troca de conteúdo (botão → "•••"), nunca encolhe/some.
 * 2. Sem a folha de "episódios pendentes" (`PendingEpisodesSheet`) —
 *    aquele "+N" conta episódios do HISTÓRICO INDIVIDUAL; o progresso
 *    compartilhado não tem esse conceito (ver `hasStarted`/causa raiz
 *    abaixo). O "+N" aqui (ver `episodeInfo`, prop) mostra algo
 *    real mas DIFERENTE: episódios que faltam NA TEMPORADA ATUAL do
 *    PRÓPRIO progresso compartilhado — só informativo, sem abrir nada
 *    ao tocar (decisão do usuário, 2026-10-14).
 * 3. A falha de escrita só é tratada depois do "hold" inteiro (~650ms),
 *    não instantaneamente como a Home faz pra uma falha bem rápida —
 *    simplificação deliberada: `onMarkNextEpisode` nunca rejeita (a
 *    tela-mãe já mostra o `Alert` e devolve `false`), então não tem
 *    como distinguir "falhou rápido" de "ainda escrevendo" sem um
 *    sinal a mais que não foi pedido.
 *
 * Sem `progress` ainda (ninguém marcou nada aqui, 1ª vez) assume
 * T1·Ep.1 como próximo alvo — é exatamente aonde "Marcar próximo
 * episódio" vai escrever na 1ª vez que alguém tocar.
 */
const CONFIRM_HOLD_MS = 650;
const ADVANCE_SLIDE_DISTANCE = 20;
const ADVANCE_SLIDE_DURATION_MS = 230;
const ADVANCE_PARKED_OPACITY = 0.4;
const ADVANCE_MIN_WAIT_MS = 250;
const RING_MAX_SCALE = 1.8;
/**
 * AVISO FLUTUANTE (2026-10-14, a pedido explícito — "toda vez que
 * aparecer o aviso 'episodio marcado' e o 'episódio anterior' que
 * apareceu no mockup", mockup aprovado:
 * https://claude.ai/artifact/ThspcdLkpmnrQvVQd41MMp) — mesmo texto/
 * timing do protótipo HTML: sobe `TOAST_RISE_DISTANCE` e some depois
 * de `TOAST_VISIBLE_MS`. Nasce e morre só dentro de `SharedProgressRow`
 * (nenhuma tela "empresta" este componente ainda), então não existe
 * como um `Toast` genérico reaproveitável — se outra tela pedir o
 * mesmo padrão depois, aí sim vale extrair.
 */
const TOAST_RISE_DISTANCE = 26;
const TOAST_VISIBLE_MS = 1400;
/** Mesma proporção da Home pro botão "md" (32px) — ver comentário em `ContinueWatchingListRow.tsx`. */
const PARTICLE_DISTANCE = 13;
const PARTICLE_ANGLES = [0, 60, 120, 180, 240, 300].map((deg) => (deg * Math.PI) / 180);
/**
 * LIMITE "VER MAIS"/"VER TODOS" (2026-10-15) — ver comentário grande
 * nos `useState` de `moviesExpanded`/`seriesExpanded`, mais abaixo.
 * Mesmo valor pras duas seções (confirmado com o usuário).
 */
const SECTION_DISPLAY_LIMIT = 6;

/**
 * FAIXA LATERAL DE DESTAQUE (2026-10-14, a pedido — "se as pessoas
 * usando essa lista estiverem assistindo mais de 1 título, a faixa vai
 * servir sim") — mesma forma/curva de opacidade de
 * `ContinueWatchingListRow.tsx` (1º item cheio, depois decrescente),
 * só que em AZUL (`colors.info`, #3A85CE) em vez de âmbar — cor
 * reservada ao selo "compartilhada" nesta feature, pra não competir
 * com o âmbar que já significa "em andamento" na tag de status deste
 * mesmo card. Só é passada (`priorityIndex`) quando a seção de SÉRIES
 * tem MAIS de 1 título (2026-10-15: desde a divisão Filmes/Séries,
 * `priorityIndex` é posição dentro de `seriesItems`, não da lista
 * inteira — filmes têm seu próprio toggle binário, sem ranking) — com
 * uma só série, não há o que ranquear.
 */
const OPACIDADE_DESTAQUE = [1, 0.5, 0.25, 0.08, 0.02] as const;
const FATOR_BRILHO_DESTAQUE = 0.35;
const LARGURA_BARRA_DESTAQUE = 4;
const LARGURA_BRILHO_DESTAQUE = 128;

/**
 * ORDENAÇÃO "ASSISTIDO JUNTO" (2026-10-15, a pedido — "o filme ao ser
 * marcado assistido, precisa mover e o filme que ainda não foi
 * assistido ficar na frente. os filmes assistidos devem seguir a
 * sequencia de quando foi assistido e não aleatório. isso serve pra
 * séries também") — serve tanto a prateleira de filmes quanto a lista
 * de séries: os ainda não concluídos (`status !== "completed"`, inclui
 * nunca iniciado e "assistindo juntos") ficam na FRENTE, na ordem em
 * que já vinham (ordem de adição à lista); os concluídos vão pro FIM,
 * ordenados pelo `updatedAt` do progresso — mais recente primeiro
 * (confirmado com o usuário: "Mais recente assistido primeiro").
 */
function ordenarPorProgressoCompartilhado(itensDaLista: ListItem[], progressoPorChave: Map<string, ListWatchProgress>): ListItem[] {
  const naoConcluidos: ListItem[] = [];
  const concluidos: ListItem[] = [];
  for (const item of itensDaLista) {
    const progresso = progressoPorChave.get(`${item.mediaType}-${item.mediaId}`);
    if (progresso?.status === "completed") concluidos.push(item);
    else naoConcluidos.push(item);
  }
  concluidos.sort((a, b) => {
    const dataA = progressoPorChave.get(`${a.mediaType}-${a.mediaId}`)?.updatedAt;
    const dataB = progressoPorChave.get(`${b.mediaType}-${b.mediaId}`)?.updatedAt;
    const tempoA = dataA ? new Date(dataA).getTime() : 0;
    const tempoB = dataB ? new Date(dataB).getTime() : 0;
    return tempoB - tempoA;
  });
  return [...naoConcluidos, ...concluidos];
}

function opacidadeDoDestaque(indice: number | undefined): number {
  if (indice === undefined || indice < 0) return 0;
  return OPACIDADE_DESTAQUE[indice] ?? 0;
}

/** Ver `BurstParticle` em `ContinueWatchingListRow.tsx` — mesmo motivo de existir separado (hook por instância, não em loop). */
function BurstParticle({ angle, progress }: { angle: number; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [0, Math.cos(angle) * PARTICLE_DISTANCE]) },
      { translateY: interpolate(progress.value, [0, 1], [0, Math.sin(angle) * PARTICLE_DISTANCE]) },
      { scale: interpolate(progress.value, [0, 1], [1, 0.4]) },
    ],
  }));
  return <Animated.View pointerEvents="none" style={[styles.particle, style]} />;
}

function SharedProgressRow({
  item,
  progress,
  onPress,
  onMarkNextEpisode,
  onRewindEpisode,
  onOpenMenu,
  priorityIndex,
  episodeInfo,
  t,
}: {
  item: ListItem;
  progress: ListWatchProgress | undefined;
  onPress: () => void;
  /** Dispara a escrita real + refetch do progresso; nunca rejeita — resolve `false` numa falha (a tela-mãe já mostrou o `Alert`). */
  onMarkNextEpisode: () => Promise<boolean>;
  /**
   * NOVO (2026-10-14) — toque e segure no mesmo selo: volta 1 episódio,
   * ou reinicia pro episódio 1 se a série já estiver concluída. Mesmo
   * contrato de `onMarkNextEpisode` (nunca rejeita, resolve `false` numa
   * falha — ver `handleRewindEpisode` na tela-mãe).
   */
  onRewindEpisode: () => Promise<boolean>;
  onOpenMenu: () => void;
  /** Posição da SÉRIE dentro de `seriesItems` (0 = primeira) — só definida quando há mais de 1 série (filmes não entram nesse ranking, ver comentário acima de `OPACIDADE_DESTAQUE`). */
  priorityIndex?: number;
  /** Nome real do episódio + "+N" restantes na temporada — ver `SharedEpisodeInfo`/`fetchSharedEpisodeInfo`. */
  episodeInfo?: SharedEpisodeInfo;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [phase, setPhase] = useState<"idle" | "confirming" | "advancing">("idle");
  const [pulseKey, setPulseKey] = useState(0);

  /**
   * Congela o último progresso mostrado em `idle` — mesma razão do
   * `frozenRef` na Home: durante `confirming`/`advancing`, continua
   * mostrando o episódio que a pessoa ACABOU de marcar, mesmo que
   * `progress` (prop) já tenha mudado antes da animação terminar.
   */
  const frozenRef = useRef<ListWatchProgress | undefined>(progress);
  if (phase === "idle") frozenRef.current = progress;
  const display = phase === "idle" ? progress : frozenRef.current;

  /** Sempre espelha a prop mais recente — usado só na troca de conteúdo em "advancing" (ver `handleMarkWatched`). */
  const latestProgressRef = useRef(progress);
  useEffect(() => {
    latestProgressRef.current = progress;
  }, [progress]);

  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
      if (toastHideTimeoutRef.current) clearTimeout(toastHideTimeoutRef.current);
    };
  }, []);

  const pulseScale = useSharedValue(1);
  const burstProgress = useSharedValue(0);
  const tintOpacity = useSharedValue(0);
  const advanceOut = useSharedValue(0);
  const advanceIn = useSharedValue(0);

  /** Ver comentário grande em `TOAST_RISE_DISTANCE`, acima. */
  const toastOpacity = useSharedValue(0);
  const toastTranslateY = useSharedValue(0);
  const [toastText, setToastText] = useState<string | null>(null);
  const [rewinding, setRewinding] = useState(false);

  function showToast(text: string) {
    if (toastHideTimeoutRef.current) clearTimeout(toastHideTimeoutRef.current);
    setToastText(text);
    toastOpacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) });
    toastTranslateY.value = withTiming(-TOAST_RISE_DISTANCE, { duration: 160, easing: Easing.out(Easing.quad) });
    toastHideTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      toastOpacity.value = withTiming(0, { duration: 200 });
      toastTranslateY.value = withTiming(0, { duration: 200 });
    }, TOAST_VISIBLE_MS);
  }

  /**
   * TOQUE E SEGURE (2026-10-14) — ver `onRewindEpisode`, acima, e o
   * comentário grande em `rewindEpisode` (`lib/listWatchProgress.ts`).
   * Reiniciar uma série CONCLUÍDA pede confirmação primeiro (a pedido
   * explícito — "é necessário o aviso antes de reiniciar"); voltar 1
   * episódio dentro de uma série em andamento não pede (ação pequena,
   * simétrica ao próprio "marcar próximo", que também não confirma).
   */
  function handleRewind() {
    if (phase !== "idle" || rewinding) return;
    if (!hasStarted) return; // nada pra voltar — o gesto não devia nem chegar aqui.

    if (isCompleted) {
      Alert.alert(t("profile.rewindConfirmTitle"), t("profile.rewindConfirmMessage"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("profile.rewindConfirmAction"), onPress: () => performRewind(t("profile.sharedProgressToast.rewatching")) },
      ]);
      return;
    }

    // Season 1/Ep. 1 "de verdade" (não um valor padrão — `hasStarted` já garante que `display` existe) é sempre o 1º episódio real, pela mesma ordenação (temporada→episódio) que `rewindEpisode` usa pra decidir se desmarca tudo.
    const isFirstEpisode = seasonNumber === 1 && episodeNumber === 1;
    performRewind(isFirstEpisode ? t("profile.sharedProgressToast.unmarked") : t("profile.sharedProgressToast.previous"));
  }

  function performRewind(toastMessage: string) {
    hapticTick();
    setRewinding(true);
    onRewindEpisode()
      .then((success) => {
        if (success) showToast(toastMessage);
      })
      .finally(() => {
        if (mountedRef.current) setRewinding(false);
      });
  }

  function handleMarkWatched() {
    if (phase !== "idle" || isCompleted) return;
    hapticTick();
    /*
      REMOVIDO (a pedido — "o toast de 'episódio marcado' é redundante")
      — avançar já tem feedback de sobra (pulso + anel + partículas +
      pílula vira "✓ Assistido" com spinner, logo abaixo). O toast
      flutuante (`showToast`) sobra só pras ações de TOQUE LONGO (voltar/
      desmarcar/reassistir), que não têm NENHUM outro sinal visual
      próprio além dele.
    */
    setPhase("confirming");
    setPulseKey((k) => k + 1);

    pulseScale.value = withSequence(
      withTiming(1.18, { duration: 130, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 130, easing: Easing.out(Easing.quad) })
    );
    burstProgress.value = 0;
    burstProgress.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) });
    tintOpacity.value = withTiming(1, { duration: 200, easing: Easing.inOut(Easing.ease) });

    // Fogo e esquece — a escrita roda em paralelo com a coreografia (ver comentário grande acima sobre a diferença deliberada #3).
    const writePromise = onMarkNextEpisode();

    holdTimeoutRef.current = setTimeout(() => {
      holdTimeoutRef.current = null;
      tintOpacity.value = withTiming(0, { duration: 200 });
      advanceIn.value = 0;
      advanceOut.value = 0;

      requestAnimationFrame(() => {
        setPhase("advancing");
        const tempoMinimoDeEspera = new Promise<void>((resolve) => setTimeout(resolve, ADVANCE_MIN_WAIT_MS));
        Promise.all([writePromise, tempoMinimoDeEspera]).then(([success]) => {
          if (!mountedRef.current) return;
          if (!success) {
            // Falha na escrita (tela-mãe já mostrou o Alert) — volta pro estado anterior, sem trocar conteúdo.
            tintOpacity.value = withTiming(0, { duration: 150 });
            setPhase("idle");
            return;
          }
          advanceOut.value = withTiming(1, { duration: ADVANCE_SLIDE_DURATION_MS, easing: Easing.out(Easing.quad) });
          setTimeout(() => {
            if (!mountedRef.current) return;
            frozenRef.current = latestProgressRef.current;
            setPhase("idle");
            advanceIn.value = 0;
            advanceIn.value = withTiming(1, { duration: ADVANCE_SLIDE_DURATION_MS, easing: Easing.out(Easing.quad) });
          }, ADVANCE_SLIDE_DURATION_MS);
        });
      });
    }, CONFIRM_HOLD_MS);
  }

  const buttonWrapperStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(burstProgress.value, [0, 1], [0.6, 0]),
    transform: [{ scale: interpolate(burstProgress.value, [0, 1], [0.6, RING_MAX_SCALE]) }],
  }));
  const tintStyle = useAnimatedStyle(() => ({ opacity: tintOpacity.value }));
  const toastStyle = useAnimatedStyle(() => ({
    opacity: toastOpacity.value,
    transform: [{ translateY: toastTranslateY.value }],
  }));
  const advanceSlideStyle = useAnimatedStyle(() => {
    const saindo = advanceOut.value < 1;
    const translateX = saindo
      ? interpolate(advanceOut.value, [0, 1], [0, -ADVANCE_SLIDE_DISTANCE])
      : interpolate(advanceIn.value, [0, 1], [ADVANCE_SLIDE_DISTANCE, 0]);
    const opacity = saindo
      ? interpolate(advanceOut.value, [0, 1], [1, ADVANCE_PARKED_OPACITY])
      : interpolate(advanceIn.value, [0, 1], [ADVANCE_PARKED_OPACITY, 1]);
    return { transform: [{ translateX }], opacity };
  });

  const destaque = opacidadeDoDestaque(priorityIndex);
  const isCompleted = display?.status === "completed";
  const seasonNumber = display?.seasonNumber ?? 1;
  const episodeNumber = display?.episodeNumber ?? 1;
  /**
   * CORREÇÃO DE CAUSA RAIZ (2026-10-14, reportado em teste real — "o
   * card da série nunca aparece"). Achada com uma consulta direta no
   * banco (`select * from list_watch_progress` voltou 0 linhas): o
   * "Assistindo juntos · Temporada 1 · Ep. 1" aparecia igual mesmo
   * ANTES de qualquer toque no botão — a 1ª versão usava os valores
   * padrão (season 1/episode 1) com a MESMA aparência do estado real
   * "em andamento", então não dava pra notar que nada tinha sido
   * marcado ainda (e por isso não existia linha nenhuma pro card da
   * série encontrar). Mockup aprovado:
   * https://claude.ai/artifact/W6JHfmJUBRn1YsRGZzQfzv — estado
   * "ainda não começou" agora é visualmente DIFERENTE (tag cinza
   * neutra + "Próximo:" no episódio), nunca igual ao "em andamento"
   * de verdade.
   */
  const hasStarted = display !== undefined;
  const code = `T${String(seasonNumber).padStart(2, "0")} | E${String(episodeNumber).padStart(2, "0")}`;

  return (
    <Glass style={styles.sharedBigCard} variant="card">
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.sharedBigTint, tintStyle]} />
      {destaque > 0 && (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={[`rgba(58,133,206,${destaque * FATOR_BRILHO_DESTAQUE})`, "rgba(58,133,206,0)"]}
            locations={[0, 0.6]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.sharedBigDestaqueBrilho}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[
              `rgba(58,133,206,${destaque * 0.75})`,
              `rgba(58,133,206,${destaque})`,
              `rgba(58,133,206,${destaque})`,
              `rgba(58,133,206,${destaque * 0.75})`,
            ]}
            locations={[0, 0.12, 0.88, 1]}
            style={styles.sharedBigDestaqueBarra}
          />
        </>
      )}

      <Animated.View style={[styles.sharedBigAdvanceContent, advanceSlideStyle]}>
        {/*
          MENU "..." MUDOU DE LUGAR (2026-10-14, mockup aprovado —
          https://claude.ai/artifact/ThspcdLkpmnrQvVQd41MMp) — o selo de
          check agora é SEMPRE o check (ver `sharedBigButtonSlot` mais
          abaixo), inclusive quando a série já está concluída, pra
          sobrar lugar pro toque-e-segura de "assistir de novo". O menu
          de opções (remover da lista) passa a abrir com toque longo no
          PÔSTER — exatamente o mesmo padrão já usado na prateleira de
          Filmes (`SharedMovieShelfItem`, acima).
        */}
        <PressableScale onPress={onPress} onLongPress={onOpenMenu} style={styles.sharedBigPosterWrap}>
          {item.posterPath ? (
            <Image source={{ uri: `https://image.tmdb.org/t/p/w185${item.posterPath}` }} style={styles.sharedBigPoster} />
          ) : (
            <View style={[styles.sharedBigPoster, styles.posterFallback]}>
              <Feather name="film" size={20} color={colors.muted} />
            </View>
          )}
        </PressableScale>

        <View style={styles.sharedBigInfo}>
          <Pressable style={styles.sharedBigPill} onPress={onPress}>
            <Text numberOfLines={1} style={styles.sharedBigPillText}>
              {item.title.toUpperCase()}
            </Text>
            <Feather name="chevron-right" size={12} color={colors.text} />
          </Pressable>

          <View style={styles.sharedBigCodeRow}>
            <Text style={styles.sharedBigCode}>{code}</Text>
            {hasStarted && !isCompleted && !!episodeInfo?.remainingInSeason && episodeInfo.remainingInSeason > 0 && (
              /* Só informativo (sem seta/sheet) — decisão do usuário, ver comentário grande em `fetchSharedEpisodeInfo`. */
              <View style={styles.sharedBigPlusBadge}>
                <Text style={styles.sharedBigPlusBadgeText}>+{episodeInfo.remainingInSeason}</Text>
              </View>
            )}
          </View>

          {/*
            NOME DO EPISÓDIO (2026-10-14, mockup aprovado — "mesma
            estética") — nome real (TMDB), igual à Home
            (`display.name` em `ContinueWatchingListRow.tsx`); cai pro
            texto genérico só se o episódio não foi encontrado na
            lista ao vivo (dado desatualizado, caso raro — nunca
            inventa um nome).
          */}
          <Text numberOfLines={1} variant="muted" style={styles.sharedBigEpisode}>
            {episodeInfo?.episodeName ??
              (hasStarted
                ? t("profile.sharedProgressEpisodeLabel", { season: seasonNumber, episode: episodeNumber })
                : t("profile.sharedProgressNextEpisodeLabel", { season: seasonNumber, episode: episodeNumber }))}
          </Text>

          {phase !== "idle" ? (
            <View style={[styles.sharedRowTag, styles.sharedRowTagCompleted]}>
              <Text style={[styles.sharedRowTagText, styles.sharedRowTagTextCompleted]}>✓ {t("episode.watched")}</Text>
              {phase === "advancing" && <ActivityIndicator size="small" color={colors.success} style={styles.sharedBigSpinner} />}
            </View>
          ) : (
            <View
              style={[
                styles.sharedRowTag,
                !hasStarted ? styles.sharedRowTagNotStarted : isCompleted ? styles.sharedRowTagCompleted : styles.sharedRowTagInProgress,
              ]}
            >
              <Text
                style={[
                  styles.sharedRowTagText,
                  !hasStarted ? styles.sharedRowTagTextNotStarted : isCompleted ? styles.sharedRowTagTextCompleted : styles.sharedRowTagTextInProgress,
                ]}
              >
                {!hasStarted ? t("profile.sharedProgressTag.notStarted") : isCompleted ? t("profile.sharedProgressTag.completed") : t("profile.sharedProgressTag.inProgress")}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/*
        SEMPRE O CHECK, MESMO CONCLUÍDA (2026-10-14, mockup aprovado —
        https://claude.ai/artifact/ThspcdLkpmnrQvVQd41MMp — ver
        comentário grande acima de `PressableScale` do pôster). Antes,
        "concluída" trocava este botão por um "•••" solto, que não
        sobrava onde prender um toque longo pra "assistir de novo" —
        por isso o selo agora fica visível (verde) pra sempre que a
        série tiver progresso, e toque-curto só avança quando NÃO está
        concluída (`handleMarkWatched` já guarda isso).
      */}
      <Animated.View style={[styles.sharedBigButtonSlot, buttonWrapperStyle]}>
        <EpisodeWatchedButton
          watched={isCompleted || phase !== "idle"}
          onPress={handleMarkWatched}
          onLongPress={handleRewind}
          disabled={phase !== "idle" || rewinding}
          size="md"
          confirmColor={colors.success}
        />
        {pulseKey > 0 && (
          <>
            <Animated.View pointerEvents="none" style={[styles.sharedBigRing, ringStyle]} />
            <View pointerEvents="none" style={styles.sharedBigParticleField}>
              {PARTICLE_ANGLES.map((angle, i) => (
                <BurstParticle key={i} angle={angle} progress={burstProgress} />
              ))}
            </View>
          </>
        )}
        <Animated.View pointerEvents="none" style={[styles.sharedBigToastAnchor, toastStyle]}>
          {toastText && (
            <View style={styles.sharedBigToastPill}>
              <Text numberOfLines={1} style={styles.sharedBigToastText}>
                {toastText}
              </Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Glass>
  );
}

/**
 * PRATELEIRA DE FILMES (2026-10-15, a pedido — "lista de filmes que
 * desliza pro lado, igual as bibliotecas", mockup Opção D aprovado:
 * https://claude.ai/artifact/MJ5sSF1aeAVguYsuabZoVf) — substitui
 * `SharedPlainRow` (linha simples sem progresso, removida: filme
 * ganhou progresso compartilhado de verdade nesta rodada). MESMA
 * dimensão/raio/borda de pôster das bibliotecas do Perfil
 * (`ProfileMediaCarousel.tsx`: 144×216, `radius.lg`, borda
 * `rgba(255,255,255,0.1)`).
 *
 * Progresso de filme é BINÁRIO (sem temporada/episódio — filme não
 * tem isso, diferente de série): o selo no canto do pôster É o botão
 * de marcar (mesmo tamanho padrão "md" do app — 32px/ícone 19px,
 * igual ao `EpisodeWatchedButton` usado no resto do app). Tocar nele
 * marca/desmarca "assistido junto"; tocar no resto do pôster abre o
 * filme; toque longo abre o menu de opções (remover da lista) — sem
 * botão visível pra essa ação na prateleira, pra não fugir do mockup
 * aprovado.
 *
 * SIMPLIFICAÇÃO DELIBERADA — sem o pulso/anel/partículas do cartão
 * grande de série (`SharedProgressRow`): a prateleira é compacta
 * demais pra essa coreografia caber sem atropelar os pôsteres
 * vizinhos; o selo aqui só pulsa sozinho, um encolhe-e-volta simples.
 *
 * Selo e pôster são IRMÃOS (não um dentro do outro) dentro de um
 * `View` com `position: relative` — mesmo padrão já usado no resto do
 * app pra selo sobre pôster (`ListCollectionCard.tsx`); dois
 * `Pressable`/`PressableScale` um DENTRO do outro (poster + selo)
 * disputariam o toque de um jeito frágil, por isso não é assim aqui.
 */
function SharedMovieShelfItem({
  item,
  progress,
  onPress,
  onLongPress,
  onToggleWatched,
  t,
}: {
  item: ListItem;
  progress: ListWatchProgress | undefined;
  onPress: () => void;
  onLongPress: () => void;
  /** Dispara a escrita real (`toggleMovieWatched` + refetch) — nunca rejeita, erro já vira `Alert` na tela-mãe. */
  onToggleWatched: () => void;
  t: (key: string) => string;
}) {
  const isWatched = progress?.status === "completed";
  const pulse = useSharedValue(1);

  function handleToggle() {
    hapticTick();
    pulse.value = withSequence(
      withTiming(1.16, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) })
    );
    onToggleWatched();
  }

  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={styles.shelfItem}>
      <View style={styles.shelfPosterFrame}>
        <PressableScale onPress={onPress} onLongPress={onLongPress} style={StyleSheet.absoluteFill}>
          {item.posterPath ? (
            <Image source={{ uri: `https://image.tmdb.org/t/p/w185${item.posterPath}` }} style={styles.shelfPoster} />
          ) : (
            <View style={[styles.shelfPoster, styles.posterFallback]}>
              <Feather name="film" size={20} color={colors.muted} />
            </View>
          )}
        </PressableScale>
        <Pressable
          hitSlop={6}
          onPress={handleToggle}
          accessibilityRole="button"
          accessibilityLabel={isWatched ? t("profile.sharedMovieMarkUnwatched") : t("profile.sharedMovieMarkWatched")}
        >
          <Animated.View style={[styles.shelfBadge, isWatched && styles.shelfBadgeDone, badgeStyle]}>
            <Feather name="check" size={19} color={isWatched ? "#FFFFFF" : "#000000"} />
          </Animated.View>
        </Pressable>
      </View>
      <Text numberOfLines={1} style={styles.shelfTitle}>
        {item.title}
      </Text>
      <View style={[styles.sharedRowTag, styles.shelfTag, isWatched ? styles.sharedRowTagCompleted : styles.sharedRowTagNotStarted]}>
        <Text style={[styles.sharedRowTagText, isWatched ? styles.sharedRowTagTextCompleted : styles.sharedRowTagTextNotStarted]}>
          {isWatched ? t("profile.sharedMovieWatchedTag") : t("profile.sharedMovieNotWatchedTag")}
        </Text>
      </View>
    </View>
  );
}

/**
 * TILE "VER MAIS"/"VER MENOS" DA PRATELEIRA (2026-10-15, a pedido —
 * "o ver todos de filmes deve ficar no formato de um poster mas vazio
 * e com um ver mais, igual feed"; mockup aprovado:
 * https://claude.ai/artifact/D4FBwJzsyxyzjH2HKwkh3z) — RÉPLICA do tile
 * "+N"/"Ver menos" de `ActivityGroupCard.tsx` (feed): mesmo tamanho do
 * pôster (`shelfPosterFrame`, 144×216), `radius.sm` (não `radius.lg`
 * dos pôsteres de verdade — mesma distinção que o feed já faz entre
 * pôster de título e tile de ação), fundo `colors.surface`, sem
 * título/tag embaixo (só o pôster muda de tamanho pra manter a
 * prateleira alinhada). Sem contagem no texto — "FILMES · N" já mostra
 * o total no selo do título da seção, diferente do "+N" do feed, que
 * não tem esse total em outro lugar.
 */
function SharedMovieMoreTile({ expanded, onPress, t }: { expanded: boolean; onPress: () => void; t: (key: string) => string }) {
  return (
    <Pressable
      style={[styles.shelfItem, styles.movieMoreTileFrame]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={expanded ? t("profile.sharedSeeLess") : t("profile.sharedSeeMore")}
    >
      <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={expanded ? colors.primary : colors.muted} />
      <Text style={[styles.movieMoreTileLabel, expanded && styles.movieMoreTileLabelLess]}>
        {expanded ? t("profile.sharedSeeLess") : t("profile.sharedSeeMore")}
      </Text>
    </Pressable>
  );
}

export default function ListDetailScreen() {
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela. Mesma conta que as telas de aba já usavam.
   */
  const espacoDoDock = useTabBarClearance();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useTranslation();
  // NOVO (2026-10-14 — "lista compartilhada parece individual", mockup
  // aprovado) — "meu próprio avatar" pro lado de dentro do avatar-stack
  // (ver `ParticipantAvatarStack` abaixo); o avatar do OUTRO participante
  // já vem de `list.coOwner`/`list.ownerProfile`, dependendo de quem sou.
  const { user: currentUser } = useCurrentUser();
  const [list, setList] = useState<UserList | null>(null);
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [isError, setIsError] = useState(false);
  const cardWidth = usePosterCardWidth();
  // LISTA COMPARTILHADA (2026-10-06) — ver
  // `claude/SEENLIST-FEATURE-2026-10-06-lista-compartilhada.md`.
  const [showInvite, setShowInvite] = useState(false);
  // REDESIGN (2026-10-07) — qual "•••" está aberto no momento. Só um
  // de cada vez: o do cabeçalho (apagar lista/sair), o do co-dono
  // (remover co-dono) e o de um pôster específico (remover item) são
  // estados independentes porque cada um tem ações diferentes.
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [coOwnerMenuOpen, setCoOwnerMenuOpen] = useState(false);
  const [activeItemMenu, setActiveItemMenu] = useState<ListItem | null>(null);
  /**
   * "VER MAIS"/"VER TODOS" (2026-10-15, a pedido — "pra essa tela não
   * ficar causando lentidão devido a enorme quantidade de titulos,
   * limita a quantidade mostrada", limite confirmado com o usuário: 6
   * pra Filmes e Séries; mockup aprovado:
   * https://claude.ai/artifact/D4FBwJzsyxyzjH2HKwkh3z) — corte é só de
   * EXIBIÇÃO (`movieItems`/`seriesItems`, já ordenados, continuam com
   * a lista inteira; só a fatia renderizada muda aqui). Estado
   * independente por seção — expandir Filmes não mexe em Séries.
   */
  const [moviesExpanded, setMoviesExpanded] = useState(false);
  const [seriesExpanded, setSeriesExpanded] = useState(false);
  // PROGRESSO COMPARTILHADO (2026-10-14, mockup aprovado — ver
  // `lib/listWatchProgress.ts`) — mapa `"{mediaType}-{mediaId}" ->
  // progresso`, carregado junto com `items`/`list` em `reload()`.
  // Independente do histórico individual (`watched`, lido na página da
  // série) — este mapa nunca toca `watched_episodes`.
  const [progressByKey, setProgressByKey] = useState<Map<string, ListWatchProgress>>(new Map());
  /**
   * NOME DO EPISÓDIO + SELO "+N" DO CARTÃO GRANDE (2026-10-14, mockup
   * aprovado — "mesma estética") — nome real do episódio marcado +
   * episódios restantes na temporada atual, batched numa chamada só
   * (`fetchSharedEpisodeInfo`) pra não repetir N+1. Chave é `mediaId`
   * (só séries têm progresso — único caso em que `mediaId` já é
   * suficiente pra identificar, sem precisar do `mediaType` no meio
   * da chave).
   */
  const [sharedEpisodeInfoByMediaId, setSharedEpisodeInfoByMediaId] = useState<Map<number, SharedEpisodeInfo>>(new Map());
  // `fetchMyLists()` só retorna listas que a RLS deixa EU ver (dono OU
  // co-dono) — se a lista veio e `isCoOwnedByMe` é falso, só pode ser
  // porque sou o dono original.
  const isOwner = list !== null && !list.isCoOwnedByMe;
  // NOVO (2026-10-14) — só conta como "2 participantes" de verdade
  // quando o convite já foi ACEITO (convite pendente continua só com
  // o comportamento de antes, sem o avatar-stack/linha secundária —
  // ainda não existem 2 pessoas participando de fato).
  const isSharedAccepted = list?.coOwner?.status === "accepted";

  /**
   * Extraído de `reload()` (abaixo) pra poder ser chamado SOZINHO de
   * dois outros lugares — o canal realtime e `handleMarkNextEpisode` —
   * sem repetir a busca de lista/itens inteira. Devolve a Promise (não
   * fire-and-forget): `handleMarkNextEpisode` precisa saber quando o
   * dado novo REALMENTE chegou antes de liberar a animação de troca de
   * conteúdo do cartão grande (`SharedProgressRow`, mesma garantia que
   * `ContinueWatchingListRow.tsx` já usa na Home).
   */
  const refreshProgress = useCallback(() => {
    return fetchListWatchProgress(id).then((map) => {
      setProgressByKey(map);
      return map;
    });
  }, [id]);

  const reload = useCallback(() => {
    setIsError(false);
    fetchMyLists()
      .then((lists) => setList(lists.find((l) => l.id === id) ?? null))
      .catch((error) => {
        console.error("[ListDetailScreen] Falha ao buscar lista", error);
        setIsError(true);
      });
    fetchListItems(id, locale)
      .then(setItems)
      .catch((error) => {
        console.error("[ListDetailScreen] Falha ao buscar itens da lista", error);
        setIsError(true);
      });
    // PROGRESSO COMPARTILHADO — suplementar, nunca derruba a tela: uma
    // falha aqui não impede ver a lista (mesmo espírito de "itens que
    // já carregaram não desaparecem por causa de uma seção a mais").
    refreshProgress().catch((error) => {
      console.error("[ListDetailScreen] Falha ao buscar progresso compartilhado", error);
    });
  }, [id, locale, refreshProgress]);

  useEffect(reload, [reload]);
  useFocusEffect(reload);

  /**
   * TEMPO REAL (2026-10-14, a pedido — "quando o outro usuário marca
   * um episódio, a alteração é visível pros 2 atualmente?") — achado
   * de causa raiz: NÃO era. `reload()` só roda ao montar/focar a tela
   * (`useEffect`/`useFocusEffect`, acima); sem canal nenhum, a outra
   * pessoa só veria a mudança saindo e voltando pra tela. Mesmo padrão
   * já usado em `app/(tabs)/feed.tsx` (`supabase.channel(...).on(
   * "postgres_changes", ...)`) — filtra por `list_id` pra não competir
   * com o canal geral do Feed nem reagir a progresso de OUTRAS listas.
   * Refetch só do progresso (não a lista/itens inteiros) — suficiente
   * pro que mudou e mais barato que repetir `reload()` inteiro.
   */
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-list-progress-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "list_watch_progress", filter: `list_id=eq.${id}` },
        () => {
          refreshProgress().catch((error) => {
            console.error("[ListDetailScreen] Falha ao buscar progresso compartilhado (realtime)", error);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, refreshProgress]);

  /**
   * NOME DO EPISÓDIO + SELO "+N" (ver comentário grande no estado,
   * acima) — recalcula sempre que `items` ou `progressByKey` mudam
   * (inclui o refetch do realtime). Roda pra TODA série da lista,
   * inclusive "ainda não começou" (assume T1·Ep.1, mesmo alvo que
   * `markNextEpisode` grava na 1ª marcação) — é o que alimenta o
   * nome real do episódio no card, mostrado mesmo antes de qualquer
   * toque (mockup aprovado).
   */
  useEffect(() => {
    if (!items || items.length === 0) return;
    const entries = items
      .filter((item): item is ListItem & { mediaType: "series" } => item.mediaType === "series")
      .map((item) => {
        const itemProgress = progressByKey.get(`${item.mediaType}-${item.mediaId}`);
        const seasonNumber = itemProgress?.seasonNumber ?? 1;
        const episodeNumber = itemProgress?.episodeNumber ?? 1;
        return { mediaId: item.mediaId, seasonNumber, episodeNumber };
      });

    if (entries.length === 0) {
      setSharedEpisodeInfoByMediaId(new Map());
      return;
    }
    let cancelled = false;
    fetchSharedEpisodeInfo(entries)
      .then((map) => {
        if (!cancelled) setSharedEpisodeInfoByMediaId(map);
      })
      .catch((error) => {
        console.error("[ListDetailScreen] Falha ao calcular nome do episódio/episódios restantes na temporada", error);
      });
    return () => {
      cancelled = true;
    };
  }, [items, progressByKey]);

  /**
   * FASE 2 (consistência visual sistêmica, Task 9 "ações e feedback",
   * 2026-09-26) — achado real: sem haptic e sem tratamento de erro —
   * uma falha na rede não avisava nada, o item só continuava ali sem
   * explicação. Critério do próprio usuário ("ação reversível e de
   * baixo impacto → feedback imediato"): continua SEM confirmação (é
   * reversível, dá pra adicionar de novo) — só ganhou o haptic que
   * toda outra ação rápida do app já tem, e um aviso quando falha.
   *
   * REDESIGN (2026-10-07) — comportamento (haptic, sem confirmação,
   * alerta de erro) preservado 1:1; só mudou QUEM chama esta função
   * (antes: `onPress` direto do "X"; agora: ação dentro do
   * `OptionSheet` do pôster).
   */
  function handleRemove(itemId: string) {
    hapticTick();
    removeFromList(itemId)
      .then(reload)
      .catch((error) => {
        console.error("[ListDetailScreen] Falha ao remover item da lista", error);
        Alert.alert(t("error.generic"), t("common.tryAgainShortly"));
      });
  }

  function handleDeleteList() {
    Alert.alert(t("profile.deleteListTitle"), t("profile.deleteListMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("social.delete"),
        style: "destructive",
        onPress: () => deleteList(id).then(() => router.replace("/lists")),
      },
    ]);
  }

  // LISTA COMPARTILHADA (2026-10-06) — dono remove o co-dono (aceito
  // ou ainda pendente — mesma ação do ponto de vista do banco: zera os
  // dois campos). Itens que o co-dono adicionou ficam na lista.
  function handleRemoveCoOwner() {
    if (!list?.coOwner) return;
    const name = list.coOwner.displayName ?? `@${list.coOwner.username}`;
    Alert.alert(t("profile.removeCoOwnerTitle", { name }), t("profile.removeCoOwnerMessage", { name }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.removeCoOwnerAction"),
        style: "destructive",
        onPress: () =>
          removeCoOwner(id, list.name, list.coOwner!.userId)
            .then(reload)
            .catch((error) => {
              console.error("[ListDetailScreen] Falha ao remover co-dono", error);
              Alert.alert(t("error.generic"), t("common.tryAgainShortly"));
            }),
      },
    ]);
  }

  // Co-dono sai por conta própria. Não apaga a lista nem os itens que já adicionou.
  function handleLeaveSharedList() {
    if (!list) return;
    Alert.alert(t("profile.leaveSharedListTitle"), t("profile.leaveSharedListMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.leaveSharedListAction"),
        style: "destructive",
        onPress: () =>
          leaveSharedList(id, list.name, list.ownerId)
            .then(() => router.replace("/lists"))
            .catch((error) => {
              console.error("[ListDetailScreen] Falha ao saír da lista compartilhada", error);
              Alert.alert(t("error.generic"), t("common.tryAgainShortly"));
            }),
      },
    ]);
  }

  // PROGRESSO COMPARTILHADO — botão "Marcar próximo episódio" (só
  // séries, só lista compartilhada aceita). Nunca escreve em
  // `watched_episodes` — ver comentário grande em `markNextEpisode`.
  /**
   * CORREÇÃO (2026-10-14, "mesmas funções e animações" da Home) — o
   * `hapticTick()` saiu daqui e foi pro MOMENTO do toque, dentro de
   * `SharedProgressRow.handleMarkWatched` (mesma convenção da Home:
   * feedback no toque, não na resposta da rede). `setMarkingItemId`
   * saiu de vez — o cartão agora controla seu próprio "ocupado" via a
   * fase da animação (`phase !== "idle"`), sem round-trip pelo pai.
   *
   * Devolve `Promise<boolean>` (nunca rejeita) — `SharedProgressRow`
   * precisa saber QUANDO o progresso novo chegou de verdade antes de
   * liberar o slide de troca de conteúdo (mesma garantia da Home,
   * `onMarkedWatched` em `ContinueWatchingListRow.tsx`); `refreshProgress()`
   * (não `reload()` inteiro) já atualiza `progressByKey`, e só
   * devolvemos depois que essa atualização foi de fato disparada.
   */
  function handleMarkNextEpisode(item: ListItem): Promise<boolean> {
    const current = progressByKey.get(`${item.mediaType}-${item.mediaId}`);
    return markNextEpisode(id, item.mediaId, current)
      .then(() => refreshProgress())
      .then(() => true)
      .catch((error) => {
        console.error("[ListDetailScreen] Falha ao marcar próximo episódio compartilhado", error);
        Alert.alert(t("error.generic"), t("common.tryAgainShortly"));
        return false;
      });
  }

  /** Ver `rewindEpisode` (`lib/listWatchProgress.ts`) e `onRewindEpisode`/`handleRewind` em `SharedProgressRow`, acima — mesmo contrato (`Promise<boolean>`, nunca rejeita) de `handleMarkNextEpisode`. */
  function handleRewindEpisode(item: ListItem): Promise<boolean> {
    const current = progressByKey.get(`${item.mediaType}-${item.mediaId}`);
    return rewindEpisode(id, item.mediaId, current)
      .then(() => refreshProgress())
      .then(() => true)
      .catch((error) => {
        console.error("[ListDetailScreen] Falha ao voltar episódio compartilhado", error);
        Alert.alert(t("error.generic"), t("common.tryAgainShortly"));
        return false;
      });
  }

  // PRATELEIRA DE FILMES (2026-10-15) — binário, sem round-trip de "próximo episódio" (não existe pra filme). O haptic já roda no toque, dentro de `SharedMovieShelfItem.handleToggle` — aqui só a escrita + refetch.
  function handleToggleMovieWatched(item: ListItem) {
    const current = progressByKey.get(`${item.mediaType}-${item.mediaId}`);
    const currentlyWatched = current?.status === "completed";
    toggleMovieWatched(id, item.mediaId, currentlyWatched)
      .then(() => refreshProgress())
      .catch((error) => {
        console.error("[ListDetailScreen] Falha ao marcar filme assistido junto", error);
        Alert.alert(t("error.generic"), t("common.tryAgainShortly"));
      });
  }

  const isLoading = items === null && !isError;
  /**
   * SEÇÕES "FILMES"/"SÉRIES" (2026-10-15, a pedido — "quando for
   * adicionado filme e série, automáticamente aja uma divisão",
   * mockup aprovado: https://claude.ai/artifact/MJ5sSF1aeAVguYsuabZoVf)
   * — só usadas na lista compartilhada aceita (`isSharedAccepted`,
   * ver abaixo); a grade normal de 3 colunas (lista pessoal) continua
   * sem seção nenhuma, mistura os dois tipos como sempre.
   *
   * `useMemo` (não filtro solto) porque agora também ORDENA (ver
   * `ordenarPorProgressoCompartilhado`, acima) — precisa recalcular
   * quando `items` OU `progressByKey` mudam (ex.: marcar assistido não
   * muda `items`, só o progresso — sem a dependência certa o reorder
   * não aconteceria até o próximo `reload()`).
   */
  const movieItems = useMemo(
    () => ordenarPorProgressoCompartilhado(items?.filter((item) => item.mediaType === "movie") ?? [], progressByKey),
    [items, progressByKey]
  );
  const seriesItems = useMemo(
    () => ordenarPorProgressoCompartilhado(items?.filter((item) => item.mediaType === "series") ?? [], progressByKey),
    [items, progressByKey]
  );

  return (
    <Screen padded={false}>
      {/*
        CORREÇÃO (bug real, causa raiz encontrada — 2026-10-15, a pedido
        — "essa linha fica apenas depois de 'minhas listas' lá em cima,
        deveria funcionar assim no app todo") — a mancha de luz ambiente
        (`AmbientGlow`/`SUBPAGE_GLOW_BLOBS`) tem posição FIXA (`top: 40`
        pra primeira mancha) relativa ao `GlassTargetProvider` que a
        contém, não à tela inteira. Em TODAS as outras 5 telas que usam
        este mesmo array de manchas (`lists/index.tsx` — "Minhas listas"
        — entre elas) o `ScreenHeader` fica DENTRO do `GlassTargetProvider`,
        então a mancha nasce logo abaixo do título, sempre no mesmo
        lugar relativo. Só aqui o `GlassTargetProvider` abria DEPOIS do
        `ScreenHeader`+`metaRow` (sem nenhum comentário explicando — não
        foi decisão documentada, foi inconsistência) — a mancha nascia
        relativa ao INÍCIO DO CONTEÚDO, não ao topo da tela, caindo cada
        vez num lugar diferente dependendo de quanto cabeçalho/metaRow
        tinha acima (foi isso que fez o anel de banding (ver comentário
        grande em `Glass.tsx`, "DITHER — CAUSA RAIZ") aparecer bem em
        cima da pílula "FILMES" depois da seção nova). Movido o
        `GlassTargetProvider` pra envolver ScreenHeader+metaRow também,
        igual às outras 5 telas — a mancha agora nasce no mesmo lugar
        relativo (logo abaixo do título) em qualquer tela que a use.
      */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
      <ScreenHeader
        title={list?.name ?? t("profile.listFallbackName")}
        /*
         * CORREÇÃO (2026-10-14, "uma inconsistência" — mockup aprovado:
         * https://claude.ai/artifact/MJ5sSF1aeAVguYsuabZoVf) — tirou a
         * linha "Lista compartilhada · N participantes" (texto embaixo,
         * ver `metaRow`/`sharedSubText` mais abaixo — virou redundante
         * depois do selo azul) e trocou por este selo, MESMO ícone/cor
         * usados dentro dos pôsteres (`ListCollectionCard.tsx`/
         * `ProfileListsPreview.tsx`: `colors.info`, Feather "users"),
         * agora ao lado do nome. Só accepted — convite ainda pendente
         * continua sinalizado só pela pill âmbar no `metaRow` (sem
         * duplicar o selo pros dois estados).
         *
         * HISTÓRICO — entre 2026-10-15 e 2026-10-15 esta prop também
         * carregou, por um tempo, a pill "2 avatares + nome" do
         * participante já aceito (mockup
         * https://claude.ai/artifact/QdY7rqJkotTpkwdC6XPqNn). Essa pill
         * SAIU DE NOVO daqui no mesmo dia (a pedido — "tira esse o
         * bullet [...] de la de cima, e move pra dentro do sheet",
         * mockup aprovado:
         * https://claude.ai/artifact/JmRnR3ekXzJpiG9LWFicU8): os 2
         * participantes (dono "(admin)" + quem foi adicionado) agora
         * vivem dentro do sheet "•••" (ver `headerMenuOpen`, mais
         * abaixo), não mais soltos no cabeçalho. `titleIcon` volta a
         * ser só o selo azul, sem filho nenhum.
         */
        titleIcon={
          isSharedAccepted ? (
            <View style={styles.titleSharedBadge}>
              <Feather name="users" size={12} color="#fff" />
            </View>
          ) : undefined
        }
        /*
         * REDESIGN (2026-10-07) — era um ícone de ação direto
         * (lixeira pro dono, "sair" pro co-dono). Os DOIS viram o
         * mesmo "•••" — abre o `OptionSheet` com a ação certa pro
         * papel de quem está vendo (ver abaixo). Nenhuma permissão
         * mudou: quem podia apagar continua só podendo apagar, quem
         * podia sair continua só podendo sair.
         */
        right={
          isOwner || (list?.isCoOwnedByMe && list.coOwner?.status === "accepted") ? (
            <Pressable onPress={() => setHeaderMenuOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("profile.moreOptions")}>
              <Feather name="more-horizontal" size={20} color={colors.muted} />
            </Pressable>
          ) : undefined
        }
      />

      {/*
        POLISH (2026-10-07, rodada 2 — "a área superior está um pouco
        fragmentada") — "3 títulos" e a pill de co-dono viram uma linha
        só (`space-between`), em vez de duas linhas empilhadas. Os dois
        lados são independentes de propósito (`metaLeft` só aparece
        quando `items` carrega; a pill só depende de `list`/`isOwner`)
        pra pill não "esperar" os itens carregarem pra aparecer — isso
        não é mudança de comportamento, só evita que o layout pule.
      */}
      {(list || isOwner) && (
        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            {list && items !== null && (
              <Text variant="muted" style={styles.countText}>
                {items.length === 1 ? t("profile.oneListItem") : t("profile.listItemsCount", { count: items.length })}
              </Text>
            )}
            {/*
              REMOVIDO (2026-10-14, "uma inconsistência" — mockup
              aprovado: https://claude.ai/artifact/MJ5sSF1aeAVguYsuabZoVf)
              — a linha "Lista compartilhada · N participantes" que
              vivia aqui era redundante: a mesma informação já aparece
              no selo azul ao lado do nome (`titleIcon`, acima, no
              `ScreenHeader`). Mantido só "1 título"/"N títulos", acima.
            */}
          </View>
          {/*
            LISTA COMPARTILHADA (2026-10-06) — pill de AÇÃO (convidar/
            remover participante) continua só pro DONO (co-dono não tem
            direito sobre a lista em si, só sobre os itens — decisão
            confirmada, preservada igual nesta rodada).
            POLISH (2026-10-07, rodada 2 — "chamando atenção demais,
            pill âmbar virou o 2º elemento mais importante da tela") —
            fundo neutro (`colors.surface`+`colors.border`, não mais
            `tint.subtle` âmbar) e texto `muted`; o âmbar sobra só no
            ícone de convite (único "toque" de cor aqui).
            MOVIDO (2026-10-15, a pedido — ver comentário grande no
            `titleIcon` do `ScreenHeader`, acima) — a pill do estado JÁ
            ACEITO (dono com co-dono aceito, e a versão só-leitura do
            participante) saiu daqui. Só sobram aqui os DOIS estados
            "ainda não confirmados": pendente (dono, convite mandado mas
            não aceito) e "convidar" (dono, sem co-dono nenhum) — "3
            títulos" (`metaLeft`, acima) fica sozinho, direto abaixo do
            nome da lista, assim que a pill sai daqui no estado aceito.
          */}
          {isOwner &&
            (list?.coOwner ? (
              list.coOwner.status === "accepted" ? null : (
                <Pressable style={styles.coOwnerPill} onPress={() => setCoOwnerMenuOpen(true)}>
                  <ParticipantAvatarStack
                    stacked={false}
                    selfAvatarUrl={currentUser?.avatarUrl ?? null}
                    selfName={currentUser?.name ?? "Você"}
                    otherAvatarUrl={list.coOwner.avatarUrl}
                    otherName={list.coOwner.displayName ?? list.coOwner.username}
                  />
                  <Text numberOfLines={1} style={styles.coOwnerPillText}>
                    {t("profile.coOwnerPendingBadge")}
                  </Text>
                </Pressable>
              )
            ) : (
              <Pressable style={styles.coOwnerPill} onPress={() => setShowInvite(true)}>
                <Feather name="user-plus" size={13} color={colors.primary} />
                <Text style={styles.invitePillText}>{t("profile.invitePillLabel")}</Text>
              </Pressable>
            ))}
        </View>
      )}

      {showInvite && list && (
        <InviteCoOwnerSheet listId={id} listName={list.name} onClose={() => setShowInvite(false)} onInvited={reload} />
      )}

      {/*
        PARTICIPANTES MOVIDOS PRA DENTRO DESTE SHEET (2026-10-15, a
        pedido — "tira esse o bullet [...] de la de cima, e move pra
        dentro do sheet", mockup aprovado:
        https://claude.ai/artifact/JmRnR3ekXzJpiG9LWFicU8) — antes, o
        selo "2 avatares + nome" ficava solto ao lado do ícone azul no
        cabeçalho (`titleIcon`, acima), e só abria um 2º sheet
        (`coOwnerMenuOpen`) com a ação "Remover". Agora os 2
        participantes (dono com "(admin)", depois quem foi adicionado)
        aparecem DIRETO dentro deste mesmo sheet "•••" — tocar na pessoa
        adicionada já dispara a confirmação (`handleRemoveCoOwner`, que
        já mostra seu próprio `Alert.alert` — nenhuma lógica de remoção
        mudou, só o caminho até ela). Não é mais o `OptionSheet`
        genérico (sem suporte a linha com avatar) — vira um sheet
        próprio, mesmo visual (`Glass variant="dark"`, mesmos raios/
        paddings) que `OptionSheet.tsx` já usa, pra não destoar.
        `coOwnerMenuOpen` continua existindo só pro pill de CONVITE
        PENDENTE no `metaRow` (cancelar convite ainda não aceito) —
        esse não fazia parte do pedido.
      */}
      {headerMenuOpen && list && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setHeaderMenuOpen(false)}>
          <Pressable style={styles.participantsOverlay} onPress={() => setHeaderMenuOpen(false)}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <Glass style={[styles.participantsSheet, { paddingBottom: spacing.lg + insets.bottom }]} variant="dark">
                <Text variant="subtitle" style={styles.participantsSheetTitle}>
                  {list.name}
                </Text>

                {isSharedAccepted && (
                  <>
                    <Text style={styles.participantsSectionLabel}>{t("profile.participantsLabel")}</Text>
                    <View style={styles.participantsList}>
                      {/* Defensivo igual ao código antigo desta mesma condição (`!isOwner && list?.ownerProfile`) — some a linha do dono em vez de mostrar "@undefined" no caso raro de `ownerProfile` ainda não ter chegado pro participante. */}
                      {(isOwner || list.ownerProfile) && (
                        <View style={styles.participantRow}>
                          <Avatar
                            uri={isOwner ? (currentUser?.avatarUrl ?? null) : (list.ownerProfile?.avatarUrl ?? null)}
                            name={isOwner ? (currentUser?.name ?? "Você") : (list.ownerProfile?.displayName ?? list.ownerProfile?.username ?? "?")}
                            style={styles.participantAvatar}
                            textStyle={styles.coOwnerAvatarInitials}
                          />
                          <Text numberOfLines={1} style={styles.participantName}>
                            {isOwner ? (currentUser?.name ?? t("profile.you")) : (list.ownerProfile?.displayName ?? `@${list.ownerProfile?.username}`)}
                          </Text>
                          <Text style={styles.participantAdminTag}>{t("profile.participantAdminTag")}</Text>
                        </View>
                      )}

                      {list.coOwner &&
                        (isOwner ? (
                          <Pressable
                            style={({ pressed }) => [styles.participantRow, pressed && styles.participantRowPressed]}
                            onPress={() => {
                              setHeaderMenuOpen(false);
                              handleRemoveCoOwner();
                            }}
                          >
                            <Avatar
                              uri={list.coOwner.avatarUrl}
                              name={list.coOwner.displayName ?? list.coOwner.username}
                              style={styles.participantAvatar}
                              textStyle={styles.coOwnerAvatarInitials}
                            />
                            <Text numberOfLines={1} style={styles.participantName}>
                              {list.coOwner.displayName ?? `@${list.coOwner.username}`}
                            </Text>
                          </Pressable>
                        ) : (
                          <View style={styles.participantRow}>
                            <Avatar uri={currentUser?.avatarUrl ?? null} name={currentUser?.name ?? "Você"} style={styles.participantAvatar} textStyle={styles.coOwnerAvatarInitials} />
                            <Text numberOfLines={1} style={styles.participantName}>
                              {currentUser?.name ?? t("profile.you")}
                            </Text>
                          </View>
                        ))}
                    </View>
                  </>
                )}

                <View style={styles.participantsActions}>
                  <Pressable
                    style={styles.participantsActionButton}
                    onPress={() => {
                      setHeaderMenuOpen(false);
                      if (isOwner) handleDeleteList();
                      else handleLeaveSharedList();
                    }}
                  >
                    <Text style={styles.participantsActionTextDanger}>{isOwner ? t("profile.deleteListAction") : t("profile.leaveSharedListAction")}</Text>
                  </Pressable>
                </View>

                <Pressable style={styles.participantsCancelButton} onPress={() => setHeaderMenuOpen(false)}>
                  <Feather name="x" size={16} color={colors.muted} />
                  <Text variant="muted">{t("common.cancel")}</Text>
                </Pressable>
              </Glass>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {coOwnerMenuOpen && list?.coOwner && (
        <OptionSheet
          title={list.coOwner.displayName ?? `@${list.coOwner.username}`}
          onDismiss={() => setCoOwnerMenuOpen(false)}
          actions={[
            {
              label: t("profile.removeCoOwnerAction"),
              danger: true,
              onPress: () => {
                setCoOwnerMenuOpen(false);
                handleRemoveCoOwner();
              },
            },
          ]}
        />
      )}

      {activeItemMenu && (
        <OptionSheet
          title={activeItemMenu.title}
          onDismiss={() => setActiveItemMenu(null)}
          actions={[
            {
              label: t("profile.removeFromListAction"),
              danger: true,
              onPress: () => {
                const itemId = activeItemMenu.id;
                setActiveItemMenu(null);
                handleRemove(itemId);
              },
            },
          ]}
        />
      )}

      {isLoading ? (
        <View style={[styles.content, styles.grid]}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ width: cardWidth }}>
              {/* REDESIGN (2026-10-07) — altura calculada a partir do MESMO `cardWidth`/aspect ratio 2:3 do pôster real (era 160 fixo, não acompanhava a largura real da coluna). */}
              <Skeleton width={cardWidth} height={Math.round(cardWidth * 1.5)} borderRadius={radius.poster} />
            </View>
          ))}
        </View>
      ) : isError ? (
        <PageError message={t("error.loadListFailed")} onRetry={reload} />
      ) : isSharedAccepted ? (
        /*
          SEÇÕES "FILMES"/"SÉRIES" (2026-10-15, mockup aprovado — ver
          comentário grande em `movieItems`/`seriesItems`, acima).
          Trocado `FlatList` por `ScrollView` só neste ramo — a
          prateleira horizontal de filmes e a lista vertical de séries
          são duas formas de rolagem diferentes dentro da MESMA tela,
          o que não dá pra expressar com uma única `FlatList` (`numColumns`
          é por lista inteira, não por seção). Listas tipicamente
          pequenas aqui (poucos títulos por lista compartilhada) — sem
          virtualização não é um problema real de performance.
        */
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}>
          {movieItems.length === 0 && seriesItems.length === 0 ? (
            <EmptyShelf icon="film" message={t("profile.emptyListMessage")} />
          ) : (
            <>
              {movieItems.length > 0 && (
                <>
                  {/*
                    A PEDIDO (2026-10-15 — "agora deixa igual series/home,
                    deixa no meio da tela, com um bullet") — era um cabeçalho
                    alinhado à esquerda (rótulo + pílula de contagem + linha).
                    Trocado pela MESMA `SectionTitle` (pílula de vidro) usada
                    nos rótulos de dia da seção "Em breve" (Séries/Home,
                    `jaMontouEmBreve` acima), centralizada do mesmo jeito
                    (`alignItems: "center"` no wrapper) — rótulo e contagem
                    juntos no mesmo texto, separados por "·".
                  */}
                  <View style={styles.sectionPillWrapper}>
                    <SectionTitle>{`${t("nav.movies")} · ${movieItems.length}`}</SectionTitle>
                  </View>
                  {/*
                    "VER MAIS" (2026-10-15) — ver comentário grande nos
                    `useState` de `moviesExpanded`, acima. O tile final
                    some sozinho quando `movieItems.length <=
                    SECTION_DISPLAY_LIMIT` (`hasMoreMovies` falso) — sem
                    isso, uma lista pequena ganharia um tile "Ver mais"
                    que não teria o que mostrar a mais.
                  */}
                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={moviesExpanded ? movieItems : movieItems.slice(0, SECTION_DISPLAY_LIMIT)}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.shelfRow}
                    renderItem={({ item }) => (
                      <SharedMovieShelfItem
                        item={item}
                        progress={progressByKey.get(`${item.mediaType}-${item.mediaId}`)}
                        onPress={() => router.push(`/movies/${item.mediaId}`)}
                        onLongPress={() => setActiveItemMenu(item)}
                        onToggleWatched={() => handleToggleMovieWatched(item)}
                        t={t}
                      />
                    )}
                    ListFooterComponent={
                      movieItems.length > SECTION_DISPLAY_LIMIT ? (
                        <SharedMovieMoreTile expanded={moviesExpanded} onPress={() => setMoviesExpanded((v) => !v)} t={t} />
                      ) : undefined
                    }
                  />
                </>
              )}

              {seriesItems.length > 0 && (
                <>
                  <View style={[styles.sectionPillWrapper, movieItems.length > 0 && styles.sectionHeadSpaced]}>
                    <SectionTitle>{`${t("nav.series")} · ${seriesItems.length}`}</SectionTitle>
                  </View>
                  {/*
                    "VER TODOS" (2026-10-15) — mesmo corte/lógica da
                    prateleira de Filmes (ver comentário grande acima),
                    só que a Série vira linha vertical normal: o botão
                    (`ViewAllButton`, reaproveitado — ver comentário
                    novo nele) fica embaixo da lista, não dentro dela.
                  */}
                  {(seriesExpanded ? seriesItems : seriesItems.slice(0, SECTION_DISPLAY_LIMIT)).map((item, index) => (
                    <SharedProgressRow
                      key={item.id}
                      item={item}
                      progress={progressByKey.get(`${item.mediaType}-${item.mediaId}`)}
                      onPress={() => router.push(`/series/${item.mediaId}`)}
                      onMarkNextEpisode={() => handleMarkNextEpisode(item)}
                      onRewindEpisode={() => handleRewindEpisode(item)}
                      onOpenMenu={() => setActiveItemMenu(item)}
                      // FAIXA DE DESTAQUE (ver comentário grande em `OPACIDADE_DESTAQUE`) — ranqueia só ENTRE séries (filme tem sua própria seção, sem faixa); só com mais de 1 série, com 1 só não há o que ranquear.
                      priorityIndex={seriesItems.length > 1 ? index : undefined}
                      episodeInfo={sharedEpisodeInfoByMediaId.get(item.mediaId)}
                      t={t}
                    />
                  ))}
                  {seriesItems.length > SECTION_DISPLAY_LIMIT && (
                    <ViewAllButton
                      label={seriesExpanded ? t("profile.sharedSeeLess") : t("profile.sharedSeriesSeeAll", { count: seriesItems.length })}
                      icon={seriesExpanded ? "chevron-up" : "chevron-down"}
                      onPress={() => setSeriesExpanded((v) => !v)}
                    />
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}
          columnWrapperStyle={styles.gridRow}
          ListEmptyComponent={<EmptyShelf icon="film" message={t("profile.emptyListMessage")} />}
          renderItem={({ item }) => (
            <View style={{ width: cardWidth }}>
              {/* REDESIGN (2026-10-07) — pôster saiu do `<Glass>` (era o mesmo excesso que a grade de "Minhas listas" já tinha removido); agora é `Image` pura com `radius.poster`. */}
              <PressableScale
                onPress={() => router.push(item.mediaType === "movie" ? `/movies/${item.mediaId}` : `/series/${item.mediaId}`)}
              >
                <View style={styles.poster}>
                  {item.posterPath ? (
                    <Image source={{ uri: `https://image.tmdb.org/t/p/w342${item.posterPath}` }} style={styles.posterImage} />
                  ) : (
                    <View style={styles.posterFallback}>
                      <Feather name="film" size={20} color={colors.muted} />
                    </View>
                  )}
                </View>
              </PressableScale>
              {/*
                REDESIGN (2026-10-07) — principal ponto da rodada: o
                "X" permanente virou um "•••" discreto (`scrim.control`,
                chip pequeno, sem círculo grande) que abre o mesmo
                `OptionSheet` usado em `PostCard.tsx`/episódio pra
                "Remover da lista" — sem confirmação extra (igual ao
                comportamento anterior do "X"), haptic/erro preservados
                em `handleRemove`.
              */}
              <Pressable
                hitSlop={8}
                style={styles.itemMenuButton}
                onPress={() => setActiveItemMenu(item)}
                accessibilityRole="button"
                accessibilityLabel={t("profile.moreOptions")}
              >
                <Feather name="more-horizontal" size={10} color="rgba(255,255,255,0.8)" />
              </Pressable>
            </View>
          )}
        />
      )}
      </GlassTargetProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  glassFill: {
    flex: 1,
  },
  // POLISH (2026-10-07, rodada 2) — "3 títulos" + pill de co-dono na
  // mesma linha, `space-between`, logo abaixo do `ScreenHeader`.
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: -spacing.xs,
    paddingBottom: spacing.sm,
  },
  metaLeft: {
    flexShrink: 1,
  },
  countText: {
    fontSize: fontSize.xs,
  },
  /**
   * CONTAINER DO SELO + PILL DE PARTICIPANTE (2026-10-15) — ver
   * comentário grande no `titleIcon` do `ScreenHeader`, acima. SEM
   * `flexShrink` (fica no padrão 0 do RN/Yoga) de propósito — é o
   * `title` (`flexShrink: 1` em `ScreenHeader.tsx`) quem cede espaço
   * primeiro quando o nome da lista é longo, nunca este grupo.
   */
  /**
   * SELO AO LADO DO NOME DA LISTA (2026-10-14) — substitui o que era
   * `sharedSubText` (removido, ver comentário grande no `ScreenHeader`
   * acima). MESMO visual do selo dentro do pôster
   * (`ListCollectionCard.tsx`/`ProfileListsPreview.tsx`: círculo azul
   * chapado `colors.info`, borda escura, sombra), só que fora de cima
   * de uma imagem — a borda escura perde a função de contraste aqui,
   * mas foi mantida mesmo assim por ser "o mesmo selo", não um desenho
   * novo.
   */
  titleSharedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.info,
    borderWidth: 1.5,
    borderColor: "rgba(5,7,11,0.55)",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  // POLISH (2026-10-07, rodada 2 — "não quero uma pill âmbar
  // chamativa") — fundo neutro (era `tint.subtle`, âmbar 12%); o
  // âmbar sobra só no ícone `user-plus` do estado "convidar".
  coOwnerPill: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  // CORREÇÃO (bug real, reportado com print — avatar do participante
  // aparecia QUADRADO na pill) — faltava `overflow: "hidden"`. O
  // `Avatar` (`components/common/Avatar.tsx`) só aplica o estilo
  // passado na `View` externa; sem `overflow: "hidden"` nela, o
  // `borderRadius` não recorta a `<Image>` de dentro (ela preenche
  // 100%x100% por cima, ignorando o raio) — só a borda externa da
  // `View` ficava arredondada. Único lugar deste arquivo com esse
  // esquecimento; os outros estilos de avatar do app já incluem isso.
  coOwnerAvatar: { width: 20, height: 20, borderRadius: 10, overflow: "hidden" },
  coOwnerAvatarInitials: { fontSize: fontSize.micro },
  // NOVO (2026-10-14) — avatares sobrepostos (mockup aprovado). O 2º avatar (o "outro" participante) nasce na frente do 1º (ordem de render = ordem de empilhamento no RN) com margem negativa pra sobrepor, e uma borda na cor do fundo da pill pra separar visualmente os dois círculos.
  avatarStack: { flexDirection: "row" },
  avatarStackAvatar: { width: 20, height: 20, borderRadius: 10, overflow: "hidden", borderWidth: 1.5, borderColor: colors.surface },
  avatarStackOverlap: { marginLeft: -8 },
  coOwnerPillText: { fontSize: fontSize.xs, fontWeight: "500", color: colors.muted, flexShrink: 1 },
  invitePillText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.muted },
  /*
    SHEET DE PARTICIPANTES (2026-10-15) — ver comentário grande junto
    do `Modal` no JSX. Overlay/sheet/cancelButton copiam valor a valor
    o que `OptionSheet.tsx` já usa (mesmo raio, mesmo padding, mesmo
    `scrim.modal`) — só o conteúdo de dentro é novo, pra não destoar
    visualmente do resto dos sheets do app.
  */
  participantsOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: scrim.modal,
  },
  participantsSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
  },
  participantsSheetTitle: {
    textAlign: "center",
  },
  participantsSectionLabel: {
    marginTop: spacing.md,
    fontSize: fontSize.xxs,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.muted,
  },
  participantsList: {
    marginTop: spacing.xs,
    gap: 2,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
  },
  participantRowPressed: {
    backgroundColor: tint.subtle,
  },
  participantAvatar: { width: 36, height: 36, borderRadius: 18, overflow: "hidden" },
  participantName: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  participantAdminTag: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.primary,
    flexShrink: 0,
  },
  participantsActions: {
    marginTop: spacing.md,
  },
  participantsActionButton: {
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  participantsActionTextDanger: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.danger,
  },
  participantsCancelButton: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: POSTER_GRID_GAP,
  },
  gridRow: {
    gap: POSTER_GRID_GAP,
    marginBottom: POSTER_GRID_GAP,
  },
  // REDESIGN (2026-10-07) — era `<Glass>` (borda + blur + gradiente);
  // agora só pinta o fallback (`colors.surface`) atrás da imagem,
  // igual ao padrão de `ListCollectionCard.tsx` (mosaico de "Minhas
  // listas", mesma decisão de "pôster como protagonista").
  poster: {
    aspectRatio: 2 / 3,
    borderRadius: radius.poster,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  posterImage: { width: "100%", height: "100%" },
  posterFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // REDESIGN (2026-10-07) — substitui `removeButtonWrap`/`removeButton`
  // (círculo de 24×24 sempre visível). A pedido explícito ("não crie
  // um botão grande/círculo chamativo") — chip pequeno (`radius.sm`,
  // não `radius.full`).
  // POLISH (2026-10-07, rodada 2 — "ainda estão visualmente fortes,
  // especialmente 3 repetidos lado a lado") — menor ainda (18→15) e
  // fundo mais transparente que `scrim.control` (que é 75% opaco, bom
  // pra um botão sozinho sobre imagem, forte demais repetido 3×);
  // ícone também perde um pouco de opacidade. "Encontrado quando
  // procurado, não percebido antes das capas" — ainda com contraste
  // suficiente pra continuar utilizável (tamanho de toque real
  // continua 18×18 via `hitSlop`, só o visual encolheu).
  itemMenuButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 15,
    height: 15,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11,14,20,0.4)",
  },
  /**
   * SEÇÕES "FILMES"/"SÉRIES" (2026-10-15, mockup aprovado; CORREÇÃO
   * 2026-10-15 a pedido — "deixa igual series/home, no meio da tela,
   * com um bullet" — era um rótulo alinhado à esquerda com selo de
   * contagem + linha divisória; agora é a MESMA pílula de vidro
   * (`SectionTitle`) usada pelos rótulos de dia da seção "Em breve"
   * em Séries/Home, centralizada (`alignItems: "center"`), com rótulo
   * + contagem no mesmo texto separados por "·" — mesmo separador já
   * usado em metadados de episódio, ver `SeasonAccordion.tsx`). Só na
   * lista compartilhada aceita (ver `isSharedAccepted`, acima — a
   * grade normal de 3 colunas não usa seção nenhuma).
   */
  sectionPillWrapper: {
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionHeadSpaced: {
    marginTop: spacing.lg,
  },
  /**
   * PRATELEIRA DE FILMES (2026-10-15) — mesma dimensão/raio/borda de
   * pôster das bibliotecas do Perfil (`ProfileMediaCarousel.tsx`:
   * 144×216, `radius.lg`, borda branca 10%); a trilha sangra até a
   * borda da tela igual lá (`contentContainerStyle` com o respiro, não
   * a `section` em si).
   */
  shelfRow: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  shelfItem: { width: 144 },
  shelfPosterFrame: {
    width: 144,
    aspectRatio: 2 / 3,
    position: "relative",
  },
  // CAUSA RAIZ (2026-10-15, achado numa varredura do app inteiro atrás
  // do mesmo bug do "+" do Feed/comentário de episódio) — era
  // `height: "100%"`. O `Animated.View` real de dentro do
  // `PressableScale` (aqui com `style={StyleSheet.absoluteFill}`, que
  // só resolve o tamanho do `Pressable` em si) só usa `alignSelf:
  // "stretch"`, que estica a LARGURA — a altura dele nunca vem do pai,
  // fica "automática". Um filho pedindo `height: "100%"` de um pai sem
  // altura definida não tem contra o que calcular essa porcentagem: a
  // Yoga resolve como ZERO. `shelfPosterFrame` (o pai de verdade, com
  // `width: 144` + `aspectRatio: 2/3`) tem tamanho certo, mas isso não
  // "desce" pro `Animated.View` sozinho. Correção: mesma receita já
  // usada no resto do app — `aspectRatio` (a mesma proporção do
  // `shelfPosterFrame`) em vez de `height: "100%"`, calculando a altura
  // a partir da LARGURA (que o `stretch` garante de verdade).
  shelfPoster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  /** Mesmo tamanho padrão "md" do botão de marcar em todo o app (`EpisodeWatchedButton`: 32px/ícone 19px). */
  /*
    CORREÇÃO DE CAUSA RAIZ (a pedido — print real, "o botão de marcar
    do filme está transparente ao invés de branco que é o padrão que
    usamos") — este selo nasceu com seu próprio visual (scrim escuro
    translúcido + borda branca), em vez de seguir o PADRÃO do app pro
    estado "ainda não assistido": círculo branco sólido + check preto,
    exatamente como `EpisodeWatchedButton.tsx` (usado em toda marcação
    de episódio) e `SharedProgressRow` (cartão grande de série, acima,
    na mesma tela). Corrigido pra seguir o mesmo padrão — sombra
    (`elevation.low`) no lugar da borda, sem transparência nenhuma.
  */
  shelfBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: elevation.low.shadowColor,
    shadowOpacity: elevation.low.shadowOpacity,
    shadowRadius: elevation.low.shadowRadius,
    shadowOffset: elevation.low.shadowOffset,
    elevation: elevation.low.elevation,
  },
  shelfBadgeDone: {
    backgroundColor: colors.success,
  },
  shelfTitle: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  shelfTag: {
    marginTop: 3,
  },
  /**
   * TILE "VER MAIS"/"VER MENOS" (2026-10-15) — ver comentário grande em
   * `SharedMovieMoreTile`, acima. `radius.sm` (não `radius.lg` dos
   * pôsteres de verdade) e sem borda — mesma distinção visual que
   * `ActivityGroupCard.tsx` (feed) já faz entre pôster de título e
   * tile de ação. Só ocupa o espaço do PÔSTER (sem título/tag embaixo,
   * diferente de `shelfItem` normal) — por isso não reaproveita
   * `shelfPosterFrame` como está (aquele é só o quadro do pôster,
   * pensado pra ter irmãos abaixo dele).
   */
  movieMoreTileFrame: {
    aspectRatio: 2 / 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  movieMoreTileLabel: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    paddingHorizontal: spacing.xs,
  },
  // "Ver menos" (expandido) — mesmo padrão de cor de `lessPillText` em `ActivityGroupCard.tsx` (âmbar, pra destacar que é uma ação de recolher, não só mais um rótulo).
  movieMoreTileLabelLess: {
    fontSize: fontSize.xxs,
    color: colors.primary,
  },
  /**
   * CORREÇÃO DE CAUSA RAIZ (2026-10-14, reportado em teste real — "o
   * 'assistido' ficou numa linha e a animação de carregando em
   * outra"). `View` do React Native usa `flexDirection: "column"` por
   * padrão (diferente do `div` do CSS) — esta tag nunca precisou de
   * `row` antes porque só tinha UM filho (`Text`), mas o cartão grande
   * (`SharedProgressRow`) passou a colocar o `ActivityIndicator` DENTRO
   * dela, ao lado do texto, quando `phase === "advancing"` — sem
   * `flexDirection: "row"` explícito, os dois empilhavam verticalmente
   * em vez de ficarem lado a lado (mesmo padrão que `statusBadge` já
   * usa em `ContinueWatchingListRow.tsx`, a Home, por este mesmo
   * motivo).
   */
  sharedRowTag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
  },
  sharedRowTagInProgress: { backgroundColor: "rgba(232,163,61,0.15)" },
  sharedRowTagCompleted: { backgroundColor: "rgba(52,199,123,0.15)" },
  // Estado "ainda não começaram" (nenhuma linha gravada ainda) —
  // neutro de propósito, nunca pode parecer igual ao âmbar de "em
  // andamento" (ver comentário grande em `hasStarted`, acima).
  sharedRowTagNotStarted: { backgroundColor: "rgba(255,255,255,0.07)" },
  sharedRowTagText: { fontSize: fontSize.xxs, fontWeight: "700" },
  sharedRowTagTextInProgress: { color: colors.primary },
  sharedRowTagTextCompleted: { color: colors.success },
  sharedRowTagTextNotStarted: { color: colors.muted },
  /**
   * CARTÃO GRANDE, PADRÃO "CONTINUAR ACOMPANHANDO" (2026-10-14) — ver
   * comentário grande em `SharedProgressRow`. Nomes próprios
   * (`sharedBig*`) pra não confundir com `sharedRow*` (a tag de status,
   * ainda compartilhada com o selo de "assistido junto" de
   * `SharedMovieShelfItem`).
   */
  sharedBigCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  sharedBigTint: {
    borderRadius: radius.md,
  },
  sharedBigDestaqueBrilho: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: LARGURA_BRILHO_DESTAQUE,
  },
  sharedBigDestaqueBarra: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: LARGURA_BARRA_DESTAQUE,
  },
  sharedBigAdvanceContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sharedBigPosterWrap: { flexShrink: 0 },
  sharedBigPoster: {
    width: 80,
    height: 120,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  sharedBigInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  sharedBigPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: "100%",
  },
  sharedBigPillText: {
    fontSize: fontSize.xxs,
    fontWeight: "700",
    fontFamily: fontFamily[700],
    letterSpacing: 0.275,
    color: colors.text,
    flexShrink: 1,
  },
  sharedBigCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: 2,
  },
  sharedBigCode: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  /** Igual à Home — só informativo aqui (sem `Pressable`/folha de pendentes, ver comentário grande em `SharedProgressRow`). */
  sharedBigPlusBadge: {
    backgroundColor: "rgba(58,133,206,0.15)",
    borderRadius: radius.full,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  sharedBigPlusBadgeText: {
    fontSize: fontSize.micro,
    fontWeight: "700",
    fontFamily: fontFamily[700],
    color: colors.info,
  },
  sharedBigEpisode: {
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  sharedBigSpinner: {
    marginLeft: 4,
    transform: [{ scale: 0.55 }],
  },
  sharedBigButtonSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
  sharedBigRing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.success,
  },
  sharedBigParticleField: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  particle: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.success,
  },
  /** Ver `TOAST_RISE_DISTANCE`/`showToast` — mesmo visual do mockup aprovado, pílula azul com texto branco, ancorada no canto do selo. */
  /*
    CORREÇÃO DE CAUSA RAIZ, 2ª TENTATIVA (a pedido — "continue bugado",
    confirmado que já tinha testado com `alignSelf: "flex-start"" e
    continuava cortado) — a 1ª tentativa tratou sintoma errado: o pai
    (`sharedBigButtonSlot`) usa `alignItems: "center"` (não "stretch"),
    então `alignSelf` nunca era o problema de verdade. A causa raiz real
    é mais sutil — um `View` `position: "absolute"` com só UM lado fixo
    (`right`) e NENHUMA largura própria não tem garantia de se medir
    pelo conteúdo em todo motor/plataforma do Yoga (diferente do CSS no
    navegador, onde o mockup rodava) — no Android em especial, é um
    gotcha conhecido do React Native.

    Fix de verdade: o `View` ABSOLUTO (`sharedBigToastAnchor`) ganha uma
    LARGURA PRÓPRIA explícita (bem maior que o selo) + `alignItems:
    "flex-end"` — e o PILL de verdade (fundo azul/texto,
    `sharedBigToastPill`) vira filho de FLUXO NORMAL dele (não mais
    absoluto), que aí sim se dimensiona pelo texto de um jeito
    100% confiável — exatamente como `sharedRowTag`/`sharedBigPlusBadge`
    já fazem neste mesmo arquivo, só que agora ANCORADO dentro de uma
    caixa absoluta mais larga, em vez de SER a própria caixa absoluta.
  */
  sharedBigToastAnchor: {
    position: "absolute",
    right: -6,
    bottom: -2,
    width: 220,
    alignItems: "flex-end",
  },
  sharedBigToastPill: {
    backgroundColor: colors.info,
    borderRadius: radius.full,
    paddingVertical: 4,
    paddingHorizontal: 9,
    maxWidth: 200,
  },
  sharedBigToastText: {
    fontSize: fontSize.micro,
    fontWeight: "700",
    fontFamily: fontFamily[700],
    color: "#fff",
  },
});
