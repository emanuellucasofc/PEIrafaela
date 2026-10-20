package com.pei.dto;

import com.pei.model.CategoriaItem;
import com.pei.model.CelulaPei;

import java.util.List;

/** Conteúdo de um quadrado do quadro PEI. */
public record CelulaDTO(
        Long id,
        Integer indiceColuna,
        CategoriaItem tipoLinha,
        String corCabecalho,
        List<ItemCatalogoDTO> itensSelecionados,
        String textoLivre
) {

    public static CelulaDTO of(CelulaPei c) {
        return new CelulaDTO(
                c.getId(),
                c.getIndiceColuna(),
                c.getTipoLinha(),
                c.getCorCabecalho(),
                c.getItensSelecionados().stream().map(ItemCatalogoDTO::of).toList(),
                c.getTextoLivre()
        );
    }
}

