-- Mensaje final personalizable en ticket / pre-cuenta impresa
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS mensaje_ticket text;

COMMENT ON COLUMN sucursales.mensaje_ticket IS 'Texto al pie del ticket impreso (pre-cuenta mesas).';
