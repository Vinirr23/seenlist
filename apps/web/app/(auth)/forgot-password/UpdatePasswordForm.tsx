"use client";

import { useActionState } from "react";
import { updatePassword, type AuthActionState } from "@/lib/actions/auth";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { FormFeedback } from "@/components/auth/FormFeedback";

const initialState: AuthActionState = { error: null };

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState(updatePassword, initialState);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text">Definir nova senha</h1>
        <p className="mt-1 text-sm text-muted">Escolha uma senha nova para sua conta.</p>
      </div>

      <form action={formAction} className="space-y-4">
        <FormField
          id="password"
          name="password"
          type="password"
          label="Nova senha"
          placeholder="Mínimo 8 caracteres"
          required
          autoComplete="new-password"
        />
        <FormField
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label="Confirmar nova senha"
          placeholder="Repita a senha"
          required
          autoComplete="new-password"
        />
        <FormFeedback error={state.error} />
        <SubmitButton>Salvar senha</SubmitButton>
      </form>
    </div>
  );
}
