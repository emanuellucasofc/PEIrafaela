package com.pei.repository;

import com.pei.model.Crianca;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CriancaRepository extends JpaRepository<Crianca, Long> {

    List<Crianca> findAllByOrderByNomeAsc();
}

