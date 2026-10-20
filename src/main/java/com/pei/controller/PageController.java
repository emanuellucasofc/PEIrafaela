package com.pei.controller;

import com.pei.model.CategoriaItem;
import com.pei.service.CriancaService;
import com.pei.service.QuadroService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/** Controllers de página (Thymeleaf). Os dados dinâmicos são carregados via API REST. */
@Controller
public class PageController {

    private final CriancaService criancaService;

    public PageController(CriancaService criancaService) {
        this.criancaService = criancaService;
    }

    /** Tela principal: Quadro PEI com 11 colunas coloridas e 5 linhas. */
    @GetMapping("/")
    public String quadro(@RequestParam(required = false) Long criancaId, Model model) {
        model.addAttribute("criancas", criancaService.listar());
        model.addAttribute("criancaSelecionada", criancaId);
        model.addAttribute("categorias", CategoriaItem.values());
        model.addAttribute("paleta", QuadroService.PALETA_COLUNAS);
        model.addAttribute("totalColunas", QuadroService.TOTAL_COLUNAS);
        return "quadro";
    }

    /** Tela de gerenciamento do banco de dados (cadastros). */
    @GetMapping("/cadastros")
    public String cadastros(Model model) {
        model.addAttribute("categorias", CategoriaItem.values());
        return "cadastros";
    }
}

