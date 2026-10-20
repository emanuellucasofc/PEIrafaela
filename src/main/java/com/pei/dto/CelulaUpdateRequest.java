package com.pei.dto;

import com.pei.model.CategoriaItem;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Atualização de um quadrado específico (identificado por coluna + linha). */
public record CelulaUpdateRequest(
        @NotNull(message = "indiceColuna é obrigatório")
        @Min(value = 0, message = "indiceColuna mínimo é 0")
        @Max(value = 10, message = "indiceColuna máximo é 10")
        Integer indiceColuna,

        @NotNull(message = "tipoLinha é obrigatório")
        CategoriaItem tipoLinha,

        /** IDs dos itens do catálogo, na ordem desejada. */
        List<Long> itensIds,

        @Size(max = 4000, message = "O texto livre deve ter no máximo 4000 caracteres")
        String textoLivre,

        /** Opcional: altera a cor da coluna (apenas linha PROGRAMA). Formato #RRGGBB. */
        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Cor inválida (use #RRGGBB)")
        String corCabecalho
) {
}

