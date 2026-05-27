import { getCajaActiva, registrarMovimiento } from "../services/cajaService";

/**
 * Tras marcar un pedido como pagado/cerrado: registra venta en caja abierta si existe.
 * No lanza; fallos solo se registran en consola para no bloquear el flujo de pedidos.
 */
export async function registrarVentaCajaSiAplica({
  sucursalId,
  pedidoId,
  totalPedido,
}) {
  if (!sucursalId || pedidoId == null) return;

  try {
    const caja = await getCajaActiva(sucursalId);
    if (!caja?.id) return;

    const monto = Number(totalPedido || 0);

    await registrarMovimiento({
      caja_id: caja.id,
      tipo: "venta",
      monto,
      descripcion: `Pedido #${pedidoId}`,
    });
  } catch (e) {
    console.warn("[caja] Venta no registrada en caja:", e?.message || e);
  }
}
