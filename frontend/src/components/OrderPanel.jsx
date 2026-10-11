
import {
  Package,
  Truck,
  CheckCircle2,
  Leaf,
  Phone,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";

export default function OrderPanel({
  orders,
  lookupOrder,
  lookupId,
  setLookupId,
  lookupResult,
}) {
  return (
    <aside className="side-column">
      <div className="panel order-panel">
        <div className="panel-heading">
          <div>
            <span className="mini-label">QUICK REFERENCE</span>
            <h3>Test orders</h3>
          </div>
          <Package size={20} />
        </div>

        <p className="panel-intro">
          Try asking Aria about any of these sample orders during your call.
        </p>

        <div className="order-list">
          {orders.map((order) => (
            <div className="order-item" key={order.order_id}>
              <div className="order-icon">
                <Package size={17} />
              </div>

              <div className="order-info">
                <div className="order-id">
                  {order.order_id}
                  <span
                    className={`status-tag ${order.status
                      .toLowerCase()
                      .replaceAll(" ", "-")}`}
                  >
                    {order.status}
                  </span>
                </div>

                <strong>{order.product}</strong>
                <span className="order-customer">
                  {order.customer} · ₹{order.value}
                </span>
                <small>{order.notes}</small>
              </div>
            </div>
          ))}
        </div>

        <form className="lookup-form" onSubmit={lookupOrder}>
          <label htmlFor="order-id">Look up an order</label>

          <div className="lookup-row">
            <input
              id="order-id"
              value={lookupId}
              onChange={(event) => setLookupId(event.target.value)}
              placeholder="e.g. ORD-101"
            />

            <button type="submit" aria-label="Search order">
              <ArrowUpRight size={17} />
            </button>
          </div>
        </form>

        {lookupResult && (
          <div
            className={`lookup-result ${
              lookupResult.error ? "failed" : ""
            }`}
          >
            {lookupResult.error ? (
              lookupResult.error
            ) : (
              <>
                <strong>
                  {lookupResult.order_id} · {lookupResult.status}
                </strong>
                <span>{lookupResult.product}</span>
                <span>
                  {lookupResult.carrier
                    ? `${lookupResult.carrier} · ${lookupResult.tracking_id}`
                    : lookupResult.notes}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="panel policy-panel">
        <div className="panel-heading">
          <div>
            <span className="mini-label">THE ESSENTIALS</span>
            <h3>Our policies</h3>
          </div>
          <Leaf size={20} />
        </div>

        <div className="policy-row">
          <div className="policy-icon">
            <Truck size={17} />
          </div>
          <div>
            <strong>Delivery</strong>
            <p>3–5 business days. Free over ₹499; otherwise ₹50.</p>
          </div>
        </div>

        <div className="policy-row">
          <div className="policy-icon">
            <CheckCircle2 size={17} />
          </div>
          <div>
            <strong>Returns</strong>
            <p>
              Within 7 days for unopened, unused products in original
              packaging.
            </p>
          </div>
        </div>

        <div className="policy-row">
          <div className="policy-icon">
            <Package size={17} />
          </div>
          <div>
            <strong>Damaged items</strong>
            <p>Report within 48 hours with photos for replacement.</p>
          </div>
        </div>

        <div className="policy-row">
          <div className="policy-icon">
            <Phone size={17} />
          </div>
          <div>
            <strong>Cancellation</strong>
            <p>Only while the order is Processing.</p>
          </div>
        </div>
      </div>

      <div className="tip-card">
        <Sparkles size={17} />
        <div>
          <strong>Try asking Aria</strong>
          <p>
            “Where is ORD-101?” · “Can I return ORD-102?” ·
            “Can I cancel ORD-103?”
          </p>
        </div>
      </div>
    </aside>
  );
}
