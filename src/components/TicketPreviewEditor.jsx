import { useMemo } from "react";
import { MARCA_PIE_TICKET } from "../utils/ticketSucursalConfig";
import "../styles/ticketPreview.css";

const DEMO_ITEMS = [
  { qty: 2, name: "Chorrillana", sub: 18000 },
  { qty: 1, name: "Coca Cola", sub: 2500 },
];
const DEMO_SUBTOTAL = 20500;
const DEMO_PROPINA = 2050;
const DEMO_TOTAL = 22550;

function fmtMoney(n) {
  return `$${Number(n).toLocaleString("es-CL")}`;
}

function padLine(left, right, width = 42) {
  const l = String(left);
  const r = String(right);
  const space = width - l.length - r.length;
  if (space >= 1) return `${l}${" ".repeat(space)}${r}`;
  return `${l.slice(0, Math.max(0, width - r.length - 1))} ${r}`;
}

function TicketLine({ left, right }) {
  return <div className="ticket-locked-line">{padLine(left, right)}</div>;
}

/**
 * Vista previa editable del ticket POS (solo parte visual).
 */
export default function TicketPreviewEditor({
  form,
  onFieldChange,
  fallbackNombre = "",
  fallbackDireccion = "",
  fallbackTelefono = "",
}) {
  const fechaEjemplo = useMemo(
    () =>
      new Date().toLocaleString("es-CL", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    []
  );

  const marca = MARCA_PIE_TICKET.split("\n");

  const patch = (field, value) => onFieldChange(field, value);

  const phDireccion =
    (fallbackDireccion || "").trim() || "Dirección (o usa la de la sucursal)";
  const phTelefono =
    (fallbackTelefono || "").trim() || "Teléfono (o usa el de la sucursal)";

  return (
    <div className="ticket-preview-wrap">
      <p className="ticket-preview-hint mb-0">
        Editá directamente en el ticket de ejemplo. Los productos y totales son solo
        referencia — en la impresión real salen del pedido de la mesa.
      </p>

      <div className="ticket-preview-paper">
        <div className="ticket-preview-center">
          <hr className="rule-solid" />
          <input
            type="text"
            className="ticket-edit ticket-edit-title"
            value={form.nombre_ticket || ""}
            placeholder={(fallbackNombre || "RESTOBAR CENTRAL").toUpperCase()}
            onChange={(e) => patch("nombre_ticket", e.target.value)}
            aria-label="Nombre comercial"
          />
          <input
            type="text"
            className="ticket-edit"
            value={form.subtitulo_ticket || ""}
            placeholder="Razón social (opcional)"
            onChange={(e) => patch("subtitulo_ticket", e.target.value)}
            aria-label="Razón social"
          />
          <input
            type="text"
            className="ticket-edit"
            value={form.direccion_ticket || ""}
            placeholder={phDireccion}
            onChange={(e) => patch("direccion_ticket", e.target.value)}
            aria-label="Dirección en ticket"
          />
          <input
            type="text"
            className="ticket-edit"
            value={form.telefono_ticket || ""}
            placeholder={phTelefono}
            onChange={(e) => patch("telefono_ticket", e.target.value)}
            aria-label="Teléfono en ticket"
          />
          <input
            type="text"
            className="ticket-edit"
            value={form.instagram_ticket || ""}
            placeholder="@restobarcentral"
            onChange={(e) => patch("instagram_ticket", e.target.value)}
            aria-label="Instagram o redes"
          />
          <input
            type="text"
            className="ticket-edit ticket-edit-msg-superior"
            value={form.mensaje_superior_ticket || ""}
            placeholder="Mensaje superior (opcional)"
            onChange={(e) => patch("mensaje_superior_ticket", e.target.value)}
            aria-label="Mensaje superior"
          />
          <hr className="rule-solid" />
        </div>

        <div className="ticket-locked ticket-locked-meta">
          <div>
            <strong>Mesa 5</strong>
          </div>
          <div>Fecha: {fechaEjemplo}</div>
        </div>

        <hr className="rule" />

        {DEMO_ITEMS.map((it) => (
          <TicketLine
            key={it.name}
            left={`${it.qty}x ${it.name}`}
            right={fmtMoney(it.sub)}
          />
        ))}

        <hr className="rule" />

        <div className="ticket-locked">
          <TicketLine left="Subtotal" right={fmtMoney(DEMO_SUBTOTAL)} />
          <TicketLine left="Propina sugerida (10%)" right={fmtMoney(DEMO_PROPINA)} />
          <div className="ticket-locked-line ticket-locked-total">
            {padLine("TOTAL", fmtMoney(DEMO_TOTAL))}
          </div>
        </div>

        <hr className="rule" />

        <textarea
          className="ticket-edit ticket-edit-footer"
          rows={2}
          value={form.mensaje_final_ticket || ""}
          placeholder={"Gracias por su visita\nVuelva pronto"}
          onChange={(e) => patch("mensaje_final_ticket", e.target.value)}
          aria-label="Mensaje final"
        />

        <div className="ticket-brand-locked" title="Siempre se imprime al final">
          <div className="brand-name">{marca[0]}</div>
          <div className="brand-sub">{marca[1]}</div>
        </div>
      </div>

      <div className="ticket-preview-legend">
        <span>
          <i className="ticket-legend-edit" aria-hidden /> Editable
        </span>
        <span>
          <i className="ticket-legend-lock" aria-hidden /> Solo ejemplo (pedido real)
        </span>
      </div>
    </div>
  );
}
