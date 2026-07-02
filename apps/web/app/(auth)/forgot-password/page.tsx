import { createClient } from "@/lib/supabase/server";
import { RequestResetForm } from "./RequestResetForm";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

/**
 * TASK-002 autoriza só 3 rotas (/login, /register, /forgot-password),
 * mas um fluxo de recuperação de senha completo tem dois momentos:
 * pedir o link, e depois definir a senha nova ao voltar do e-mail.
 * Em vez de criar uma quarta rota, esta página decide o que mostrar
 * no servidor: sem sessão → formulário de pedir o link; com sessão
 * (chegou aqui pelo link de recuperação, via /auth/callback) →
 * formulário de definir a senha nova.
 */
export default async function ForgotPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? <UpdatePasswordForm /> : <RequestResetForm />;
}
