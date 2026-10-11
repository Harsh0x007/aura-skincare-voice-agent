
import { useEffect, useState } from "react";
import { ShoppingBag, Plus, Minus, CheckCircle2 } from "lucide-react";
import "./ProductShop.css";

export default function ProductShop({ onOrderPlaced }) {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState({});
    const [address, setAddress] = useState("");
    const [loading, setLoading] = useState(true);
    const [checkingOut, setCheckingOut] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function loadProducts() {
            try {
                const response = await fetch("/api/products");
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Could not load products.");
                }

                if (!cancelled) setProducts(data.products || []);
            } catch (err) {
                if (!cancelled) setError(err.message || "Could not load products.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadProducts();
        return () => {
            cancelled = true;
        };
    }, []);

    function changeQuantity(product, amount) {
        setCart((current) => {
            const next = { ...current };
            const quantity = (next[product.id] || 0) + amount;

            if (quantity <= 0) {
                delete next[product.id];
            } else if (quantity <= product.stock) {
                next[product.id] = quantity;
            }

            return next;
        });
        setError("");
        setSuccess(null);
    }

    const cartItems = products
        .filter((product) => cart[product.id] > 0)
        .map((product) => ({
            product_id: product.id,
            quantity: cart[product.id],
            name: product.name,
            price: product.price,
        }));

    const total = cartItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );

    async function placeOrder(event) {
        event.preventDefault();
        setError("");
        setSuccess(null);

        const token = localStorage.getItem("aura_token");

        if (!token) {
            setError("Please log in again before placing your order.");
            return;
        }

        if (!cartItems.length) {
            setError("Please add at least one product to your cart.");
            return;
        }

        if (!address.trim()) {
            setError("Please enter your delivery address.");
            return;
        }

        setCheckingOut(true);

        try {
            const response = await fetch("/api/orders/checkout", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    items: cartItems.map(({ product_id, quantity }) => ({
                        product_id,
                        quantity,
                    })),
                    delivery_address: address.trim(),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Could not place your order.");
            }

            setSuccess(data.order);
            setCart({});
            setAddress("");

            const refreshed = await fetch("/api/products");
            if (refreshed.ok) {
                const refreshedData = await refreshed.json();
                setProducts(refreshedData.products || []);
            }

            if (onOrderPlaced) await onOrderPlaced(data.order);
        } catch (err) {
            setError(err.message || "Could not connect to the server.");
        } finally {
            setCheckingOut(false);
        }
    }

    return (
        <section className="shop-section" id="shop">
            <div className="shop-heading">
                <div>
                    <span className="shop-eyebrow">THE AURA COLLECTION</span>
                    <h2>Care for your skin.</h2>
                    <p>Thoughtful skincare for your everyday routine.</p>
                </div>
                <div className="shop-cart-count">
                    <ShoppingBag size={19} />
                    <span>{cartItems.reduce((sum, item) => sum + item.quantity, 0)} items</span>
                </div>
            </div>

            {loading ? (
                <p className="shop-message">Loading products...</p>
            ) : products.length === 0 ? (
                <p className="shop-message">No products are available right now.</p>
            ) : (
                <div className="product-grid">
                    {products.map((product) => {
                        const quantity = cart[product.id] || 0;

                        return (
                            <article className="product-card" key={product.id}>
                                <div className="product-art">
                                    <span className="product-art-mark"><LeafIcon /></span>
                                    <span className="product-art-label">AURA SKINCARE</span>
                                </div>

                                <div className="product-info">
                                    <h3>{product.name}</h3>
                                    <p>{product.description || "A little care for your daily routine."}</p>

                                    <div className="product-bottom">
                                        <strong>₹{(product.price / 100).toFixed(2)}</strong>

                                        {product.stock <= 0 ? (
                                            <span className="stock-label">Out of stock</span>
                                        ) : quantity === 0 ? (
                                            <button
                                                className="add-cart-button"
                                                onClick={() => changeQuantity(product, 1)}
                                            >
                                                <Plus size={15} /> Add
                                            </button>
                                        ) : (
                                            <div className="quantity-control">
                                                <button
                                                    aria-label={`Remove one ${product.name}`}
                                                    onClick={() => changeQuantity(product, -1)}
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span>{quantity}</span>
                                                <button
                                                    aria-label={`Add one ${product.name}`}
                                                    disabled={quantity >= product.stock}
                                                    onClick={() => changeQuantity(product, 1)}
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <small className="stock-note">
                                        {product.stock} available
                                    </small>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            <form className="checkout-panel" onSubmit={placeOrder}>
                <div className="checkout-title">
                    <ShoppingBag size={20} />
                    <h3>Your cart</h3>
                </div>

                {cartItems.length === 0 ? (
                    <p className="shop-message">Add a product above to start your order.</p>
                ) : (
                    <>
                        <div className="cart-lines">
                            {cartItems.map((item) => (
                                <div className="cart-line" key={item.product_id}>
                                    <span>{item.name} × {item.quantity}</span>
                                    <strong>₹{((item.price * item.quantity) / 100).toFixed(2)}</strong>
                                </div>
                            ))}
                        </div>

                        <div className="cart-total">
                            <span>Order total</span>
                            <strong>₹{(total / 100).toFixed(2)}</strong>
                        </div>
                    </>
                )}

                <label className="address-label" htmlFor="aura-delivery-address">
                    Delivery address
                </label>
                <textarea
                    id="aura-delivery-address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Enter your complete delivery address"
                    maxLength={500}
                    rows={3}
                    required
                />

                <div className="payment-note">Payment method: Cash on Delivery (COD)</div>

                {error && <p className="shop-error" role="alert">{error}</p>}

                {success && (
                    <div className="shop-success" role="status">
                        <CheckCircle2 size={21} />
                        <div>
                            <strong>Order placed successfully!</strong>
                            <p>Order ID: {success.order_id}</p>
                            <p>Total: ₹{(success.total_amount / 100).toFixed(2)}</p>
                            <p>Payment: Cash on Delivery</p>
                        </div>
                    </div>
                )}

                <button
                    className="checkout-button"
                    type="submit"
                    disabled={checkingOut || loading || cartItems.length === 0}
                >
                    {checkingOut ? "Placing order..." : "Place order"}
                </button>
            </form>
        </section>
    );
}

function LeafIcon() {
    return <span aria-hidden="true">✿</span>;
}
