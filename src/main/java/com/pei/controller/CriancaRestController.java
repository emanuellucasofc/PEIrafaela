package com.pei.controller;

import com.pei.dto.CriancaDTO;
import com.pei.dto.QuadroDTO;
import com.pei.dto.QuadroResumoDTO;
import com.pei.service.CriancaService;
import com.pei.service.QuadroService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/criancas")
public class CriancaRestController {

    private final CriancaService criancaService;
    private final QuadroService quadroService;

    public CriancaRestController(CriancaService criancaService, QuadroService quadroService) {
        this.criancaService = criancaService;
        this.quadroService = quadroService;
    }

    @GetMapping
    public List<CriancaDTO> listar() {
        return criancaService.listar();
    }

    @GetMapping("/{id}")
    public CriancaDTO buscar(@PathVariable Long id) {
        return criancaService.buscarPorId(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CriancaDTO criar(@Valid @RequestBody CriancaDTO dto) {
        return criancaService.criar(dto);
    }

    @PutMapping("/{id}")
    public CriancaDTO atualizar(@PathVariable Long id, @Valid @RequestBody CriancaDTO dto) {
        return criancaService.atualizar(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable Long id) {
        criancaService.excluir(id);
    }

    /** Quadro mais recente da criança (cria um em branco se não houver). */
    @GetMapping("/{id}/quadro")
    public QuadroDTO quadroAtual(@PathVariable Long id) {
        return quadroService.obterOuCriarPorCrianca(id);
    }

    /** Histórico de quadros da criança. */
    @GetMapping("/{id}/quadros")
    public List<QuadroResumoDTO> quadros(@PathVariable Long id) {
        return quadroService.listarPorCrianca(id);
    }
}

