package com.pei.service;

/** Lançada quando um recurso solicitado não existe (mapeada para HTTP 404). */
public class RecursoNaoEncontradoException extends RuntimeException {

    public RecursoNaoEncontradoException(String mensagem) {
        super(mensagem);
    }
}

