# PEI — Plano Educacional Individualizado (Planejamento dos Atendimentos)

Aplicação web full-stack desenvolvida em **Java 17+ e Spring Boot 3.5** (com suporte híbrido para deploy direto na **Vercel + Supabase PostgreSQL**) para gerenciamento e montagem interativa de quadros de **PLANEJAMENTO DOS ATENDIMENTOS**, catálogo relacional pré-cadastrado, sugestão inteligente por programa, autosave por célula e impressão/PDF em **A4 Paisagem** com fidelidade cromática.

---

## 1. Como Executar Localmente (Java / Spring Boot + H2)

Com o Maven Wrapper incluído no projeto:

```powershell
# Windows (PowerShell / CMD)
.\mvnw.cmd spring-boot:run

# Linux / macOS
./mvnw spring-boot:run
```

Acesse no navegador:
* **Quadro PEI (Tela Principal):** `http://localhost:8080/`
* **Gerenciar Banco de Dados (Cadastros):** `http://localhost:8080/cadastros`
* **Console H2 Database:** `http://localhost:8080/h2-console` (`JDBC URL`: `jdbc:h2:file:./data/peidb;AUTO_SERVER=TRUE`, usuário `sa`, senha em branco)

---

## 2. Deploy na Vercel + Supabase (PostgreSQL)

O repositório já possui suporte híbrido ([`vercel.json`](vercel.json), [`api/index.js`](api/index.js), [`public/`](public/) e [`supabase/schema.sql`](supabase/schema.sql)) compatível com o mesmo schema JPA/Hibernate do Spring Boot:

1. **No Supabase:**
   * Crie um projeto no [Supabase](https://supabase.com/).
   * Copie a **Connection String (URI)** em **Project Settings → Database → Connection string → Transaction pooler (porta 6543)** (ou Session pooler).
   * *(Opcional)* Você pode executar o script [`supabase/schema.sql`](supabase/schema.sql) no **SQL Editor** do Supabase, mas **não é obrigatório**: na primeira requisição, a API cria automaticamente as tabelas e popula o banco com as 2 crianças, 56 itens do catálogo e 1 quadro de exemplo.
2. **Na Vercel:**
   * Importe o repositório `https://github.com/emanuellucasofc/PEIrafaela.git`.
   * Em **Environment Variables**, adicione:
     * `DATABASE_URL` = `postgresql://postgres.[SEU-PROJETO]:[SUA-SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`
   * Clique em **Deploy**.

---

## 3. Conectando o Spring Boot Localmente ao Supabase

Caso queira rodar o backend Java/Spring Boot conectado diretamente ao banco PostgreSQL do Supabase:

```powershell
$env:DB_URL="jdbc:postgresql://aws-0-sa-east-1.pooler.supabase.com:6543/postgres?prepareThreshold=0&sslmode=require"
$env:DB_USER="postgres.[SEU-PROJETO]"
$env:DB_PASSWORD="[SUA-SENHA]"
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=postgres"
```
