# Bibliotecas WASM

Coloque aqui os arquivos do `sql.js` para distribuir a aplicacao sem depender da internet:

- `sql-wasm.js`
- `sql-wasm.wasm`

A aplicacao tenta carregar primeiro `lib/sql-wasm.js`. Se ele nao existir, tenta usar `https://sql.js.org/dist/sql-wasm.js` como fallback.

Para uma distribuicao autocontida, use sempre os dois arquivos locais.

Para importacao/exportacao Excel offline, coloque tambem:

- `xlsx.full.min.js`

A aplicacao tenta carregar primeiro `lib/xlsx.full.min.js`. Se ele nao existir, tenta usar uma CDN como fallback.
