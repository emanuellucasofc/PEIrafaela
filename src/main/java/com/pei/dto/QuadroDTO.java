package com.pei.dto;

import com.pei.model.QuadroPei;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

/** Quadro PEI completo, com todos os quadrados. */
public record QuadroDTO(
        Long id,
        String titulo,
        Long criancaId,
        String criancaNome,
        LocalDate dataCriacao,
        int totalColunas,
        List<CelulaDTO> celulas
) {

    public static QuadroDTO of(QuadroPei q, int totalColunas) {
        List<CelulaDTO> celulas = q.getCelulas().stream()
                .sorted(Comparator.comparing((com.pei.model.CelulaPei c) -> c.getTipoLinha().ordinal())
                        .thenComparing(com.pei.model.CelulaPei::getIndiceColuna))
                .map(CelulaDTO::of)
                .toList();
        return new QuadroDTO(q.getId(), q.getTitulo(), q.getCrianca().getId(), q.getCrianca().getNome(),
                q.getDataCriacao(), totalColunas, celulas);
    }
}

