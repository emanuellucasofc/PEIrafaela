package com.pei.service;

import com.pei.dto.CriancaDTO;
import com.pei.model.Crianca;
import com.pei.repository.CriancaRepository;
import com.pei.repository.QuadroPeiRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CriancaService {

    private final CriancaRepository criancaRepository;
    private final QuadroPeiRepository quadroRepository;

    public CriancaService(CriancaRepository criancaRepository, QuadroPeiRepository quadroRepository) {
        this.criancaRepository = criancaRepository;
        this.quadroRepository = quadroRepository;
    }

    @Transactional(readOnly = true)
    public List<CriancaDTO> listar() {
        return criancaRepository.findAllByOrderByNomeAsc().stream().map(CriancaDTO::of).toList();
    }

    @Transactional(readOnly = true)
    public CriancaDTO buscarPorId(Long id) {
        return CriancaDTO.of(obter(id));
    }

    @Transactional
    public CriancaDTO criar(CriancaDTO dto) {
        Crianca c = new Crianca();
        aplicar(c, dto);
        return CriancaDTO.of(criancaRepository.save(c));
    }

    @Transactional
    public CriancaDTO atualizar(Long id, CriancaDTO dto) {
        Crianca c = obter(id);
        aplicar(c, dto);
        return CriancaDTO.of(c);
    }

    /** Exclui a criança e todos os seus quadros PEI (as células são removidas em cascata). */
    @Transactional
    public void excluir(Long id) {
        Crianca c = obter(id);
        quadroRepository.deleteAll(quadroRepository.findByCriancaIdOrderByIdDesc(id));
        criancaRepository.delete(c);
    }

    Crianca obter(Long id) {
        return criancaRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Criança não encontrada: " + id));
    }

    private static void aplicar(Crianca c, CriancaDTO dto) {
        c.setNome(dto.nome().trim());
        c.setDataNascimento(dto.dataNascimento());
        c.setPreferenciasPadrao(blankToNull(dto.preferenciasPadrao()));
        c.setObservacoesGerais(blankToNull(dto.observacoesGerais()));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}

