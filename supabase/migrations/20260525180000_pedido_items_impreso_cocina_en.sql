-- Tracking incremental comandas cocina/barra por ítem de pedido.
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS impreso_cocina_en timestamptz;

COMMENT ON COLUMN pedido_items.impreso_cocina_en IS 'Marca de comanda cocina/barra impresa; NULL = pendiente de imprimir.';
