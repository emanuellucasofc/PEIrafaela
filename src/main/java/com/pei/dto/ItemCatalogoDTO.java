package com.pei.dto;

import com.pei.model.CategoriaItem;
import com.pei.model.ItemCatalogo;

/**
 * Representação de um item do catálogo para a API.
 *
 * @param sugerido true quando o item está vinculado a um dos programas informados na busca
 */
public record ItemCatalogoDTO(
        Long id,
        CategoriaItem categoria,
        String titulo,
        String descricao,
        Long programaVinculadoId,
        String programaVinculadoTitulo,
        boolean sugerido
) {

    public static ItemCatalogoDTO of(ItemCatalogo item) {
        return of(item, false);
    }

    public static ItemCatalogoDTO of(ItemCatalogo item, boolean sugerido) {
        ItemCatalogo programa = item.getProgramaVinculado();
        return new ItemCatalogoDTO(
                item.getId(),
                item.getCategoria(),
                item.getTitulo(),
                item.getDescricao(),
                programa != null ? programa.getId() : null,
                programa != null ? programa.getTitulo() : null,
                sugerido
        );
    }
}

