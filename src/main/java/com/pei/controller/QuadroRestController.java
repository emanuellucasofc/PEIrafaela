package com.pei.controller;

import com.pei.dto.CelulaDTO;
import com.pei.dto.CelulaUpdateRequest;
import com.pei.dto.QuadroDTO;
import com.pei.dto.QuadroUpdateRequest;
import com.pei.service.QuadroService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/**
 * API do quadro PEI. Disponível em {@code /api/quadros} e também no alias {@code /api/pei}.
 */
@RestController
@RequestMapping({"/api/quadros", "/api/pei"})
public class QuadroRestController {

    private final QuadroService quadroService;

    public QuadroRestController(QuadroService quadroService) {
        this.quadroService = quadroService;
    }

    /** Carrega o quadro com todos os quadrados preenchidos. */
    @GetMapping("/{id}")
    public QuadroDTO obter(@PathVariable Long id) {
        return quadroService.obter(id);
    }

    /** Cria um novo quadro em branco para a criança. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public QuadroDTO criar(@RequestParam Long criancaId, @RequestParam(required = false) String titulo) {
        return quadroService.criar(criancaId, titulo);
    }

    /** Autosave de um quadrado: itens selecionados + texto livre (+ cor opcional da coluna). */
    @PutMapping("/{id}/celula")
    public CelulaDTO atualizarCelula(@PathVariable Long id, @Valid @RequestBody CelulaUpdateRequest req) {
        return quadroService.atualizarCelula(id, req);
    }

    /** Salvamento completo (botão "Salvar Planejamento"). */
    @PutMapping("/{id}")
    public QuadroDTO salvar(@PathVariable Long id, @Valid @RequestBody QuadroUpdateRequest req) {
        return quadroService.salvar(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable Long id) {
        quadroService.excluir(id);
    }
}

