# Migração de músicas para Supabase Storage

- Novas músicas agora são enviadas para o bucket público `racha-media` no caminho `music/{id}/{timestamp}-{arquivo}`.
- O Firestore continua armazenando apenas os metadados da biblioteca e a URL pública da faixa.
- Trocas de arquivo usam um caminho versionado novo para evitar cache antigo.
- Músicas locais antigas continuam compatíveis e podem ser reenviadas com “Enviar p/ todos”.
- Arquivos legados do Firebase Storage continuam tocando pela URL já salva; o app não depende mais do Firebase Storage para novos uploads de música.
- O bucket atual possui políticas de INSERT/SELECT. Por isso, arquivos antigos do Supabase não são apagados automaticamente ao trocar/excluir uma música. Isso evita erro de permissão; pode-se adicionar policy de DELETE depois se quiser limpeza automática.
