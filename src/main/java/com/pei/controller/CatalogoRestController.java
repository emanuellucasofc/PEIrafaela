package com.pei.controller;

import com.pei.dto.ItemCatalogoDTO;
import com.pei.dto.ItemCatalogoRequest;
import com.pei.model.CategoriaItem;
import com.pei.service.CatalogoService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/catalogo")
public class CatalogoRestController {

    private final CatalogoService catalogoService;

    public CatalogoRestController(CatalogoService catalogoService) {
        this.catalogoService = catalogoService;
    }

    /**
     * GET /api/catalogo?categoria=RECURSO&programaId=1&programaId=2&busca=bloco
     * <p>
     * Itens vinculados aos programas informados vêm primeiro, com {@code sugerido=true}.
     */
    @GetMapping
    public List<ItemCatalogoDTO> listar(@RequestParam(required = false) CategoriaItem categoria,
                                        @RequestParam(name = "programaId", required = false) List<Long> programaIds,
                                        @RequestParam(required = false) String busca) {
        return catalogoService.buscar(categoria, programaIds, busca);
    }

    @GetMapping("/{id}")
    public ItemCatalogoDTO buscar(@PathVariable Long id) {
        return catalogoService.buscarPorId(id);
    }

    /** Metadados das categorias (rótulos das linhas do quadro). */
    @GetMapping("/categorias")
    public List<Map<String, Object>> categorias() {
        return Arrays.stream(CategoriaItem.values())
                .map(c -> Map.<String, Object>of(
                        "valor", c.name(),
                        "rotuloLinha", c.getRotuloLinha(),
                        "nome", c.getNomePlural(),
                        "aceitaVinculoPrograma", c.aceitaVinculoPrograma()))
                .toList();
    }

    @PostMapping
    public ResponseEntity<ItemCatalogoDTO> criar(@Valid @RequestBody ItemCatalogoRequest req) {
        ItemCatalogoDTO criado = catalogoService.criar(req);
        return ResponseEntity
                .created(ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(criado.id()).toUri())
                .body(criado);
    }

    @PutMapping("/{id}")
    public ItemCatalogoDTO atualizar(@PathVariable Long id, @Valid @RequestBody ItemCatalogoRequest req) {
        return catalogoService.atualizar(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable Long id) {
        catalogoService.excluir(id);
    }
}

