import { useState } from "react";
import { ScrollView, View, TextInput, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useMyLists } from "@/lib/useMyLists";
import { Screen, Text, GlassTargetProvider, Glass, GelSurface, PressableScale, AmbientGlow } from "@/components/ui";
import { PageError } from "@/components/media/PageError";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { colors, radius, spacing, fontSize, tint } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

/**
 * TASK-106 (Listas) — porta de `ListsPageView.tsx` + `ListsView.tsx`
 * do web. TASK-172 — cada linha agora leva pra `/lists/[id]`, onde
 * dá pra ver o conteúdo, remover item e apagar a lista; antes disso
 * o nome não estava ligado a rota nenhuma (mesma lacuna existia no
 * web).
 */
/**
 * TESTE A (2026-09-09) — RESULTADO REGISTRADO, código já removido.
 *
 * Esta tela virou temporariamente um diagnóstico: fundo escuro + UMA
 * mancha do `AmbientGlow`, sem `Screen`, sem `GlassTargetProvider`,
 * sem `BlurTargetView`, sem `BlurView`, sem `Glass`, sem nada por cima.
 *
 * RESULTADO: os anéis concêntricos CONTINUARAM aparecendo. Medido no
 * print do aparelho — 32 valores distintos em 290px de raio, uma faixa
 * a cada 9.1px — e, na borda, `#0B0E14` saiu como `rgb(0,0,20)`, ou
 * seja o canal vermelho tem 2 níveis disponíveis na faixa escura, o
 * verde ~10 e o azul ~23.
 *
 * Ou seja: o banding NÃO vem do `expo-blur`/`BlurTargetView` (hipótese
 * anterior, derrubada por este teste e revertida em `Glass.tsx`), nem
 * do formato das manchas. É a quantização de saída da tela numa rampa
 * escura e larga.
 *
 * A correção ficou onde nasce o problema: dither ordenado (Bayer 8×8,
 * amplitude ±0.04) embutido no alpha das próprias texturas do glow —
 * ver `GLOW_DISCS` em `components/ui/Glass.tsx`.
 */
/**
 * DIAGNÓSTICOS DOS ANÉIS DE FUNDO (2026-09-09) — resultados registrados,
 * código já removido. Esta tela foi usada como bancada porque a área
 * vazia dela não deixa esconder nada.
 *
 * 1. Fundo escuro + UMA mancha, sem `Screen`, sem `GlassTargetProvider`,
 *    sem `BlurTargetView`, sem `BlurView`, sem `Glass`: os anéis
 *    APARECERAM. → não é o `expo-blur`.
 * 2. Textura marcada (quadrante zerado + xadrez) no mesmo `require` do
 *    `AmbientGlow`: a marca apareceu. → o asset novo carrega. E a
 *    leitura em runtime deu o número que faltava: PNG de 616px
 *    desenhado a 616dp numa tela de PixelRatio 2.625 = 1617px físicos,
 *    ou seja UPSCALE de 2.625× — que apagava qualquer padrão de 1px
 *    embutido na textura.
 * 3. Três faixas comparadas na mesma tela:
 *      - alpha 0..255 + asset @3x  → PIOROU (47 níveis de azul contra
 *        117; patamares de 9px contra 3px). O upscale do 1x estava
 *        interpolando e criando valores intermediários, funcionando
 *        como um dither tosco.
 *      - dither de tela cheia com `resizeMode="repeat"` → desvio local
 *        medido em 0.00: o Android NÃO replicou o tile, esticou. O
 *        quadrado de controle (64dp = um tile exato, amplitude
 *        exagerada) deu desvio 5.6, provando que a camada renderiza.
 *
 * CONCLUSÃO E CORREÇÃO: o `@3x` preserva detalhe fino (foi por isso que
 * preservou até os degraus duros), então o dither ordenado voltou pra
 * dentro das próprias texturas, agora em `@3x` — ver `GLOW_DISCS` em
 * `components/ui/Glass.tsx`. Sem camada nova, sem `repeat`.
 */
export default function ListsScreen() {
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela. Mesma conta que as telas de aba já usavam.
   */
  const espacoDoDock = useTabBarClearance();
  const router = useRouter();
  const { t } = useTranslation();
  const { lists, isLoading, isError, creating, create, refetch } = useMyLists();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    const ok = await create(name);
    if (ok) {
      setName("");
      setShowForm(false);
    }
  }

  return (
    <Screen padded={false}>
      {/*
        * CORREÇÃO (2026-09-09, medido ponto a ponto contra o print do
        * web): o campo de manchas estava ~70dp mais BAIXO que o do web —
        * o pico do web fica 340-410dp abaixo do botão, o do mobile
        * ficava em 410-480.
        *
        * Causa: no web (`ListsPageView.tsx`) o campo é `absolute
        * inset-0` da PÁGINA INTEIRA, e o cabeçalho fica DENTRO dele —
        * `top: 40px` conta do topo da página. Aqui o
        * `GlassTargetProvider` começava DEPOIS do cabeçalho, então
        * todas as manchas desciam a altura dele.
        *
        * Fix: o provider passa a envolver o cabeçalho também, como no
        * web. Nenhuma mancha mudou de valor.
        */}
      <GlassTargetProvider style={styles.flex} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">{t("profile.myLists")}</Text>
      </View>

      {/* PORTE DO WEB (2026-09-04, "vidro que falta") — campo de manchas de `ListsPageView.tsx` (ver `lib/glowBlobs.ts`). */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}>
          {/*
            * PORTE DO WEB (2026-09-04) — "Criar nova lista" virou a
            * pílula "gel" âmbar do CTA primário (web, `ListsView.tsx`:
            * "em vez do `bg-primary` chapado"), com o mesmo
            * `rounded-full` de lá.
            */}
          {/*
            * CORREÇÃO (2026-09-16, a pedido — "no web, quando aperto
            * algum botão pílula glass, tem uma pequena animação,
            * confere e adiciona também") — conferido no web
            * (`ListsView.tsx`): este botão usa `active:scale-[0.98]`.
            * `Pressable` puro virou `PressableScale`.
            */}
          <PressableScale onPress={() => setShowForm((v) => !v)}>
            {/*
              * CORREÇÃO (2026-09-09, a pedido — "ajuste o botão de criar
              * nova lista igual ao ver detalhes"). Conferido no web: os
              * DOIS botões usam a mesma receita, literalmente a mesma
              * string — `radial-gradient(130% 170% at 28% 18%,
              * rgba(240,169,79,0.88) 0%, rgba(232,163,61,0.85) 42%,
              * rgba(176,95,27,0.9) 100%)` mais `inset 0 1px 0
              * rgba(255,255,255,0.35), inset 0 -4px 7px rgba(120,66,10,0.4)`
              * e `border-white/15` (`ListsView.tsx` e `StatisticsCard.tsx`).
              *
              * Só faltava a flag: o "Ver detalhes" já usava
              * `webCalibrated` (a reprodução do radial do web em degradê
              * vertical, calibrada no aparelho e aprovada), este aqui
              * ainda estava na versão antiga. */}
            <GelSurface style={styles.createButton} webCalibrated>
              <Feather name="plus" size={16} color={colors.background} />
              <Text style={styles.createButtonText}>{t("profile.createNewList")}</Text>
            </GelSurface>
          </PressableScale>

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
            <AvatarRowSkeleton />
          ) : isError ? (
            <PageError message={t("error.loadListsFailed")} onRetry={() => refetch()} />
          ) : !lists || lists.length === 0 ? (
            <Text variant="muted" style={styles.centerText}>
              {t("profile.noListsYet")}
            </Text>
          ) : (
            <View style={styles.list}>
              {lists.map((list) => (
                // PORTE DO WEB (2026-09-04) — linha virou "glass-row"
                // (`ListsView.tsx`), com o ícone dentro de um círculo
                // âmbar translúcido (`bg-primary/12`), como no web.
                <Pressable key={list.id} onPress={() => router.push(`/lists/${list.id}`)}>
                  <Glass style={styles.listRow}>
                    {/*
                      CAUSA RAIZ DE VERDADE, ENCONTRADA COM PRINT REAL
                      (2026-09-17 — "os ícones ganharam círculos e
                      tamanho maior"). Medi os dois prints: o `tint.subtle`
                      (12) já é o MESMO `rgba(232,163,61,0.12)` do
                      `bg-primary/12` do web — os pixels batem (matemática
                      de composição do alfa confere) — e o círculo (32×32)
                      e o gap (12) também já eram idênticos ao web. A causa
                      real não era cor nem tamanho de caixa: era o ÍCONE
                      ERRADO. O web usa `ListChecks` do lucide (duas linhas
                      finas com check, visual "leve"); aqui tinha
                      `Feather name="check-square"` — um ícone BEM
                      diferente (caixa cheia com check dentro, visual
                      "denso"), que enche o círculo quase todo e por isso
                      parece maior/mais pesado, mesmo em 16px igual ao web.
                      Fix: `MaterialCommunityIcons name="format-list-checks"`
                      — o glifo mais próximo do `ListChecks` disponível no
                      `@expo/vector-icons` já usado no app (não trouxe
                      `lucide-react-native`, que não é dependência daqui).
                    */}
                    <View style={styles.listIconCircle}>
                      <MaterialCommunityIcons name="format-list-checks" size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.listName}>{list.name}</Text>
                    <Feather name="chevron-right" size={18} color={colors.muted} style={{ marginLeft: "auto" }} />
                  </Glass>
                </Pressable>
              ))}
            </View>
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
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela.
  header: {
    /**
     * CORREÇÃO (2026-09-16, print real — "botão de voltar, título e o
     * que vem depois estão tudo junto") — `paddingBottom` era
     * `spacing.sm` (8). No web (`SectionPageHeader.tsx`, componente
     * compartilhado por TODAS essas telas lá — aqui cada tela reimplementa
     * o próprio cabeçalho, sem componente comum), o espaço entre a linha
     * voltar+título e o que vem a seguir é `mb-4` = 16 = `spacing.md`, o
     * dobro do que o mobile tinha. Alinhado ao valor real do web, não a um
     * chute.
     */
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  // CORREÇÃO (2026-09-04, "vidro que falta") — `backgroundColor` sólido
  // saiu (vira `<GelSurface>`, que já pinta o degradê âmbar + brilho) e
  // o raio virou pílula (`rounded-full` do web = `radius.full`).
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  createButtonText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.background,
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
    fontSize: 13,
    fontWeight: "700",
    color: colors.background,
  },
  centerText: {
    textAlign: "center",
    marginTop: spacing.lg,
  },
  list: {
    gap: spacing.sm,
  },
  // CORREÇÃO (2026-09-04, "vidro que falta") — fundo/borda sólidos
  // removidos (vira `<Glass>`); raio `radius.md` (10) → `radius.lg`
  // (16), que é o `rounded-2xl` da glass-row do web.
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 6,
  },
  /** Círculo âmbar translúcido atrás do ícone — `bg-primary/12` do web. */
  listIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tint.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  listName: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
});
