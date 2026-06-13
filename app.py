from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import yfinance as yf
import numpy as np

app = Flask(__name__)
CORS(app)

# =============================
# HOME ROUTE
# =============================
@app.route("/")
def home():
    return render_template("index.html")


# =============================
# PREDICT ROUTE
# =============================
@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        symbol = data.get("symbol", "").strip().upper()
        country = data.get("country", "")
        duration = data.get("duration", "")

        # =============================
        # VALIDATION
        # =============================
        if not symbol:
            return jsonify({"error": "Stock symbol required"}), 400

        if duration not in ["3", "7", "30"]:
            return jsonify({"error": "Invalid duration"}), 400

        days = int(duration)

        # =============================
        # COUNTRY SYMBOL HANDLING
        # =============================
        if country == "India":
            if not symbol.endswith(".NS"):
                symbol = symbol + ".NS"

        # =============================
        # FETCH DATA
        # =============================
        stock = yf.Ticker(symbol)
        hist = stock.history(period="6mo", interval="1d")

        if hist.empty or "Close" not in hist:
            return jsonify({"error": "Invalid stock or no data available"}), 400

        # =============================
        # CLEAN DATA (CRITICAL FIX)
        # =============================
        close_prices = hist["Close"].dropna().values

        if len(close_prices) < 10:
            return jsonify({"error": "Not enough data"}), 400

        last_price = float(close_prices[-1])

        # =============================
        # SIMPLE STABLE PREDICTION
        # =============================
        future_preds = []

        last_vals = list(close_prices[-3:])

        # safety padding
        while len(last_vals) < 3:
            last_vals.insert(0, last_vals[0])

        for _ in range(days):
            pred = (
                last_vals[-1] * 0.5 +
                last_vals[-2] * 0.3 +
                last_vals[-3] * 0.2
            )

            future_preds.append(float(round(pred, 2)))
            last_vals.append(pred)

        # =============================
        # CHANGE CALCULATION
        # =============================
        final_change = ((future_preds[-1] - last_price) / last_price) * 100

        # =============================
        # CONFIDENCE (SAFE)
        # =============================
        volatility = np.std(close_prices[-30:])
        confidence = max(50, min(95, 100 - (volatility / last_price * 100)))

        # =============================
        # RESPONSE
        # =============================
        return jsonify({
            "symbol": symbol,
            "last_price": round(last_price, 2),
            "future_preds": future_preds,
            "final_change": round(final_change, 2),
            "confidence": round(confidence, 2)
        })

    except Exception as e:
        print("ERROR:", str(e))
        return jsonify({"error": "Server error"}), 500


# =============================
# RUN
# =============================
if __name__ == "__main__":
    app.run(debug=True)