package com.pei.repository;

import com.pei.model.QuadroPei;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface QuadroPeiRepository extends JpaRepository<QuadroPei, Long> {

    Optional<QuadroPei> findFirstByCriancaIdOrderByIdDesc(Long criancaId);

    List<QuadroPei> findByCriancaIdOrderByIdDesc(Long criancaId);
}

