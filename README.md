# Staffing App

Aplicacao HTML unica para o sistema de staffing.

## Arquivos

- `staffing.html`: ponto de entrada unico da aplicacao.
- `css/staffing.css`: estilos visuais e responsividade.
- `js/sample-data.js`: estrutura inicial vazia da aplicacao.
- `js/database.js`: integracao com SQLite/WASM via `sql.js`.
- `js/app.js`: navegacao SPA, renderizacao das telas e alertas.
- `lib/`: local para `sql-wasm.js` e `sql-wasm.wasm`.
- `data/`: reservado para `staffing.db`.

## Telas Incluidas

- Dashboard
- Projetos com criacao e edicao gravando no SQLite em memoria
- Projetos com exportacao/importacao Excel em lote
- Posicoes com criacao e edicao gravando no SQLite em memoria
- Candidatos com criacao e edicao gravando no SQLite em memoria
- Candidatos com exportacao/importacao Excel em lote
- Pipeline com filtro por projeto, visao em lista, visao em quadro, criacao e edicao de candidaturas gravando no SQLite em memoria
- Calendario com navegacao por meses e visoes Mes e Lista para projetos, posicoes, roles, candidaturas e alertas
- Roles criadas/geridas na ferramenta
- Importacao de pessoas e calendarios externos
- Skills com criacao e edicao gravando no SQLite em memoria
- Skills com exportacao/importacao Excel em lote
- Alertas operacionais com severidade, recálculo e ações de correção
- Relatorios

## Banco SQLite

Na primeira execucao, a aplicacao cria um banco SQLite em memoria com o schema vazio. O botao de salvar exporta um arquivo `staffing.db`.

Se nenhum banco tiver sido carregado, salvar cria um banco novo antes de exportar.

O botao de abrir permite selecionar um arquivo `.db`, `.sqlite` ou `.sqlite3` existente.

IDs tecnicos sao gerados automaticamente pela aplicacao usando UUID. O usuario nao deve cadastrar IDs manualmente.

## Alertas Implementados

- Posicao sem Role.
- Posicao sem skills.
- Datas da posicao fora do periodo do projeto.
- Posicao aberta vinculada a Role em espera ou cancelada.
- Role importada sem posicao associada.
- Candidato alocado em Role diferente da Role da posicao.
- Role da posicao ja reservada para outra pessoa.
- Candidatura confirmada em posicao sem Role.
- Candidatura ativa para candidato inativo.
- Candidato ativo sem skills.
