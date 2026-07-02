"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpWithEmail, type AuthActionState } from "@/lib/actions/auth";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { FormFeedback } from "@/components/auth/FormFeedback";

const initialState: AuthActionState = { error: null };

export default function RegisterPage() {
  const [state, formAction] = useActionState(signUpWithEmail, initialState);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text">Criar conta</h1>
        <p className="mt-1 text-sm text-muted">Leva menos de um minuto.</p>
      </div>

      <GoogleButton />

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="space-y-4">
        <FormField
          id="email"
          name="email"
          type="email"
          label="E-mail"
          placeholder="voce@exemplo.com"
          required
          autoComplete="email"
        />
        <FormField
          id="password"
          name="password"
          type="password"
          label="Senha"
          placeholder="Mínimo 8 caracteres"
          required
          autoComplete="new-password"
        />
        <FormField
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label="Confirmar senha"
          placeholder="Repita a senha"
          required
          autoComplete="new-password"
        />
        <FormFeedback error={state.error} message={state.message} />
        <SubmitButton>Criar conta</SubmitButton>
      </form>

      <p className="text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-primary hover:opacity-80">
          Entrar
        </Link>
      </p>
    </div>
  );
}
