-- Migration: atualiza orgs com niche='beauty_wellness' para 'barbearia'
-- Contexto: Nexora é exclusivamente para barbearias no piloto.
-- A plataforma usa org.niche para mostrar wizard de onboarding, sidebar Nexora,
-- e pipeline stages corretos. Orgs criadas antes de 2026-05-24 têm niche='beauty_wellness'.
-- Esta migration corrige retroativamente.
--
-- SEGURA: idempotente, não toca pipeline stages, não altera aiPrompts.
-- Usuários podem aplicar o template 'barbearia_v1' nas configurações para
-- atualizar stages e prompts se necessário.

UPDATE "organizations"
SET "niche" = 'barbearia'
WHERE "niche" = 'beauty_wellness';
