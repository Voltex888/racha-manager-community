# Migração de fundos para Supabase Storage

- Fundos personalizados agora são enviados para o bucket público `racha-media` no Supabase.
- Caminho usado: `backgrounds/{raridade}/{contexto}/{timestamp}_{arquivo}`.
- O Firestore continua armazenando somente URL pública, caminho, provedor, versão e ajustes visuais.
- IndexedDB continua apenas como cache/fallback local e não substitui um fundo remoto carregado.
- Fundos antigos do Firebase/local continuam compatíveis; ao salvar novamente, passam para o Supabase.
- A remoção de um fundo desassocia o fundo do sistema. O arquivo Supabase antigo pode permanecer no bucket porque as políticas atuais liberam insert/select, não delete.
- Fotos dos jogadores continuam no Supabase conforme a versão anterior.
- Músicas não foram alteradas.
