package com.pei.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/** Salvamento completo do planejamento (título, período e células). */
public record QuadroUpdateRequest(
        @Size(max = 200, message = "O título deve ter no máximo 200 caracteres")
        String titulo,

        LocalDate dataInicio,

        LocalDate dataFim,

        List<@Valid CelulaUpdateRequest> celulas
) {
}
