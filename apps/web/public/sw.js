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
    self.registration.showNotification(payload.title ?? "SeenList", {
      body: payload.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Agrupa notificações do mesmo assunto em vez de empilhar
      // várias iguais — evita o efeito "20 avisos da mesma série".
      tag: payload.tag ?? undefined,
      data: { url: payload.url ?? "/" },
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
