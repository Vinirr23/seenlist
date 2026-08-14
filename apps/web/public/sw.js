/*
 * Service worker do SeenList — só existe pra receber notificação
 * quando o site está FECHADO. Não faz cache nem intercepta rede: é
 * deliberadamente mínimo, porque service worker que faz cache é uma
 * fonte clássica de bug difícil (versão velha da página presa no
 * navegador, atualização que não chega).
 *
 * Fica em `public/` de propósito: precisa ser servido da raiz do
 * domínio (`/sw.js`) pra ter permissão sobre o site inteiro — se
 * estivesse numa subpasta, só valeria pra ela.
 */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // Push sem JSON válido não deveria acontecer (só o nosso servidor
    // envia), mas se acontecer é melhor mostrar algo genérico que
    // engolir a notificação em silêncio.
    payload = { title: "SeenList", body: event.data.text() };
  }

  event.waitUntil(
    self.registration
      .showNotification(payload.title ?? "SeenList", {
        body: payload.body ?? "",
        /*
         * CORREÇÃO (bug real, achado investigando "notificação web
         * não chegou pra um usuário específico") — apontava pra
         * `/icon-192.png`, que NUNCA existiu na pasta `public/` (só
         * `logo.png` e `og-image.png` existem de verdade). Toda
         * notificação enviada desde que essa funcionalidade existe
         * tentava carregar um ícone 404. O comportamento exato disso
         * varia por navegador — em alguns só aparece sem ícone, mas
         * não dá pra descartar que em algum caso isso interfira na
         * notificação aparecer. De qualquer forma, era um bug real,
         * concreto, e agora corrigido — usa o logo que já existe.
         */
        icon: "/logo.png",
        badge: "/logo.png",
        // Agrupa notificações do mesmo assunto em vez de empilhar
        // várias iguais — evita o efeito "20 avisos da mesma série".
        tag: payload.tag ?? undefined,
        data: { url: payload.url ?? "/" },
      })
      /*
       * A PEDIDO — antes, se `showNotification` falhasse por
       * QUALQUER motivo (permissão revogada, recurso indisponível,
       * etc.), falhava em silêncio total: nada aparecia, e não
       * sobrava rastro nenhum pra investigar depois — nem o próprio
       * usuário, nem nós, conseguiríamos saber que algo deu errado
       * aqui especificamente. Esse log fica disponível no DevTools
       * do navegador da PESSOA (Application → Service Workers →
       * Console) — não chega até nós automaticamente, mas pelo
       * menos existe, caso precise pedir pra alguém abrir e olhar
       * num caso futuro parecido com este.
       */
      .catch((error) => {
        console.error("[sw] Falha ao mostrar notificação", error, payload);
      })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/";

  /*
   * Se o site já estiver aberto numa aba, foca ELA e navega — em vez
   * de abrir uma aba nova toda vez. Quem clica em várias notificações
   * seguidas acabaria com meia dúzia de abas do SeenList abertas.
   */
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
