import "../../styles/pagoPedido.css";

export default function ModalPagosTarjeta({ kpis, onClose }) {
  const totalTarjeta = kpis?.pagosMonto?.tarjeta || 0;
  const debitoMonto = kpis?.pagosMonto?.debito || 0;
  const creditoMonto = kpis?.pagosMonto?.credito || 0;

  const debitoCantidad = kpis?.pagosCantidad?.debito || 0;
  const creditoCantidad = kpis?.pagosCantidad?.credito || 0;
  const cantidadTarjeta = kpis?.pagosCantidad?.tarjeta || 0;

  return (
    <div className="ppm-backdrop" onClick={onClose}>
      <div className="ppm-card" onClick={(e) => e.stopPropagation()}>
        
        {/* HEADER */}
        <div className="ppm-header">
          <h3>Pagos con tarjeta</h3>

          <button className="ppm-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* CONTENIDO */}
        <div className="ppm-section">
          <label>Resumen</label>

          <div className="ppm-total">
            <div>
              Total pagos tarjeta: $
              {totalTarjeta.toLocaleString("es-CL")}
            </div>

            <div>
              Débito: ${debitoMonto.toLocaleString("es-CL")} ({debitoCantidad})
            </div>

            <div>
              Crédito: ${creditoMonto.toLocaleString("es-CL")} ({creditoCantidad})
            </div>

            <strong>
              Cantidad transacciones: {cantidadTarjeta}
            </strong>
          </div>
        </div>

        {/* FOOTER */}
        <div className="ppm-footer">
          <button className="ppm-cancel" onClick={onClose}>
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
