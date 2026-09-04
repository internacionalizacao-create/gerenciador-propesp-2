"use client";

import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";

import { Campo } from "@/componentes/ui/campos";
import { Combobox, type OpcaoCombobox } from "@/componentes/ui/combobox";

/**
 * `Combobox` dentro da moldura de campo do sistema.
 *
 * Fica fora de `campos.tsx` de proposito: aquele arquivo reune os controles que
 * o `register` do React Hook Form consegue registrar direto no DOM. O combobox
 * nao e um input nativo, entao precisa de `Controller` — misturar os dois
 * padroes no mesmo arquivo faria parecer que `registro=` funcionaria aqui.
 */
export function CampoCombobox<T extends FieldValues>({
  rotulo,
  nome,
  control,
  opcoes,
  dica,
  erro,
  obrigatorio,
  placeholder,
  placeholderBusca,
  textoVazio,
  desabilitado,
}: {
  rotulo: string;
  nome: Path<T>;
  control: Control<T>;
  opcoes: readonly OpcaoCombobox[];
  dica?: React.ReactNode;
  erro?: string;
  obrigatorio?: boolean;
  placeholder?: string;
  placeholderBusca?: string;
  textoVazio?: string;
  desabilitado?: boolean;
}) {
  return (
    <Campo rotulo={rotulo} dica={dica} erro={erro} obrigatorio={obrigatorio}>
      {(id, descritoPor) => (
        <Controller
          control={control}
          name={nome}
          render={({ field }) => (
            <Combobox
              id={id}
              descritoPor={descritoPor}
              nome={field.name}
              opcoes={opcoes}
              valor={(field.value as string | undefined) ?? ""}
              aoMudar={field.onChange}
              desabilitado={desabilitado}
              invalido={Boolean(erro)}
              placeholder={placeholder}
              placeholderBusca={placeholderBusca}
              textoVazio={textoVazio}
            />
          )}
        />
      )}
    </Campo>
  );
}
