/* ================= MOSTRADOR ================= */

export function abrirWhatsAppConfirmacion(pedido) {
  if (!pedido?.cliente_telefono) return;

  const telefono = pedido.cliente_telefono.toString().replace(/\D/g, "");
  if (telefono.length < 8) return;

  const items = pedido.pedido_items
    ?.map(i => `• ${i.cantidad}x ${i.nombre}`)
    .join("\n");

  const mensaje = encodeURIComponent(
`👋 Hola ${pedido.cliente_nombre || ""}

✅ *Tu pedido #${pedido.id} ha sido CONFIRMADO*

🛍️ *Detalle del pedido:*
${items || "• Sin detalle"}

💵 *Total:* $${pedido.total}

📌 Estamos preparando tu pedido.
Te avisaremos apenas esté listo.

¡Gracias por tu compra! 🙌`
  );

  window.open(`https://wa.me/${telefono}?text=${mensaje}`, "_blank");
}

/* ================= DELIVERY ================= */

export async function abrirWhatsAppDelivery(pedido) {
  if (!pedido?.cliente_telefono) return;

  const telefono = pedido.cliente_telefono.toString().replace(/\D/g, "");
  if (telefono.length < 8) return;

  const direccion =
    pedido.direccion_entrega ||
    pedido.cliente_direccion ||
    "Dirección no especificada";

  const items = pedido.pedido_items
    ?.map(i => `• ${i.cantidad}x ${i.nombre}`)
    .join("\n");

  const mensaje = encodeURIComponent(
`👋 Hola ${pedido.cliente_nombre || ""}

✅ *Tu pedido #${pedido.id} ha sido CONFIRMADO*
🚚 *Tipo:* Delivery

📍 *Dirección de entrega:*
${direccion}

🛍️ *Detalle del pedido:*
${items || "• Sin detalle"}

💵 *Total:* $${pedido.total}

⏳ En breve comenzaremos el despacho.
Te iremos informando el estado.

¡Gracias por tu preferencia! 🙌`
  );

  window.open(`https://wa.me/${telefono}?text=${mensaje}`, "_blank");
}
