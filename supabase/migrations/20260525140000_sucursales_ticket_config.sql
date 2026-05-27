-- Configuración visual del ticket (pre-cuenta mesas)
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS nombre_ticket text;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS subtitulo_ticket text;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS direccion_ticket text;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS telefono_ticket text;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS instagram_ticket text;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS mensaje_superior_ticket text;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS mensaje_final_ticket text;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS info_adicional_ticket text;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS ticket_encabezado_orden jsonb;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS ticket_ver_nombre boolean DEFAULT true;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS ticket_ver_subtitulo boolean DEFAULT true;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS ticket_ver_direccion boolean DEFAULT true;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS ticket_ver_telefono boolean DEFAULT true;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS ticket_ver_instagram boolean DEFAULT true;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS ticket_ver_mensaje_superior boolean DEFAULT true;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS ticket_ver_mensaje_final boolean DEFAULT true;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS ticket_ver_info_adicional boolean DEFAULT true;

-- Compatibilidad con columna anterior
UPDATE sucursales
SET mensaje_final_ticket = mensaje_ticket
WHERE mensaje_final_ticket IS NULL AND mensaje_ticket IS NOT NULL;
