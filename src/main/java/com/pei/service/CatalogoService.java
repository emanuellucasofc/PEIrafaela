package com.pei.service;

import com.pei.dto.ItemCatalogoDTO;
import com.pei.dto.ItemCatalogoRequest;
import com.pei.model.CategoriaItem;
import com.pei.model.CelulaPei;
import com.pei.model.ItemCatalogo;
import com.pei.repository.CelulaPeiRepository;
import com.pei.repository.ItemCatalogoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class CatalogoService {

    private final ItemCatalogoRepository itemRepository;
    private final CelulaPeiRepository celulaRepository;

    public CatalogoService(ItemCatalogoRepository itemRepository, CelulaPeiRepository celulaRepository) {
        this.itemRepository = itemRepository;
        this.celulaRepository = celulaRepository;
    }

    /**
     * Busca itens do catálogo. Quando {@code programaIds} é informado, os itens vinculados a esses
     * programas são marcados como "sugeridos" e retornados primeiro; os demais itens continuam
     * disponíveis logo abaixo (busca geral).
     */
    @Transactional(readOnly = true)
    public List<ItemCatalogoDTO> buscar(CategoriaItem categoria, Collection<Long> programaIds, String busca) {
        String termo = (busca == null || busca.isBlank())
                ? null
                : "%" + busca.trim().toLowerCase(Locale.ROOT) + "%";
        Set<Long> programas = programaIds == null ? Set.of() : Set.copyOf(programaIds);

        return itemRepository.buscar(categoria, termo).stream()
                .map(item -> ItemCatalogoDTO.of(item,
                        item.getProgramaVinculado() != null
                                && programas.contains(item.getProgramaVinculado().getId())))
                .sorted(Comparator.comparing(ItemCatalogoDTO::sugerido).reversed()) // sort estável: mantém ordem alfabética
                .toList();
    }

    @Transactional(readOnly = true)
    public ItemCatalogoDTO buscarPorId(Long id) {
        return ItemCatalogoDTO.of(obter(id));
    }

    @Transactional
    public ItemCatalogoDTO criar(ItemCatalogoRequest req) {
        ItemCatalogo item = new ItemCatalogo();
        aplicar(item, req);
        return ItemCatalogoDTO.of(itemRepository.save(item));
    }

    @Transactional
    public ItemCatalogoDTO atualizar(Long id, ItemCatalogoRequest req) {
        ItemCatalogo item = obter(id);
        if (item.getCategoria() == CategoriaItem.PROGRAMA && req.categoria() != CategoriaItem.PROGRAMA) {
            itemRepository.desvincularDoPrograma(id);
        }
        aplicar(item, req);
        return ItemCatalogoDTO.of(item);
    }

    /** Remove o item do catálogo, retirando-o antes de todos os quadrados e vínculos que o referenciam. */
    @Transactional
    public void excluir(Long id) {
        ItemCatalogo item = obter(id);
        for (CelulaPei celula : celulaRepository.findByItemSelecionado(id)) {
            celula.getItensSelecionados().removeIf(i -> i.getId().equals(id));
        }
        if (item.getCategoria() == CategoriaItem.PROGRAMA) {
            itemRepository.desvincularDoPrograma(id);
        }
        itemRepository.delete(item);
    }

    @Transactional(readOnly = true)
    public List<ItemCatalogo> obterTodos(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        List<ItemCatalogo> encontrados = itemRepository.findAllById(ids);
        if (encontrados.size() != Set.copyOf(ids).size()) {
            throw new RecursoNaoEncontradoException("Um ou mais itens do catálogo não foram encontrados");
        }
        return encontrados;
    }

    private void aplicar(ItemCatalogo item, ItemCatalogoRequest req) {
        item.setCategoria(req.categoria());
        item.setTitulo(req.titulo().trim());
        item.setDescricao(req.descricao() == null || req.descricao().isBlank() ? null : req.descricao().trim());

        if (req.programaVinculadoId() != null && req.categoria().aceitaVinculoPrograma()) {
            ItemCatalogo programa = obter(req.programaVinculadoId());
            if (programa.getCategoria() != CategoriaItem.PROGRAMA) {
                throw new IllegalArgumentException("O item vinculado deve ser da categoria PROGRAMA");
            }
            item.setProgramaVinculado(programa);
        } else {
            item.setProgramaVinculado(null);
        }
    }

    private ItemCatalogo obter(Long id) {
        return itemRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Item do catálogo não encontrado: " + id));
    }
}

