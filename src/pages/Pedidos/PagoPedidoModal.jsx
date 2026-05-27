import { useState, useEffect } from "react";
import "../../styles/pagoPedido.css";

export default function PagoPedidoModal({ pedido, onClose, onConfirm }) {
  const total = Number(pedido?.total || 0);
  const propinaDefault = Math.round(total * 0.1);

  const [metodo, setMetodo] = useState("efectivo");
  const [propina, setPropina] = useState(propinaDefault);
  const [usarPropina, setUsarPropina] = useState(true);

  useEffect(() => {
    setPropina(propinaDefault);
    setUsarPropina(true);
  }, [pedido, propinaDefault]);

  return (
    <div className="ppm-backdrop">
      <div className="ppm-card">
        {/* HEADER */}
        <div className="ppm-header">
          <h3>Cerrar pedido #{pedido.id}</h3>

          <button className="ppm-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* METODO PAGO */}
        <div className="ppm-section">
          <label>Método de pago</label>

          <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            <option value="efectivo">Efectivo</option>
            <option value="debito">Tarjeta Débito</option>
            <option value="credito">Tarjeta Crédito</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </div>

        {/* PROPINA */}
        <div className="ppm-section">
          <label className="ppm-propina-check">
            <input
              type="checkbox"
              checked={usarPropina}
              onChange={(e) => {
                const checked = e.target.checked;
                setUsarPropina(checked);
                setPropina(checked ? propinaDefault : 0);
              }}
            />
            Agregar propina (10%)
          </label>

          <input
            type="number"
            min="0"
            disabled={!usarPropina}
            value={propina}
            onChange={(e) => setPropina(Number(e.target.value))}
          />
        </div>

        {/* RESUMEN */}
        <div className="ppm-total">
          <div>Total pedido: ${total.toLocaleString("es-CL")}</div>
          <div>Propina: ${(usarPropina ? propina : 0).toLocaleString("es-CL")}</div>

          <strong>
            Total final: $
            {(total + (usarPropina ? propina : 0)).toLocaleString("es-CL")}
          </strong>
        </div>

        {/* FOOTER */}
        <div className="ppm-footer">
          <button className="ppm-cancel" onClick={onClose}>
            Cancelar
          </button>

          <button
            className="ppm-confirm"
            onClick={() =>
              onConfirm({
                metodo_pago: metodo,
                propina: usarPropina ? propina : 0,
              })
            }
          >
            Confirmar entrega
          </button>
        </div>
      </div>
    </div>
  );
}
