-- Momento en que el pedido pasó a entregado/enviado; los reportes por turno lo priorizan sobre creado_en.
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cerrado_en timestamptz;

COMMENT ON COLUMN pedidos.cerrado_en IS 'Marca temporal de cierre (entregado/enviado); métricas por turno usan este instante si existe.';
