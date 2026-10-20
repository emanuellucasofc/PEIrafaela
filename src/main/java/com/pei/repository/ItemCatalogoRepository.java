package com.pei.repository;

import com.pei.model.CategoriaItem;
import com.pei.model.ItemCatalogo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ItemCatalogoRepository extends JpaRepository<ItemCatalogo, Long> {

    /**
     * Busca flexível: categoria e termo de busca são opcionais (null = sem filtro).
     * O termo deve chegar já normalizado em minúsculas e com curingas (%termo%).
     */
    @Query("""
            select i from ItemCatalogo i
            left join fetch i.programaVinculado p
            where (:categoria is null or i.categoria = :categoria)
              and (:busca is null
                   or lower(i.titulo) like :busca
                   or lower(coalesce(i.descricao, '')) like :busca)
            order by i.categoria, lower(i.titulo)
            """)
    List<ItemCatalogo> buscar(@Param("categoria") CategoriaItem categoria,
                              @Param("busca") String busca);

    long countByCategoria(CategoriaItem categoria);

    Optional<ItemCatalogo> findFirstByCategoriaAndTituloIgnoreCase(CategoriaItem categoria, String titulo);

    @Modifying
    @Query("update ItemCatalogo i set i.programaVinculado = null where i.programaVinculado.id = :programaId")
    int desvincularDoPrograma(@Param("programaId") Long programaId);
}

