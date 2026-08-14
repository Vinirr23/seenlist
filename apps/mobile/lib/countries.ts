/**
 * A PEDIDO — lista fixa de países pro campo "país" do perfil (era
 * texto livre, trocado por seletor). Os valores (`value`) são
 * exatamente os mesmos que `check-new-releases` (Supabase Edge
 * Function) já reconhece no mapeamento país→fuso horário — escolher
 * um país aqui garante que a notificação de episódio novo bate no
 * fuso certo da pessoa, sem depender de digitação livre.
 *
 * Escrito em português (o app é PT-first) — vira a peça de dado
 * salva no perfil, igual antes; só que agora vem de uma lista
 * fechada, não mais texto livre.
 */
export interface Country {
  value: string;
  labelKey: string;
}

export const COUNTRIES: Country[] = [
  { value: "Brasil", labelKey: "country.brasil" },
  { value: "Portugal", labelKey: "country.portugal" },
  { value: "Estados Unidos", labelKey: "country.estadosUnidos" },
  { value: "Espanha", labelKey: "country.espanha" },
  { value: "México", labelKey: "country.mexico" },
  { value: "Argentina", labelKey: "country.argentina" },
  { value: "Reino Unido", labelKey: "country.reinoUnido" },
  { value: "Japão", labelKey: "country.japao" },
  { value: "Canadá", labelKey: "country.canada" },
  { value: "Colômbia", labelKey: "country.colombia" },
  { value: "Chile", labelKey: "country.chile" },
  { value: "Peru", labelKey: "country.peru" },
  { value: "Itália", labelKey: "country.italia" },
  { value: "França", labelKey: "country.franca" },
  { value: "Alemanha", labelKey: "country.alemanha" },
  { value: "Austrália", labelKey: "country.australia" },
  { value: "Uruguai", labelKey: "country.uruguai" },
  { value: "Paraguai", labelKey: "country.paraguai" },
  { value: "Venezuela", labelKey: "country.venezuela" },
  { value: "Equador", labelKey: "country.equador" },
  { value: "Bolívia", labelKey: "country.bolivia" },
  { value: "Angola", labelKey: "country.angola" },
  { value: "Moçambique", labelKey: "country.mocambique" },
  { value: "Outro", labelKey: "country.outro" },
];
