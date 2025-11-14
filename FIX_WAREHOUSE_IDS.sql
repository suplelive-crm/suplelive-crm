-- ============================================================================
-- Script para Corrigir Warehouse IDs sem Prefixo "bl_"
-- ============================================================================
-- Este script adiciona o prefixo "bl_" aos warehouse_id que estão faltando
-- Execute este script no Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. Verificar quais warehouse_ids estão SEM o prefixo "bl_"
-- ============================================================================
SELECT DISTINCT warehouse_id
FROM public.product_stock_by_warehouse
WHERE warehouse_id NOT LIKE 'bl_%'
ORDER BY warehouse_id;

-- Esperado: Deve mostrar IDs como "45039", "45090", etc sem o prefixo

-- ============================================================================
-- 2. Contar quantos registros serão afetados
-- ============================================================================
SELECT COUNT(*) as total_registros_sem_prefixo
FROM public.product_stock_by_warehouse
WHERE warehouse_id NOT LIKE 'bl_%';

-- ============================================================================
-- 3. Atualizar warehouse_id na tabela product_stock_by_warehouse
-- ============================================================================
-- IMPORTANTE: Isto vai MODIFICAR os dados! Execute com cuidado

UPDATE public.product_stock_by_warehouse
SET warehouse_id = CONCAT('bl_', warehouse_id)
WHERE warehouse_id NOT LIKE 'bl_%'
AND warehouse_id ~ '^[0-9]+$'; -- Apenas se for numérico (segurança extra)

-- ============================================================================
-- 4. Atualizar warehouse_id na tabela products (campo warehouseID)
-- ============================================================================
UPDATE public.products
SET "warehouseID" = CONCAT('bl_', "warehouseID")
WHERE "warehouseID" NOT LIKE 'bl_%'
AND "warehouseID" ~ '^[0-9]+$'; -- Apenas se for numérico

-- ============================================================================
-- 5. Atualizar warehouse_id nos logs de estoque
-- ============================================================================
UPDATE public.stock_change_logs
SET warehouse_id = CONCAT('bl_', warehouse_id)
WHERE warehouse_id NOT LIKE 'bl_%'
AND warehouse_id ~ '^[0-9]+$'; -- Apenas se for numérico

-- ============================================================================
-- 6. Verificação Final
-- ============================================================================
-- Verificar se ainda existem warehouse_ids SEM o prefixo
SELECT DISTINCT warehouse_id
FROM public.product_stock_by_warehouse
WHERE warehouse_id NOT LIKE 'bl_%'
ORDER BY warehouse_id;

-- Esperado: Deve retornar vazio se tudo foi corrigido

-- Verificar quantos registros agora TÊM o prefixo
SELECT COUNT(*) as total_com_prefixo
FROM public.product_stock_by_warehouse
WHERE warehouse_id LIKE 'bl_%';

-- Listar os warehouse_ids únicos após a correção
SELECT DISTINCT warehouse_id
FROM public.product_stock_by_warehouse
ORDER BY warehouse_id;

-- ============================================================================
-- CONCLUÍDO!
-- ============================================================================
-- Todos os warehouse_id agora devem ter o prefixo "bl_"
-- Exemplo: "45039" → "bl_45039"
-- ============================================================================
