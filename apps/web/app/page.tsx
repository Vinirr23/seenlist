import { redirect } from "next/navigation";

/**
 * "/" não tem tela própria — o layout principal (TASK-003) vive em
 * /series /movies /explore /profile. Quem chegar em "/" (autenticado,
 * o middleware garante isso) cai na primeira aba.
 */
export default function RootPage() {
  redirect("/series");
}
