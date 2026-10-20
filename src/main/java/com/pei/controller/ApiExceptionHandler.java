package com.pei.controller;

import com.pei.service.RecursoNaoEncontradoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.stream.Collectors;

/** Converte exceções em respostas JSON (RFC 7807 ProblemDetail) para os endpoints REST. */
@RestControllerAdvice(annotations = RestController.class)
public class ApiExceptionHandler {

    @ExceptionHandler(RecursoNaoEncontradoException.class)
    public ProblemDetail naoEncontrado(RecursoNaoEncontradoException ex) {
        return problema(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail validacao(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getDefaultMessage())
                .distinct()
                .collect(Collectors.joining("; "));
        return problema(HttpStatus.BAD_REQUEST, msg.isBlank() ? "Dados inválidos" : msg);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ProblemDetail validacaoMetodo(HandlerMethodValidationException ex) {
        return problema(HttpStatus.BAD_REQUEST, "Dados inválidos");
    }

    @ExceptionHandler({IllegalArgumentException.class, MethodArgumentTypeMismatchException.class})
    public ProblemDetail requisicaoInvalida(Exception ex) {
        String msg = ex instanceof MethodArgumentTypeMismatchException m
                ? "Valor inválido para o parâmetro '" + m.getName() + "'"
                : ex.getMessage();
        return problema(HttpStatus.BAD_REQUEST, msg);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ProblemDetail jsonInvalido(HttpMessageNotReadableException ex) {
        return problema(HttpStatus.BAD_REQUEST, "Corpo da requisição inválido");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail conflito(DataIntegrityViolationException ex) {
        return problema(HttpStatus.CONFLICT, "Operação viola a integridade dos dados");
    }

    private static ProblemDetail problema(HttpStatus status, String detalhe) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detalhe);
        pd.setTitle(status.getReasonPhrase());
        return pd;
    }
}

