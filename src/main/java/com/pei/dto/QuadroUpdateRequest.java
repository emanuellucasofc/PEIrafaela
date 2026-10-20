package com.pei.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Salvamento completo do planejamento (botão "Salvar Planejamento"). */
public record QuadroUpdateRequest(
        @Size(max = 200, message = "O título deve ter no máximo 200 caracteres")
        String titulo,

        List<@Valid CelulaUpdateRequest> celulas
) {
}

