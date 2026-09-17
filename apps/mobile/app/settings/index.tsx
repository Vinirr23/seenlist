import { useEffect, useState } from "react";
import { ScrollView, View, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { fetchMyProfileSettings, type MyProfileSettings, type ProfileVisibility } from "@/lib/settings";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { Screen, Text, Skeleton, GlassTargetProvider, Glass, AmbientGlow, type GlowBlob } from "@/components/ui";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { VisibilityRow } from "@/components/settings/VisibilityRow";
import { LanguageRow } from "@/components/settings/LanguageRow";
import { ChangePasswordModal } from "@/components/settings/ChangePasswordModal";
import { colors, spacing, fontSize } from "@/lib/theme";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

const SITE_URL = "https://seenlist.app";

/**
 * PORTE DO WEB (2026-09-04, auditoria "mobile 100% igual ao web" —
 * bloco "vidro que falta") — mesma paleta azul própria de
 * `SettingsPage.tsx` (web), NÃO o âmbar/teal padrão do
 * `AmbientGlow` — 4 manchas reais (cor/posição/tamanho/opacidade),
 * mesma técnica de conversão já usada em `PROFILE_GLOW_BLOBS`
 * (`app/(tabs)/profile.tsx`): `top` copiado em pixel 1:1 do web;
 * `left`/`right` do web são % da coluna, convertido assumindo ~400px
 * de largura de referência (`-22% → -88px` etc.).
 */
/*
 * PARIDADE DE BRILHO (2026-09-16, "TODAS AS TELAS IGUAIS") — mesmo
 * fator ×1.74 de `HOME_GLOW_BLOBS`, ver comentário em `profile.tsx`.
 */
const SETTINGS_GLOW_BLOBS: GlowBlob[] = [
  { color: "rgba(27,75,122,0.78)", top: 120, left: -110, size: 256 },
  { color: "rgba(42,127,184,0.7)", top: 440, right: -100, size: 240 },
  { color: "rgba(13,59,92,0.78)", top: 760, left: -90, size: 256 },
  { color: "rgba(13,59,92,0.42)", top: 1040, right: -80, size: 192 },
];

/**
 * TASK-104 — porta de `SettingsPage.tsx` do web, com o que já se
 * aplica ao app nativo hoje. De propósito, fora desta leva original:
 *
 * - Tema — o nativo só tem tema escuro por enquanto, sem opção de
 *   trocar ainda.
 * - Notificações — já ligado (leva TASK-114): registro de push,
 *   deep link ao tocar, e esta tela agora tem o link de verdade pra
 *   `/settings/notifications`.
 * - Migrar do TV Time — ferramenta de importação única, faz sentido
 *   só no site (upload de arquivo), não no app.
 * - Editar perfil (nome/foto/bio) — a parte de TEXTO já existe
 *   (`/settings/edit-profile`, leva TASK-105); só falta trocar
 *   foto/banner, que depende de seletor de imagem.
 * - Excluir conta — abre o navegador pro site em vez de reimplementar
 *   aqui. É uma operação que mexe com a conta inteira (Supabase Auth
 *   Admin, chave de serviço) — o site já tem isso pronto e testado;
 *   duplicar essa lógica sensível no cliente nativo é risco sem
 *   necessidade real.
 *
 * Adicionado numa leva posterior: Idioma (`LanguageRow`, sistema de
 * tradução pt-BR/en/es construído do zero pro app nativo, mesma
 * arquitetura do web).
 */
export default function SettingsScreen() {
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela. Mesma conta que as telas de aba já usavam.
   */
  const espacoDoDock = useTabBarClearance();
  const router = useRouter();
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<MyProfileSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  // NOVO (2026-09-03, a pedido — "adicionar botão de copiar UID, igual ao web") — porta de `UidRow.tsx` do web (`handleCopy`/`copied`), sem a parte "vidro" do botão (fora do escopo do redesign).
  const [uidCopied, setUidCopied] = useState(false);

  useEffect(() => {
    fetchMyProfileSettings()
      .then(setProfile)
      .finally(() => setIsLoading(false));
  }, []);

  function updateLocalVisibility(field: "profileVisibility" | "favoritesVisibility" | "libraryVisibility", value: ProfileVisibility) {
    setProfile((current) => (current ? { ...current, [field]: value } : current));
  }

  function handleDeleteAccount() {
    Alert.alert(
      t("settings.deleteAccount"),
      t("settings.deleteAccountMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("settings.openSite"), onPress: () => WebBrowser.openBrowserAsync(`${SITE_URL}/profile/settings`) },
      ]
    );
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/(auth)/login");
  }

  // NOVO (2026-09-03) — mesma lógica de `UidRow.tsx` (web): copia, mostra "Copiado" por 2s, volta ao normal.
  async function handleCopyUid() {
    if (!profile) return;
    try {
      await Clipboard.setStringAsync(profile.userId);
      setUidCopied(true);
      setTimeout(() => setUidCopied(false), 2000);
    } catch (error) {
      console.error("[SettingsScreen] Falha ao copiar UID", error);
    }
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          {/* CORREÇÃO (auditoria consistência web/mobile) — web: seta de
              voltar usa `text-muted`, não `text-text` (cor cheia). */}
          <Feather name="arrow-left" size={20} color={colors.muted} />
        </Pressable>
        {/* CORREÇÃO — web: `text-xl font-bold`=20/700; era `variant="subtitle"` (18/600). */}
        <Text style={styles.headerTitle}>{t("settings.title")}</Text>
      </View>

      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={SETTINGS_GLOW_BLOBS} />}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}>
        {/*
          * PADRONIZAÇÃO (2026-09-03, auditoria "Configurações TUDO igual
          * ao web") — ordem das seções não batia com `SettingsPage.tsx`
          * do web (ver comentário de redesign lá, 2026-08-25): "Conta →
          * Privacidade → Preferências → ..." virou "Preferências →
          * Conta → Privacidade → ..." (Preferências foi pra cima).
          */}
        <SectionLabel label={t("settings.section.preferences")} />
        <Glass style={styles.card}>
          <LanguageRow />
          <SettingsRow label={t("settings.notifications")} onPress={() => router.push("/settings/notifications")} last />
        </Glass>

        {/*
          * CORREÇÃO (auditoria — velocidade percebida) — mesmo
          * achado de `edit-profile.tsx`: os blocos de Conta e
          * Privacidade simplesmente não existiam durante o
          * carregamento, então a tela "pulava" ao ficar pronta (as
          * seções de baixo saltavam pra baixo). Esqueleto com a
          * mesma altura evita o salto.
          */}
        {isLoading && (
          <>
            <SectionLabel label={t("settings.section.account")} />
            {/* CORREÇÃO — só 2 blocos de esqueleto pra uma seção com 3
                linhas de verdade (email/UID/senha) — a própria "pulada"
                que o comentário acima diz estar evitando. Também
                reduzido de 52 pra 44 (altura real da linha, ver
                `SettingsRow.tsx`). */}
            <Glass style={styles.card}>
              <Skeleton width="100%" height={44} borderRadius={0} />
              <Skeleton width="100%" height={44} borderRadius={0} />
              <Skeleton width="100%" height={44} borderRadius={0} />
            </Glass>
            <SectionLabel label={t("settings.section.privacy")} />
            <Glass style={styles.card}>
              <Skeleton width="100%" height={44} borderRadius={0} />
              <Skeleton width="100%" height={44} borderRadius={0} />
              <Skeleton width="100%" height={44} borderRadius={0} />
            </Glass>
          </>
        )}

        {!isLoading && profile && (
          <>
            <SectionLabel label={t("settings.section.account")} />
            <Glass style={styles.card}>
              <SettingsRow label={t("auth.email")} value={profile.email ?? "—"} />
              {/*
                * CORREÇÃO (auditoria consistência web/mobile —
                * `UidRow.tsx` do web) — era duas linhas empilhadas
                * (rótulo em cima, campo de texto ocupando a largura
                * toda embaixo); o web mostra "UID" numa ÚNICA linha
                * horizontal, com o valor truncado (max 120px) à
                * direita, igual todas as outras linhas da tela.
                *
                * CORREÇÃO #2 (2026-09-03) — o rótulo era
                * `t("settings.accountId")` ("ID da conta", traduzido);
                * o web mostra o texto literal "UID" (`<span>UID</span>`,
                * sem tradução — mesma sigla em todo idioma), não uma
                * chave de tradução. Trocado pro literal, igual ao web.
                *
                * NOVO (2026-09-03, a pedido) — botão de copiar
                * adicionado (`expo-clipboard`), com layout do web
                * (ícone + texto, `gap-1`=4px, `px-2 py-1`=8px/4px).
                *
                * CORREÇÃO (2026-09-04, auditoria "vidro que falta") —
                * o botão tinha ficado SEM o "vidro" do web de propósito
                * ("fora do escopo do redesign", decisão de uma sessão
                * anterior) — conferido `UidRow.tsx` do web de novo: o
                * botão de copiar LÁ também é vidro (`border-white/10` +
                * blur + o mesmo gradiente neutro), não uma exceção.
                * Trocado o fundo sólido por `Glass`, igual ao resto da
                * tela.
                */}
              <View style={styles.uidRow}>
                <Text style={styles.uidLabel}>UID</Text>
                <View style={styles.uidValueGroup}>
                  <TextInput
                    value={profile.userId}
                    editable={false}
                    style={styles.uidInput}
                    numberOfLines={1}
                  />
                  <Pressable onPress={handleCopyUid} hitSlop={8} accessibilityLabel={t("settings.copyUid")}>
                    {/*
                      * CORREÇÃO (2026-09-16, mesmo achado do botão "+" em
                      * `AddToLibraryButton.tsx` — Glass aninhado dentro de
                      * outro Glass, aqui o card da seção "Conta", não
                      * desenha nada no iOS real, confirmado via TestFlight).
                      * Trocado por `View` comum com o mesmo fundo/borda da
                      * receita `card` (`lib/theme.ts`) copiados diretamente,
                      * sem blur.
                      */}
                    <View style={[styles.uidCopyButton, styles.uidCopyButtonSurface]}>
                      <Feather name={uidCopied ? "check" : "copy"} size={14} color={uidCopied ? colors.success : colors.muted} />
                      <Text style={[styles.uidCopyButtonText, uidCopied && { color: colors.success }]}>
                        {uidCopied ? t("settings.copied") : t("common.copy")}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </View>
              <SettingsRow label={t("settings.password")} value="••••••••" onPress={() => setShowPasswordModal(true)} last />
            </Glass>

            <SectionLabel label={t("settings.section.privacy")} />
            <Glass style={styles.card}>
              <VisibilityRow
                label={t("nav.profile")}
                field="profileVisibility"
                value={profile.profileVisibility}
                onChanged={(v) => updateLocalVisibility("profileVisibility", v)}
              />
              <VisibilityRow
                label={t("settings.library")}
                field="libraryVisibility"
                value={profile.libraryVisibility}
                onChanged={(v) => updateLocalVisibility("libraryVisibility", v)}
              />
              <VisibilityRow
                label={t("settings.favorites")}
                field="favoritesVisibility"
                value={profile.favoritesVisibility}
                onChanged={(v) => updateLocalVisibility("favoritesVisibility", v)}
                last
              />
            </Glass>
          </>
        )}

        {/* TASK-171/172 — abre a versão web numa aba dentro do app (mesmo `WebBrowser` já usado pra Sobre/Privacidade/Termos), em vez de reconstruir OAuth e parser de .zip nativo no mobile — os dois já escrevem no mesmo Supabase que o mobile lê, então o resultado aparece aqui na volta, sem duplicar nada. */}
        {/* CORREÇÃO — ordem interna invertida: web mostra "Migrar do TV
            Time" ANTES de "Importar do Trakt" (`SettingsPage.tsx`); aqui
            estava o contrário. As outras 3 linhas desta seção no web
            (importações pendentes do TV Time, corrigir status de
            séries, preencher IDs de episódio) continuam de fora — decisão
            já registrada no comentário do topo deste arquivo (ferramentas
            avulsas de admin/upload, fazem sentido só no site). */}
        <SectionLabel label={t("settings.section.importData")} />
        <Glass style={styles.card}>
          <SettingsRow label={t("settings.migrateFromTvTime")} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/import/tvtime`)} />
          <SettingsRow label={t("settings.importFromTrakt")} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/import/trakt`)} last />
        </Glass>

        <SectionLabel label={t("settings.section.app")} />
        <Glass style={styles.card}>
          <SettingsRow label={t("settings.sendFeedback")} onPress={() => router.push("/settings/feedback")} />
          <SettingsRow label={t("settings.about")} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/profile/settings/about`)} />
          <SettingsRow label={t("settings.privacyPolicy")} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/profile/settings/privacy`)} />
          <SettingsRow label={t("settings.termsOfUse")} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/profile/settings/terms`)} last />
        </Glass>

        {/* CORREÇÃO (2026-09-04, auditoria "vidro que falta") — mesma
            troca de fundo sólido por `Glass`, igual ao resto da tela
            (`LogoutButton.tsx` do web também é vidro). */}
        <Pressable onPress={handleSignOut}>
          <Glass style={styles.logoutButton}>
            <Feather name="log-out" size={16} color={colors.danger} />
            <Text style={styles.logoutText}>{t("settings.signOut")}</Text>
          </Glass>
        </Pressable>

        {/*
          * PADRONIZAÇÃO (2026-09-03, auditoria "implementar tudo que
          * não envolve redesign") — porta do redesign de Configurações
          * do web (2026-08-25, `SettingsPage.tsx`/`DeleteAccountRow.tsx
          * bare`): "Excluir conta" não compete visualmente com o resto
          * da tela. Saiu da caixa "Zona de risco" (que só tinha esse
          * item — a seção inteira foi removida) e virou um texto
          * vermelho discreto, sozinho, centralizado, com espaço extra
          * ABAIXO do botão "Sair" — mesma posição/hierarquia do web.
          */}
        <Pressable style={styles.deleteAccountBare} onPress={handleDeleteAccount} hitSlop={8}>
          <Text style={styles.deleteAccountBareText}>{t("settings.deleteAccount")}</Text>
        </Pressable>

      </ScrollView>
      </GlassTargetProvider>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </Screen>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text variant="muted" style={styles.sectionLabel}>
      {label.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  /**
   * PORTE DO WEB (2026-09-04, "vidro que falta") — mesmo padrão já
   * usado no Perfil (`app/(tabs)/profile.tsx`, `glassFill`): o fundo
   * (`AmbientGlow`) fica PARADO, preenchendo a área da `Screen`
   * (`flex: 1`), e o `ScrollView` rola por cima como vidro fosco sobre
   * um pano de fundo fixo.
   */
  glassFill: {
    flex: 1,
  },
  // CORREÇÃO (auditoria consistência web/mobile, Configurações) —
  // `paddingHorizontal` era 24 (`spacing.lg`); web usa `px-4`=16
  // (`spacing.md`) no wrapper que envolve cabeçalho+seções. `paddingTop`
  // era 8 (`spacing.sm`); web usa `pt-4`=16 no mesmo wrapper.
  // `paddingBottom` era 8; web tem `mb-4`=16 no cabeçalho antes da
  // primeira seção — vira o `paddingBottom` daqui, já que aqui o
  // cabeçalho é um `View` separado do `ScrollView` de baixo.
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  // CORREÇÃO — web: `text-xl font-bold`=20/700 (nenhum token de
  // `fontSize` bate em 20 — `lg`=18, `xl`=22 — por isso valor solto).
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  // CORREÇÃO — `paddingHorizontal` era 24; web `px-4`=16 (mesmo valor
  // do cabeçalho acima).
  //
  // CAUSA RAIZ ACHADA (2026-09-15, retomando o item que tinha ficado
  // em aberto — "paddingBottom de Configurações, 48 mobile × 128
  // web") — não existe bug de verdade aqui. O `paddingBottom: 48`
  // que morava neste style NUNCA chegava a valer nada: o `ScrollView`
  // (ver `contentContainerStyle={[styles.content, { paddingBottom:
  // espacoDoDock }]}` abaixo, no JSX) o sobrescreve sempre — no RN,
  // quando duas entradas de um array de estilos têm a mesma
  // propriedade, a ÚLTIMA vence, e `espacoDoDock` vem depois. Era
  // código morto, nunca lido.
  //
  // E o valor de verdade (`espacoDoDock`, de `useTabBarClearance.ts`)
  // já É o equivalente exato do `pb-32`=128 do web — o comentário do
  // próprio `useTabBarClearance.ts` confirma isso: "no web o
  // conteúdo passa POR BAIXO da barra (ela é `fixed`, com `pb-32` no
  // `PageContainer` só pra o último item não sumir)" — os dois
  // existem pelo MESMO motivo (a barra flutuante é `position:
  // absolute`/`fixed` e não reserva espaço sozinha), só que o web usa
  // um valor fixo genérico (128) pra qualquer tela, e o mobile calcula
  // a folga de verdade (dock + margem + área segura do aparelho) —
  // por isso os números não precisam bater 1:1. `paddingBottom` foi
  // removido daqui por ser morto, não por mudar de valor.
  content: {
    paddingHorizontal: spacing.md,
  },
  // CORREÇÃO — web: `text-xs font-semibold tracking-wide`=12/600/
  // 0.025em (≈0.3 em 12px), com `mb-3`=12 até o card e SEM margem
  // acima do próprio título (o respiro entre seções vem de baixo do
  // card anterior — `mb-8`=32 — ver `card.marginBottom` abaixo, e do
  // cabeçalho — `header.paddingBottom`=16 — antes da 1ª seção). Era
  // 11/700/0.5, `marginTop` fixo de 24 e `marginBottom` de 4. Também
  // ganhou `paddingHorizontal: 4` (web: `px-1` a mais que o card, um
  // leve recuo extra só no rótulo).
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    letterSpacing: 0.3,
    marginTop: 0,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  // CORREÇÃO — `borderRadius` era 10 (`radius.md`); web usa
  // `rounded-lg`=8. Ganhou `marginBottom: 32` (`spacing.xl`, web:
  // `mb-8` em cada `<section>`) — antes o respiro entre seções vinha
  // só do `marginTop` do rótulo seguinte (24); agora o card fornece
  // os 32px web usa, e o rótulo não soma mais nada em cima.
  //
  // CORREÇÃO (2026-09-04, "vidro que falta") — fundo/borda sólidos
  // removidos (viram `<Glass>`, que já desenha blur + gradiente +
  // borda `border-white/10` sozinho — mesma cor que já estava aqui,
  // então a borda não muda de cor, só ganha o resto do vidro).
  // `overflow: hidden` também sai daqui — `Glass` já aplica o dele.
  card: {
    borderRadius: 8,
    marginBottom: spacing.xl,
  },
  // CORREÇÃO (auditoria consistência web/mobile — `UidRow.tsx` do web)
  // — layout mudou de empilhado (rótulo em cima, campo embaixo) pra
  // uma linha horizontal só, igual ao web e às outras linhas da tela:
  // `flexDirection: row` + `justifyContent: space-between`, mesmo
  // `padding` de `SettingsRow` (`px-3 py-3`=12/12, não 16/12).
  uidRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  // CORREÇÃO — rótulo "ID da conta" não tinha estilo próprio (usava
  // `variant="label"`, negrito/600); web mostra "UID" com peso normal,
  // `text-sm`=14 (`text-text`, sem negrito).
  uidLabel: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  // CORREÇÃO — era um campo de largura total, sem limite (mostrava o
  // UID inteiro, sem truncar); web trava o valor em `max-w-[120px]
  // truncate text-xs text-muted`, igual ao valor das outras linhas.
  uidInput: {
    fontSize: fontSize.xs,
    color: colors.muted,
    padding: 0,
    maxWidth: 120,
    textAlign: "right",
  },
  // NOVO (2026-09-03) — agrupa o valor truncado + botão de copiar, igual ao `<span className="flex items-center gap-2">` do web (`UidRow.tsx`) que envolve os dois.
  uidValueGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  // NOVO (2026-09-03) — mesmo tamanho/formato do botão de copiar do
  // web (`px-2 py-1 rounded-md gap-1`).
  //
  // CORREÇÃO (2026-09-04, "vidro que falta") — o web também é vidro
  // aqui (`UidRow.tsx`, `border-white/10` + blur) — fundo/borda
  // sólidos removidos, vira `<Glass>`.
  uidCopyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  // Mesma cor da receita `card` do Glass (`lib/theme.ts`) — ver comentário no JSX acima.
  uidCopyButtonSurface: {
    backgroundColor: "rgba(80,115,180,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  uidCopyButtonText: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  // CORREÇÃO — `gap` era 4 (`spacing.xs`); web usa `gap-2`=8. `borderRadius`
  // era 10; web `rounded-lg`=8. `paddingVertical` era 12 (`spacing.sm`+4);
  // web `py-2.5`=10. `marginTop` era 32 (`spacing.xl`) — removido: o
  // respiro antes do botão agora vem do `card.marginBottom` (32) da
  // última seção, que já é o mesmo valor — manter os dois juntos
  // dobraria o espaço pra 64px.
  //
  // CORREÇÃO (2026-09-04, "vidro que falta") — fundo/borda sólidos
  // removidos (vira `<Glass>`, mesma borda `border-white/10` de antes).
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: 8,
    paddingVertical: 10,
  },
  // CORREÇÃO — web: `text-sm font-medium`=14/500; peso era 600.
  logoutText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.danger,
  },
  deleteAccountBare: {
    marginTop: spacing.xl,
    alignSelf: "center",
  },
  // CORREÇÃO — web: `text-xs text-danger/80`=12px; era `fontSize.xxs`
  // (11). Posição/opacidade (`mt-8`=32, `opacity 0.8`) já batiam,
  // mantidos.
  deleteAccountBareText: {
    fontSize: fontSize.xs,
    color: colors.danger,
    opacity: 0.8,
  },
});
