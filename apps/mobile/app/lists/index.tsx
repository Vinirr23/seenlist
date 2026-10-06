import { useCallback, useState } from "react";
import { ScrollView, View, TextInput, Pressable, KeyboardAvoidingView, Platform, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { fetchMyListsWithPreview, createList, type ListWithPreview } from "@/lib/lists";
import { ListCollectionCard, CreateListCard } from "@/components/media/ListCollectionCard";
import { Screen, Text, Skeleton, GlassTargetProvider, AmbientGlow, ScreenHeader } from "@/components/ui";
import { PageError } from "@/components/media/PageError";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

/**
 * REDESIGN "MINHAS LISTAS" (2026-10-07, aprovado pelo usuário — ver
 * `claude/SEENLIST-FEATURE-2026-10-07-redesign-minhas-listas.md`) —
 * troca a lista horizontal (ícone+nome+seta) por um grid de 2
 * colunas, cada lista como um mosaico feito dos próprios pôsteres
 * (`ListCollectionCard`). O botão amarelo gigante "Criar nova lista"
 * sai do topo e vira o último item do grid (`CreateListCard`),
 * visualmente secundário.
 *
 * TROCA DE FONTE DE DADOS: antes usava `useMyLists()` →
 * `fetchMyLists()` (só id/name/createdAt, sem pôster — por isso a
 * tela antiga nunca mostrava capa nenhuma). Agora usa
 * `fetchMyListsWithPreview()` — já existia, já em produção no Perfil
 * (`ProfileListsPreview.tsx`, efeito "baralho"), já busca até 4
 * pôsteres por lista numa ÚNICA consulta em lote pra TODAS as listas
 * (sem N+1 por card). Nenhuma query nova, nenhuma mudança de schema.
 * `useMyLists`/`fetchMyLists` continuam intactos — ainda usados pelo
 * seletor "adicionar a uma lista" em `MovieQuickActionsSheet.tsx`/
 * `SeriesQuickActionsSheet.tsx`, que não precisa de pôster.
 *
 * TASK-106/172 (histórico anterior) — navegação pra `/lists/[id]`,
 * criação (`createList`) e exclusão (ainda só dentro do detalhe,
 * `[id].tsx`) continuam exatamente como eram; só a ENTRADA visual
 * mudou nesta rodada, por pedido explícito do usuário.
 */
const GRID_GAP = spacing.sm;

export default function ListsScreen() {
  const espacoDoDock = useTabBarClearance();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - spacing.md * 2 - GRID_GAP) / 2);

  const [lists, setLists] = useState<ListWithPreview[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const reload = useCallback(() => {
    setIsError(false);
    fetchMyListsWithPreview(locale)
      .then(setLists)
      .catch((error) => {
        console.error("[ListsScreen] Falha ao buscar listas", error);
        setIsError(true);
      })
      .finally(() => setIsLoading(false));
  }, [locale]);

  useFocusEffect(reload);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createList(name);
      setName("");
      setShowForm(false);
      reload();
    } catch (error) {
      console.error("[ListsScreen] Falha ao criar lista", error);
    } finally {
      setCreating(false);
    }
  }

  function itemsLabel(count: number): string {
    return count === 1 ? t("profile.oneListItem") : t("profile.listItemsCount", { count });
  }

  return (
    <Screen padded={false}>
      <GlassTargetProvider style={styles.flex} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
        {/* A PEDIDO (2026-10-07) — só "← Minhas listas", sem contador no cabeçalho. */}
        <ScreenHeader title={t("profile.myLists")} />

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}>
            {showForm && (
              <View style={styles.form}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={t("profile.listNamePlaceholder")}
                  placeholderTextColor={colors.muted}
                  maxLength={80}
                  autoFocus
                  style={styles.input}
                />
                <Pressable style={styles.saveButton} onPress={handleCreate} disabled={!name.trim() || creating}>
                  <Text style={styles.saveButtonText}>{creating ? t("common.creating") : t("common.save")}</Text>
                </Pressable>
              </View>
            )}

            {isLoading ? (
              <View style={styles.grid}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={{ width: cardWidth }}>
                    <Skeleton width={cardWidth} height={cardWidth} borderRadius={radius.card} />
                    <Skeleton width="70%" height={13} style={{ marginTop: spacing.xs }} />
                    <Skeleton width="40%" height={11} style={{ marginTop: 4 }} />
                  </View>
                ))}
              </View>
            ) : isError ? (
              <PageError message={t("error.loadListsFailed")} onRetry={reload} />
            ) : (
              <>
                {/*
                  A PEDIDO (2026-10-07) — "nenhuma lista ainda" não tem
                  mais botão gigante nem `EmptyShelf` separado: o
                  próprio grid, com só o card de criar lista dentro
                  dele, já é o CTA óbvio. Esta linha de texto é só o
                  contexto de por que o grid está "vazio".
                */}
                {(!lists || lists.length === 0) && (
                  <Text variant="muted" style={styles.emptyHint}>
                    {t("profile.noListsYet")}
                  </Text>
                )}
                <View style={styles.grid}>
                  {(lists ?? []).map((list) => (
                    <ListCollectionCard
                      key={list.id}
                      list={list}
                      cardWidth={cardWidth}
                      itemsLabel={itemsLabel(list.itemCount)}
                      onPress={() => router.push(`/lists/${list.id}`)}
                    />
                  ))}
                  <CreateListCard cardWidth={cardWidth} onPress={() => setShowForm((v) => !v)} label={t("profile.createList")} />
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </GlassTargetProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  form: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  saveButton: {
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontSize: fontSize.xsPlus,
    fontWeight: "700",
    color: colors.background,
  },
  emptyHint: {
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
});
