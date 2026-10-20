package com.pei.repository;

import com.pei.model.CategoriaItem;
import com.pei.model.CelulaPei;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CelulaPeiRepository extends JpaRepository<CelulaPei, Long> {

    Optional<CelulaPei> findByQuadroIdAndIndiceColunaAndTipoLinha(Long quadroId, Integer indiceColuna, CategoriaItem tipoLinha);

    /** Células que referenciam um item (usado antes de excluir o item do catálogo). */
    @Query("select distinct c from CelulaPei c join c.itensSelecionados i where i.id = :itemId")
    List<CelulaPei> findByItemSelecionado(@Param("itemId") Long itemId);
}

