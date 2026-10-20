package com.pei.dto;

import com.pei.model.CategoriaItem;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Payload para criar/editar itens do catálogo. */
public record ItemCatalogoRequest(
        @NotNull(message = "A categoria é obrigatória")
        CategoriaItem categoria,

        @NotBlank(message = "O título é obrigatório")
        @Size(max = 200, message = "O título deve ter no máximo 200 caracteres")
        String titulo,

        @Size(max = 1000, message = "A descrição deve ter no máximo 1000 caracteres")
        String descricao,

        Long programaVinculadoId
) {
}

