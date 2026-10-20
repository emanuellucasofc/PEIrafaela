package com.pei.dto;

import com.pei.model.QuadroPei;

import java.time.LocalDate;

/** Resumo de um quadro (para listas/seletores). */
public record QuadroResumoDTO(Long id, String titulo, LocalDate dataCriacao) {

    public static QuadroResumoDTO of(QuadroPei q) {
        return new QuadroResumoDTO(q.getId(), q.getTitulo(), q.getDataCriacao());
    }
}

