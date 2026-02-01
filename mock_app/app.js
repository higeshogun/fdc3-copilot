// OMS Application Logic

// Global Order ID Counter
let orderIdCounter = 1001;

// Instrument Metadata
const instruments = {
    'AAPL': { name: 'Apple Inc.', chg: 1.24 },
    'MSFT': { name: 'Microsoft Corp.', chg: 0.85 },
    'NVDA': { name: 'Nvidia Corp.', chg: -0.32 },
    'TSLA': { name: 'Tesla Inc.', chg: -1.50 },
    'EUR/USD': { name: 'Euro / US Dollar', chg: 0.18 },
    'GBP/USD': { name: 'British Pound / US Dollar', chg: 0.22 },
    'USD/JPY': { name: 'US Dollar / Japanese Yen', chg: 0.35 },
    'AUD/USD': { name: 'Australian Dollar / US Dollar', chg: -0.12 },
    'US2Y': { name: 'US Treasury 2Y Note', chg: 0.05 },
    'US5Y': { name: 'US Treasury 5Y Note', chg: 0.03 },
    'US10Y': { name: 'US Treasury 10Y Note', chg: 0.02 },
    'US30Y': { name: 'US Treasury 30Y Bond', chg: 0.01 }
};

// Position State
let positions = {
    'AAPL': { long: 15000, short: 0, cost: 180.50 },
    'MSFT': { long: 12000, short: 0, cost: 410.20 },
    'NVDA': { long: 8000, short: 0, cost: 890.00 },
    'TSLA': { long: 0, short: 500, cost: 180.00 },
    'EUR/USD': { long: 1000000, short: 0, cost: 1.0820 },
    'GBP/USD': { long: 500000, short: 0, cost: 1.2610 },
    'US10Y': { long: 2500000, short: 0, cost: 4.150 }
};

let prices = {
    'AAPL': 189.45,
    'MSFT': 420.55,
    'NVDA': 950.02,
    'TSLA': 175.30,
    'EUR/USD': 1.0850,
    'GBP/USD': 1.2640,
    'USD/JPY': 151.42,
    'AUD/USD': 0.6520,
    'US2Y': 4.620,
    'US5Y': 4.212,
    'US10Y': 4.190,
    'US30Y': 4.350
};

// Order & Trade History State
let orders = [
    { time: '09:30:05', id: 'ORD-998', side: 'BUY', symbol: 'AAPL', qty: 100, price: 188.50, avgPx: 188.50, cumQty: 100, status: 'FILLED' },
    { time: '10:15:22', id: 'ORD-999', side: 'SELL', symbol: 'TSLA', qty: 500, price: 178.20, avgPx: 178.20, cumQty: 500, status: 'FILLED' },
    { time: '11:05:40', id: 'ORD-1000', side: 'BUY', symbol: 'EUR/USD', qty: 1000000, price: 1.0820, avgPx: 1.0820, cumQty: 1000000, status: 'FILLED' }
];
let trades = [
    { time: '09:30:05', execId: 'EXE-4998', orderId: 'ORD-998', side: 'BUY', symbol: 'AAPL', qty: 100, price: 188.50, cpty: 'GS' },
    { time: '10:15:22', execId: 'EXE-4999', orderId: 'ORD-999', side: 'SELL', symbol: 'TSLA', qty: 500, price: 178.20, cpty: 'JPM' },
    { time: '11:05:40', execId: 'EXE-5000', orderId: 'ORD-1000', side: 'BUY', symbol: 'EUR/USD', qty: 1000000, price: 1.0820, cpty: 'BARC' }
];
let execIdCounter = 5001;

let news = [
    { time: '13:45', headline: 'Treasury yields spike following unexpected inflation data.', related: ['US10Y', 'US30Y', 'US2Y', 'US5Y'] },
    { time: '13:12', headline: 'GBP/USD touches 3-month high on BOE hawkishness.', related: ['GBP/USD', 'EUR/USD'] },
    { time: '12:50', headline: 'NVDA earnings expectations reach fever pitch.', related: ['NVDA', 'AMD', 'MSFT'] },
    { time: '11:05', headline: 'Fed Governor signals patience on rate cuts.', related: ['US10Y', 'SPY'] },
    { time: '10:30', headline: 'Apple unveils new VR headset prototype.', related: ['AAPL'] },
    { time: '10:15', headline: 'Microsoft Azure gains market share in cloud computing.', related: ['MSFT', 'AMZN'] },
    { time: '09:45', headline: 'Tesla production numbers beat estimates.', related: ['TSLA'] },
    { time: '09:00', headline: 'Yen weakens as BOJ maintains yield curve control.', related: ['USD/JPY'] }
];

let newsFilterEnabled = false;
let currentContextSymbol = null;

let sortConfig = {
    watchlist: { key: null, dir: 'asc' },
    positions: { key: null, dir: 'asc' },
    orders: { key: 'time', dir: 'desc' },
    trades: { key: 'time', dir: 'desc' }
};

function sortGrid(gridId, key) {
    const cfg = sortConfig[gridId];
    if (cfg.key === key) {
        cfg.dir = cfg.dir === 'asc' ? 'desc' : 'asc';
    } else {
        cfg.key = key;
        cfg.dir = 'asc';
    }

    // Re-render
    if (gridId === 'watchlist') renderWatchlist();
    if (gridId === 'positions') renderPositions();
    if (gridId === 'orders') renderOrders();
    if (gridId === 'trades') renderTrades();

    updateSortIndicators(gridId, key, cfg.dir);
}

function updateSortIndicators(gridId, activeKey, dir) {
    const headerId = {
        watchlist: 'wl-header',
        positions: 'pos-header',
        orders: 'order-header',
        trades: 'trade-header'
    }[gridId];

    const header = document.getElementById(headerId);
    if (!header) return;

    header.querySelectorAll('.sort-indicator').forEach(el => el.remove());

    const target = Array.from(header.children).find(el => {
        const onclick = el.getAttribute('onclick') || "";
        return onclick.includes(`'${activeKey}'`);
    });

    if (target) {
        const indicator = document.createElement('span');
        indicator.className = 'sort-indicator';
        indicator.innerText = dir === 'asc' ? '▲' : '▼';
        target.appendChild(indicator);
    }
}

// --- FDC3 Interception ---
// Only define mock if not already injected by the agent
if (!window.fdc3) {
    const listeners = [];
    window.fdc3 = {
        broadcast: function (context) {
            console.log("Desktop Agent received broadcast (MOCK):", context);
            listeners.forEach(l => {
                if (!l.type || l.type === context.type) l.handler(context);
            });
        },
        raiseIntent: function (intent, context) {
            console.log("Desktop Agent received intent (MOCK):", intent, context);
        },
        addContextListener: function (type, handler) {
            if (typeof type === 'function') {
                handler = type;
                type = null;
            }
            const listener = { type, handler };
            listeners.push(listener);
            console.log(`FDC3 Mock: Added listener for ${type || 'all types'}`);
            return {
                unsubscribe: () => {
                    const idx = listeners.indexOf(listener);
                    if (idx > -1) listeners.splice(idx, 1);
                }
            };
        }
    };
}

function broadcastContext(context) {
    if (window.fdc3) {
        snoopFdc3(context.type, context);
        window.fdc3.broadcast(context);
    } else {
        console.warn("FDC3 not verified yet.");
    }
}

// --- UI Actions ---

function togglePanel(btn) {
    console.log("Toggle clicked", btn);
    const panel = btn.closest('.panel');
    if (panel) {
        panel.classList.toggle('collapsed');
        const icon = btn.querySelector('.icon');
        if (icon) {
            icon.textContent = panel.classList.contains('collapsed') ? '▶' : '▼';
        }
    }
}

function selectSymbol(ticker) {
    // 1. Update Ticket Form
    document.getElementById('ticket-symbol').value = ticker;

    // 2. Update Headers
    const chartHeader = document.getElementById('chart-symbol');
    if (chartHeader) chartHeader.innerText = ticker;
    const quoteHeader = document.getElementById('qt-symbol');
    if (quoteHeader) quoteHeader.innerText = ticker;

    // 3. Draw Chart & Update Quote
    drawChart(ticker);
    updateQuote(ticker);

    // 4. Broadcast Instrument
    const context = {
        type: 'fdc3.instrument',
        id: { ticker: ticker },
        name: ticker
    };
    broadcastContext(context);
}

function updateQuote(ticker) {
    let price = prices[ticker] || 150.00; // Use Simulated Price

    // Random jitter for bid/ask spread during quote updates
    const jitter = (Math.random() - 0.5) * 0.02;
    price += jitter;

    const spread = (ticker.includes('/')) ? 0.0001 : 0.04;
    const bid = price - (spread / 2);
    const ask = price + (spread / 2);

    document.getElementById('quote-bid').innerText = bid.toFixed(ticker.includes('/') ? 4 : 2);
    document.getElementById('quote-ask').innerText = ask.toFixed(ticker.includes('/') ? 4 : 2);

    renderMarketDepth(ticker, price);
}

function renderMarketDepth(ticker, price) {
    const depthContainer = document.getElementById('market-depth');
    if (!depthContainer) return;

    const decimals = tickerDecimals(ticker);
    const tickSize = ticker.includes('/') ? 0.0001 : (ticker.startsWith('US') ? 0.001 : 0.01);

    let html = `<table>
        <thead>
            <tr>
                <th>SIZE</th>
                <th>BID</th>
                <th>ASK</th>
                <th>SIZE</th>
            </tr>
        </thead>
        <tbody>`;

    for (let i = 1; i <= 4; i++) {
        const bidPx = price - (tickSize * i);
        const askPx = price + (tickSize * i);
        const bidSize = Math.floor(Math.random() * 1000 + 100);
        const askSize = Math.floor(Math.random() * 1000 + 100);

        const bidWidth = Math.min((bidSize / 1100) * 50, 50);
        const askWidth = Math.min((askSize / 1100) * 50, 50);

        html += `
            <tr class="depth-row-bg">
                <td class="depth-size depth-clickable" style="position:relative;" onclick="populateTicketFromDepth('SELL', ${bidPx}, ${bidSize})">
                    <div class="depth-bar bid" style="width: ${bidWidth * 2}%"></div>
                    ${bidSize.toLocaleString()}
                </td>
                <td class="depth-bid depth-clickable" onclick="populateTicketFromDepth('SELL', ${bidPx}, ${bidSize})">${bidPx.toFixed(decimals)}</td>
                <td class="depth-ask depth-clickable" onclick="populateTicketFromDepth('BUY', ${askPx}, ${askSize})">${askPx.toFixed(decimals)}</td>
                <td class="depth-size depth-clickable" style="position:relative;" onclick="populateTicketFromDepth('BUY', ${askPx}, ${askSize})">
                    <div class="depth-bar ask" style="width: ${askWidth * 2}%"></div>
                    ${askSize.toLocaleString()}
                </td>
            </tr>`;
    }

    html += `</tbody></table>`;
    depthContainer.innerHTML = html;
}

// --- Advanced Broadcasting ---

function broadcastSnapshot() {
    console.log("Creating System Snapshot...");
    broadcastWatchlist();
    broadcastPortfolio();
    broadcastOrders();
    broadcastTrades();

    // Broadcast active chart symbol
    const activeSymbol = document.getElementById('chart-symbol').innerText;
    if (activeSymbol) {
        broadcastContext({
            type: 'fdc3.instrument',
            id: { ticker: activeSymbol },
            name: activeSymbol
        });
    }
}

function broadcastOrders() {
    if (orders.length === 0) return;

    const orderHistory = {
        type: 'fdc3.collection',
        name: 'Order Blotter',
        members: orders.map(o => ({
            type: 'fdc3.order',
            id: { orderId: o.id },
            details: {
                symbol: o.symbol,
                side: o.side,
                qty: o.qty,
                price: o.price,
                status: o.status,
                time: o.time
            }
        }))
    };
    broadcastContext(orderHistory);
    console.log("Broadcasted Order Blotter:", orderHistory);
}

function broadcastTrades() {
    if (trades.length === 0) return;

    const tradeHistory = {
        type: 'fdc3.collection',
        name: 'Done Trades',
        members: trades.map(t => ({
            type: 'fdc3.trade',
            id: { execId: t.execId },
            details: {
                symbol: t.symbol,
                side: t.side,
                qty: t.qty,
                price: t.price,
                cpty: t.cpty,
                time: t.time
            }
        }))
    };
    broadcastContext(tradeHistory);
    console.log("Broadcasted Done Trades:", tradeHistory);
}

function broadcastPortfolio() {
    const portfolioPositions = [];
    Object.keys(positions).forEach(sym => {
        const p = positions[sym];
        const net = p.long - p.short;
        if (net !== 0) {
            portfolioPositions.push({
                type: 'fdc3.position',
                instrument: { type: 'fdc3.instrument', id: { ticker: sym } },
                holding: net
            });
        }
    });

    const portfolio = {
        type: 'fdc3.portfolio',
        name: 'Simulated Trading Portfolio',
        positions: portfolioPositions
    };
    broadcastContext(portfolio);
    console.log("Broadcasted Dynamic Portfolio:", portfolio);
}

function renderWatchlist() {
    const body = document.getElementById('watchlist-body');
    if (!body) return;
    body.innerHTML = '';

    const data = Object.keys(prices).map(sym => ({
        sym: sym,
        last: prices[sym],
        chg: instruments[sym] ? instruments[sym].chg : 0
    }));

    const cfg = sortConfig.watchlist;
    if (cfg.key) {
        data.sort((a, b) => {
            let vA = a[cfg.key];
            let vB = b[cfg.key];
            if (vA < vB) return cfg.dir === 'asc' ? -1 : 1;
            if (vA > vB) return cfg.dir === 'asc' ? 1 : -1;
            return 0;
        });
    }

    data.forEach(item => {
        const row = document.createElement('div');
        row.className = 'row';
        row.id = `wl-${item.sym}`;
        row.onclick = () => selectSymbol(item.sym);

        const chgClass = item.chg >= 0 ? 'pos' : 'neg';
        const chgSign = item.chg >= 0 ? '+' : '';
        const decimals = tickerDecimals(item.sym);

        row.innerHTML = `
            <span class="symbol">${item.sym}</span>
            <span class="price">${item.last.toFixed(decimals)}</span>
            <span class="change ${chgClass}">${chgSign}${item.chg.toFixed(2)}%</span>
        `;
        body.appendChild(row);
    });
}

function broadcastWatchlist() {
    const instruments = Object.keys(prices).map(ticker => ({
        type: 'fdc3.instrument',
        id: { ticker: ticker }
    }));

    const listContext = {
        type: 'fdc3.instrumentList',
        name: 'Main Watchlist',
        instruments: instruments
    };
    broadcastContext(listContext);
    console.log("Broadcasted Instrument List:", listContext);
}

function updatePosition(symbol, side, qty, price) {
    if (!positions[symbol]) positions[symbol] = { long: 0, short: 0, cost: 0 };

    const pos = positions[symbol];
    let net = pos.long - pos.short;

    // Logic: 
    // 1. Calculate impact on Cost Basis FIRST before changing quantities
    // 2. Adjust Long/Short quantities

    if (side === 'BUY') {
        // If we are Short, this is a Cover (Cost unch, Realized PL)
        // If we are Long/Flat, this is an Open (Update Cost)

        let remainingQty = qty;

        // 1. Cover Short first
        if (pos.short > 0) {
            const cover = Math.min(pos.short, remainingQty);
            pos.short -= cover;
            remainingQty -= cover;
            // Cost basis for the covered portion is irrelevant for the remaining position 
            // unless we flip to long.
        }

        // 2. Go Long with remaining
        if (remainingQty > 0) {
            const oldQty = pos.long;
            const oldCost = pos.cost;
            // Weighted Average Price
            pos.cost = ((oldQty * oldCost) + (remainingQty * price)) / (oldQty + remainingQty);
            pos.long += remainingQty;
        }

        // If we were short and are now flat/long, or if we were flat and went long
        // Ensure cost is set correctly if we started from 0
        if (pos.long > 0 && pos.short === 0 && pos.cost === 0) {
            // Should have been caught by WAP logic, but safety net
            pos.cost = price;
        }

        pos.settleDate = calculateSettlement(symbol); // Update stored settlement
    } else { // SELL
        // If we are Long, this is a Close (Cost unch, Realized PL)
        // If we are Short/Flat, this is an Open (Update Cost)

        let remainingQty = qty;

        // 1. Close Long first
        if (pos.long > 0) {
            const close = Math.min(pos.long, remainingQty);
            pos.long -= close;
            remainingQty -= close;
        }

        // 2. Go Short with remaining
        if (remainingQty > 0) {
            const oldQty = pos.short;
            const oldCost = pos.cost; // Use same field for avg short price
            pos.cost = ((oldQty * oldCost) + (remainingQty * price)) / (oldQty + remainingQty);
            pos.short += remainingQty;
        }

        pos.settleDate = calculateSettlement(symbol); // Update stored settlement
    }

    // Safety: If position is closed, reset cost
    if (pos.long === 0 && pos.short === 0) pos.cost = 0;

    renderPositions();

    // Auto-Broadcast Position Update
    const finalNet = pos.long - pos.short;
    const positionContext = {
        type: 'fdc3.position',
        instrument: { type: 'fdc3.instrument', id: { ticker: symbol } },
        holding: finalNet
    };
    broadcastContext(positionContext);
}

function renderPositions() {
    const tbody = document.getElementById('positions-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    let data = Object.keys(positions).map(sym => {
        const p = positions[sym];
        const marketPx = prices[sym] || 0;
        const netQty = p.long - p.short;
        return {
            sym: sym,
            qty: netQty,
            cost: p.cost,
            pl: (marketPx - p.cost) * netQty
        };
    }).filter(p => p.qty !== 0);

    const cfg = sortConfig.positions;
    if (cfg.key) {
        data.sort((a, b) => {
            let vA = a[cfg.key];
            let vB = b[cfg.key];
            if (vA < vB) return cfg.dir === 'asc' ? -1 : 1;
            if (vA > vB) return cfg.dir === 'asc' ? 1 : -1;
            return 0;
        });
    }

    data.forEach(p => {
        const tr = document.createElement('tr');
        if (selectedPositionSym === p.sym) tr.classList.add('selected');
        tr.onclick = () => selectPosition(p.sym);

        const decimals = tickerDecimals(p.sym);
        const flattenBtn = p.qty !== 0 ? `<button class="btn-flatten" onclick="event.stopPropagation(); flattenPosition('${p.sym}')">FLATTEN</button>` : '';

        // Risk Metrics (Mocked)
        const risk = getRiskMetrics(p.sym);

        tr.innerHTML = `
            <td>${p.sym}</td>
            <td class="${p.qty >= 0 ? 'pos' : 'neg'}">${p.qty.toLocaleString()} ${flattenBtn}</td>
            <td>${p.cost.toFixed(decimals)}</td>
            <td>${risk.beta.toFixed(2)}</td>
            <td>$${(Math.abs(p.qty) * p.cost * risk.varP).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
            <td class="${p.pl >= 0 ? 'pos' : 'neg'}">${p.pl >= 0 ? '+' : ''}$${Math.abs(p.pl).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
            <td>${p.settleDate || calculateSettlement(p.sym)}</td>
        `;
        tbody.appendChild(tr);
    });

    renderPortfolioSummary();
}

function getRiskMetrics(symbol) {
    // Deterministic mock risk values
    const seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return {
        beta: 0.5 + (seed % 100) / 50, // 0.5 to 2.5
        varP: 0.02 + (seed % 50) / 1000 // 2% to 7% daily VaR
    };
}

function renderPortfolioSummary() {
    const summaryTarget = document.getElementById('portfolio-summary-body');
    if (!summaryTarget) return;

    let totalValue = 0;
    let totalPL = 0;
    let weightedBetaSum = 0;
    let totalAbsExposure = 0;

    Object.keys(positions).forEach(sym => {
        const p = positions[sym];
        const currentPrice = prices[sym] || p.cost;
        const netQty = p.long - p.short;
        const marketValue = netQty * currentPrice;
        const pl = (currentPrice - p.cost) * netQty;

        totalValue += marketValue;
        totalPL += pl;

        const risk = getRiskMetrics(sym);
        weightedBetaSum += risk.beta * Math.abs(marketValue);
        totalAbsExposure += Math.abs(marketValue);
    });

    const portfolioBeta = totalAbsExposure > 0 ? weightedBetaSum / totalAbsExposure : 0;

    summaryTarget.innerHTML = `
        <div class="summary-item">
            <div class="label">NET LIQUIDATION</div>
            <div class="value">$${(1000000 + totalPL).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div class="summary-item">
            <div class="label">UNREALIZED P/L</div>
            <div class="value ${totalPL >= 0 ? 'pos' : 'neg'}">${totalPL >= 0 ? '+' : ''}$${Math.abs(totalPL).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div class="summary-item">
            <div class="label">PORTFOLIO BETA</div>
            <div class="value">${portfolioBeta.toFixed(2)}</div>
        </div>
    `;
}
// Initial Render


function submitQuickOrder(side) {
    const symbol = document.getElementById('qt-symbol').innerText;
    const price = parseFloat(document.getElementById(side === 'BUY' ? 'quote-ask' : 'quote-bid').innerText);
    const qtyInput = document.getElementById('ticket-qty');
    const qty = qtyInput ? parseInt(qtyInput.value) : 100;

    // Submit standard order immediately
    processOrder(symbol, side, qty, 'MARKET', price);
    showToast(`SUBMITTED: ${side} ${qty} ${symbol} @ MARKET`, 'info');
}

function populateTicketFromDepth(side, price, size) {
    const sym = document.getElementById('qt-symbol').innerText;

    // Populate Order Entry form
    const symInput = document.getElementById('ticket-symbol');
    const sideInput = document.getElementById('ticket-side');
    const qtyInput = document.getElementById('ticket-qty');
    const pxInput = document.getElementById('ticket-price');
    const typeInput = document.getElementById('ticket-type');

    if (symInput) symInput.value = sym;
    if (sideInput) sideInput.value = side;
    if (qtyInput) qtyInput.value = size;
    if (pxInput) pxInput.value = price;
    if (typeInput) typeInput.value = 'LIMIT';

    console.log(`Populated Ticket from Depth: ${side} ${size} ${sym} @ ${price}`);
}

function processOrder(symbol, side, qty, type, price) {
    const orderId = `ORD-${orderIdCounter++}`;
    const timestamp = new Date().toLocaleTimeString();

    // Create Order Object
    const order = {
        time: timestamp,
        id: orderId,
        side: side,
        symbol: symbol,
        qty: qty,
        price: price,
        type: type,
        status: 'NEW',
        avgPx: 0,
        status: 'NEW',
        avgPx: 0,
        cumQty: 0,
        settleDate: calculateSettlement(symbol)
    };
    orders.unshift(order);
    renderOrders();

    // Simulate Execution (Immediate for Demo)
    setTimeout(() => executeOrder(order), 500);

    // Initial Broadcast
    broadcastOrderUpdate(order);
}

function executeOrder(order) {
    // 1. Determine Fills
    let remaining = order.qty;
    const fills = [];

    if (order.qty > 100 && Math.random() > 0.3) {
        const fill1 = Math.floor(order.qty * (0.3 + Math.random() * 0.4));
        fills.push(fill1);
        fills.push(order.qty - fill1);
    } else {
        fills.push(order.qty);
    }

    // 2. Execute Fills
    fills.forEach((fillQty, index) => {
        setTimeout(() => {
            const finalPx = order.price + (Math.random() - 0.5) * 0.05;
            const execId = `EX-${execIdCounter++}`;
            const cpty = ['GS', 'MS', 'JPM', 'CITI', 'BOFA'][Math.floor(Math.random() * 5)];
            const time = new Date().toLocaleTimeString();

            // Create Trade
            const trade = {
                time, execId, orderId: order.id, side: order.side, symbol: order.symbol,
                qty: fillQty, price: finalPx, cpty,
                settleDate: calculateSettlement(order.symbol)
            };
            trades.unshift(trade);

            // Update Order
            order.cumQty += fillQty;
            const totalVal = (order.avgPx * (order.cumQty - fillQty)) + (finalPx * fillQty);
            order.avgPx = totalVal / order.cumQty;
            order.status = (order.cumQty >= order.qty) ? 'FILLED' : 'PARTIAL';
            order.time = time;

            updatePosition(order.symbol, order.side, fillQty, finalPx);
            renderOrders();
            renderTrades();
            broadcastOrderUpdate(order);

            const decimals = tickerDecimals(order.symbol);
            showToast(`FILL: ${order.side} ${fillQty} ${order.symbol} @ ${finalPx.toFixed(decimals)}`, 'success');
        }, 300 * (index + 1));
    });
}

function broadcastOrderUpdate(order) {
    const context = {
        type: 'fdc3.order',
        id: { orderId: order.id },
        instrument: {
            type: 'fdc3.instrument',
            id: { ticker: order.symbol }
        },
        side: order.side,
        quantity: order.qty,
        price: order.price,
        orderType: order.type,
        status: order.status,
        details: {
            avgPx: order.avgPx,
            cumQty: order.cumQty
        }
    };
    broadcastContext(context);
}

function renderOrders() {
    const tbody = document.getElementById('blotter-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const data = [...orders];
    const cfg = sortConfig.orders;
    if (cfg.key) {
        data.sort((a, b) => {
            let vA = a[cfg.key];
            let vB = b[cfg.key];
            if (vA < vB) return cfg.dir === 'asc' ? -1 : 1;
            if (vA > vB) return cfg.dir === 'asc' ? 1 : -1;
            return 0;
        });
    }

    data.forEach(o => {
        const tr = document.createElement('tr');
        if (selectedOrderId === o.id) tr.classList.add('selected');
        tr.onclick = () => selectOrder(o.id);

        const sideClass = o.side === 'BUY' ? 'side-buy' : 'side-sell';
        const decimals = tickerDecimals(o.symbol);
        tr.innerHTML = `
            <td>${o.time}</td>
            <td>${o.id}</td>
            <td class="${sideClass}">${o.side}</td>
            <td>${o.symbol}</td>
            <td>${o.qty.toLocaleString()}</td>
            <td>${o.price.toFixed(decimals)}</td>
            <td>${o.avgPx > 0 ? o.avgPx.toFixed(decimals) : '-'}</td>
            <td>${o.status}</td>
            <td>${o.settleDate || calculateSettlement(o.symbol)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTrades() {
    const tbody = document.getElementById('trade-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const data = [...trades];
    const cfg = sortConfig.trades;
    if (cfg.key) {
        data.sort((a, b) => {
            let vA = a[cfg.key];
            let vB = b[cfg.key];
            if (vA < vB) return cfg.dir === 'asc' ? -1 : 1;
            if (vA > vB) return cfg.dir === 'asc' ? 1 : -1;
            return 0;
        });
    }

    data.forEach(t => {
        const tr = document.createElement('tr');
        if (selectedTradeId === t.execId) tr.classList.add('selected');
        tr.onclick = () => selectTrade(t.execId);

        const sideClass = t.side === 'BUY' ? 'side-buy' : 'side-sell';
        const decimals = tickerDecimals(t.symbol);
        tr.innerHTML = `
            <td>${t.time}</td>
            <td>${t.execId}</td>
            <td>${t.orderId}</td>
            <td class="${sideClass}">${t.side}</td>
            <td>${t.symbol}</td>
            <td>${t.qty.toLocaleString()}</td>
            <td>${t.price.toFixed(decimals)}</td>
            <td>${t.cpty}</td>
            <td>${t.settleDate || calculateSettlement(t.symbol)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Selection Handlers ---

let selectedOrderId = null;
let selectedTradeId = null;
let selectedPositionSym = null;

function selectOrder(id) {
    selectedOrderId = id;
    renderOrders();

    const order = orders.find(o => o.id === id);
    if (order) {
        broadcastOrderUpdate(order);
        console.log("Selected Order:", order);
    }
}

function selectTrade(execId) {
    selectedTradeId = execId;
    renderTrades();

    const trade = trades.find(t => t.execId === execId);
    if (trade) {
        const context = {
            type: 'fdc3.trade',
            id: { execId: trade.execId },
            instrument: {
                type: 'fdc3.instrument',
                id: { ticker: trade.symbol }
            },
            side: trade.side,
            quantity: trade.qty,
            price: trade.price,
            orderId: trade.orderId,
            counterparty: trade.cpty,
            time: trade.time
        };
        broadcastContext(context);
        console.log("Selected Trade:", trade);
    }
}


function selectPosition(symbol) {
    selectedPositionSym = symbol;
    renderPositions();

    const p = positions[symbol];
    if (p) {
        const finalNet = p.long - p.short;
        const positionContext = {
            type: 'fdc3.position',
            instrument: {
                type: 'fdc3.instrument',
                id: { ticker: symbol }
            },
            holding: finalNet
        };
        broadcastContext(positionContext);
        console.log("Selected Position:", symbol, positionContext);
    }
}

function tickerDecimals(ticker) {
    return ticker.includes('/') ? 4 : (ticker.startsWith('US') ? 3 : 2);
}

// --- Settlement Logic ---
const holidays = {
    'USD': ['2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25', '2026-07-04', '2026-09-07', '2026-11-26', '2026-12-25'],
    'EUR': ['2026-01-01', '2026-04-10', '2026-04-13', '2026-05-01', '2026-12-25', '2026-12-26'],
    'GBP': ['2026-01-01', '2026-04-10', '2026-04-13', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-26'],
    'JPY': ['2026-01-01', '2026-01-12', '2026-02-11', '2026-02-23', '2026-03-20', '2026-04-29', '2026-05-03', '2026-05-04', '2026-05-05', '2026-07-20', '2026-08-11', '2026-09-21', '2026-09-22', '2026-10-12', '2026-11-03', '2026-11-23', '2026-12-23']
};

function calculateSettlement(symbol, tradeDate = new Date()) {
    // T+2 for everything (simplified), Spot FX T+2
    let daysToAdd = 2;
    let currentDate = new Date(tradeDate);

    // Currencies involved
    let ccys = ['USD']; // Default assumption
    if (symbol.includes('/')) {
        ccys = symbol.split('/');
    } else if (symbol.startsWith('US')) {
        ccys = ['USD'];
    }

    let added = 0;
    while (added < daysToAdd) {
        currentDate.setDate(currentDate.getDate() + 1);

        const day = currentDate.getDay();
        const isoDate = currentDate.toISOString().split('T')[0];

        // Skip Weekends
        if (day === 0 || day === 6) continue;

        // Skip Holidays (if ANY currency is on holiday)
        let isHoliday = false;
        for (const c of ccys) {
            if (holidays[c] && holidays[c].includes(isoDate)) {
                isHoliday = true;
                break;
            }
        }

        if (!isHoliday) {
            added++;
        }
    }

    return currentDate.toISOString().split('T')[0];
}

// --- News Filtering ---

function toggleNewsFilter(checkbox) {
    newsFilterEnabled = checkbox.checked;
    renderNews();

    const status = newsFilterEnabled ? (currentContextSymbol || 'None') : 'ALL';
    showToast(`News Filter: ${status}`, 'info');
}

function renderNews() {
    const list = document.getElementById('news-list');
    if (!list) return;
    list.innerHTML = '';

    // Filter Logic
    let displayNews = news;
    if (newsFilterEnabled && currentContextSymbol) {
        displayNews = news.filter(item => {
            if (!item.related) return false;
            // Exact match or active symbol is in related list
            return item.related.includes(currentContextSymbol);
        });

        if (displayNews.length === 0) {
            list.innerHTML = `<li style="padding:10px; color:#666; font-style:italic;">No news for ${currentContextSymbol}</li>`;
            return;
        }
    }

    displayNews.forEach(item => {
        const li = document.createElement('li');
        // Add related tags to specific items if they exist?
        // Or specific highlighting? For now, standard list.
        li.innerHTML = `
            <span class="time">${item.time}</span>
            <span class="headline">${item.headline}</span>
        `;
        list.appendChild(li);
    });
}

function drawChart(ticker) {
    const canvas = document.getElementById('price-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background Grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < width; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = 0; y < height; y += 30) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();

    // Simulate Price Data
    ctx.beginPath();
    ctx.strokeStyle = '#00ff88'; // Green
    ctx.lineWidth = 2;

    let price = height / 2;
    ctx.moveTo(0, price);

    for (let x = 0; x < width; x += 5) {
        const change = (Math.random() - 0.5) * 10;
        price += change;
        // Clamp
        if (price < 10) price = 10;
        if (price > height - 10) price = height - 10;

        ctx.lineTo(x, price);
    }
    ctx.stroke();

    // Fill Area
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
    ctx.fill();
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> ${message}`;
    container.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
        toast.style.animation = 'toast-out 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function flattenPosition(symbol) {
    const p = positions[symbol];
    if (!p) return;

    const netQty = p.long - p.short;
    if (netQty === 0) return;

    const side = netQty > 0 ? 'SELL' : 'BUY';
    const qty = Math.abs(netQty);
    const price = prices[symbol];

    showToast(`FLATTENING ${symbol}: Submitting ${side} ${qty}...`, 'warning');
    processOrder(symbol, side, qty, 'MARKET', price);
}

// --- Theme & Layout Handlers ---

function toggleTheme() {
    const body = document.body;
    body.classList.toggle('light-mode');
    const isLight = body.classList.contains('light-mode');
    localStorage.setItem('oms_theme', isLight ? 'light' : 'dark');
}

function initTheme() {
    const saved = localStorage.getItem('oms_theme');
    if (saved === 'light') {
        document.body.classList.add('light-mode');
    }
}

function toggleLayout() {
    const leftPanel = document.querySelector('.left-panel');
    if (!leftPanel) return;

    if (leftPanel.style.display === 'none') {
        leftPanel.style.display = 'flex';
    } else {
        leftPanel.style.display = 'none';
    }
}

function submitOrder() {
    // 1. Gather Data
    const symbol = document.getElementById('ticket-symbol').value.toUpperCase();
    const side = document.getElementById('ticket-side').value;
    const qty = parseInt(document.getElementById('ticket-qty').value, 10);
    const type = document.getElementById('ticket-type').value;
    const price = parseFloat(document.getElementById('ticket-price').value);

    if (!symbol || !qty || !price) {
        alert("Please fill all fields.");
        return;
    }

    processOrder(symbol, side, qty, type, price);
    showToast(`SUBMITTED: ${side} ${qty} ${symbol} @ ${type}`, 'info');
}

function clearTicket() {
    document.getElementById('ticket-symbol').value = '';
    document.getElementById('ticket-qty').value = '100';
    document.getElementById('ticket-price').value = '';
}



function contactSales(name) {
    const contact = {
        type: 'fdc3.contact',
        name: name,
        id: {
            email: `${name.toLowerCase().replace(' ', '.')}@interop.trader`,
            salesforceId: `SF-${Math.floor(Math.random() * 10000)}`
        }
    };
    broadcastContext(contact);
    console.log(`Contact Broadcast: ${name}`, contact);

    // Also simulate Intent for Chat
    if (window.fdc3 && window.fdc3.raiseIntent) {
        // We just log it here as mocking intent resolution is complex without a listener
        console.log("Mocking 'StartChat' intent raise...");
    }
}

// --- Market Simulation ---


function simulateMarket() {
    Object.keys(prices).forEach(ticker => {
        // Random walk
        const volatility = (ticker === 'EUR/USD') ? 0.0002 : 0.50;
        const change = (Math.random() - 0.5) * volatility;
        prices[ticker] += change;

        // Update Watchlist UI
        const row = document.getElementById(`wl-${ticker}`);
        if (row) {
            const priceSpan = row.querySelector('.price');
            const changeSpan = row.querySelector('.change');
            if (priceSpan) priceSpan.innerText = prices[ticker].toFixed(ticker.includes('/') ? 4 : 2);

            // Visual Flash
            if (change > 0) row.classList.add('flash-up');
            else row.classList.add('flash-down');
            setTimeout(() => row.classList.remove('flash-up', 'flash-down'), 500);
        }

        // Update Quick Tile if active
        const quoteSymbol = document.getElementById('qt-symbol');
        if (quoteSymbol && quoteSymbol.innerText === ticker) {
            updateQuote(ticker);
        }

        // Update Positions P/L
        if (positions[ticker]) {
            renderPositions();
        }
    });

    // Refresh summary if not handled by renderPositions
    renderPortfolioSummary();

    // Re-draw chart if active
    const activeSymbol = document.getElementById('chart-symbol').innerText;
    drawChart(activeSymbol);
}

// Start Pulse
setInterval(simulateMarket, 1500);

// --- Built-in AI Assistant ---
let aiLogs = [];
let unreadAiEvents = 0;
let aiConfig = {
    provider: 'local',
    url: 'https://myllm.kumatech.net/v1',
    key: '',
    model: 'google_gemma-3-27b-it-qat-q4_0-',
    temp: 0.7,
    prompt: "You are a trade assistant and analyst Analyze the FDC3 logs for to help answers my questions about orders and trades and position and what i have been doing on the platform based on the context derived from the fd3 json data.",
    start: '',
    end: ''
};

function loadAiConfig() {
    const saved = localStorage.getItem('ai_analyst_config');
    if (saved) {
        aiConfig = { ...aiConfig, ...JSON.parse(saved) };
    }
    // Update UI fields
    document.getElementById('cfg-provider').value = aiConfig.provider;
    document.getElementById('cfg-url').value = aiConfig.url;
    document.getElementById('cfg-key').value = aiConfig.key;
    document.getElementById('cfg-model').value = aiConfig.model;
    document.getElementById('cfg-temp').value = aiConfig.temp;
    document.getElementById('val-temp').innerText = aiConfig.temp;
    document.getElementById('cfg-prompt').value = aiConfig.prompt;
    document.getElementById('cfg-start').value = aiConfig.start || '';
    document.getElementById('cfg-end').value = aiConfig.end || '';
    updateProviderFields();
}

function updateProviderFields() {
    const provider = document.getElementById('cfg-provider').value;
    const groupUrl = document.getElementById('group-url');
    const groupKey = document.getElementById('group-key');

    // Clear datalist when provider changes
    const list = document.getElementById('model-list');
    if (list) list.innerHTML = '';

    if (provider === 'gemini') {
        groupUrl.style.display = 'none';
        groupKey.style.display = 'flex';
    } else if (provider === 'openai') {
        groupUrl.style.display = 'none';
        groupKey.style.display = 'flex';
    } else {
        groupUrl.style.display = 'flex';
        groupKey.style.display = 'flex';
    }
}

async function fetchModels() {
    const btn = document.getElementById('btn-fetch-models');
    const list = document.getElementById('model-list');
    const tempConfig = {
        provider: document.getElementById('cfg-provider').value,
        url: document.getElementById('cfg-url').value,
        key: document.getElementById('cfg-key').value
    };

    btn.innerText = "⏳";
    btn.disabled = true;

    try {
        const resp = await fetch('/models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: tempConfig })
        });
        const data = await resp.json();

        if (data.models) {
            list.innerHTML = data.models.map(m => `<option value="${m}">`).join('');
            renderAiEntry(`Fetched ${data.models.length} models from ${tempConfig.provider}.`, true);
        } else {
            alert(data.error || "Failed to fetch models");
        }
    } catch (err) {
        console.error("Fetch models error:", err);
        alert("Network error fetching models.");
    } finally {
        btn.innerText = "FETCH";
        btn.disabled = false;
    }
}

async function testConnection() {
    const btn = document.getElementById('btn-test-conn');
    const tempConfig = {
        provider: document.getElementById('cfg-provider').value,
        url: document.getElementById('cfg-url').value,
        key: document.getElementById('cfg-key').value
    };

    btn.innerText = "TESTING...";
    btn.disabled = true;

    try {
        const resp = await fetch('/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: tempConfig })
        });
        const data = await resp.json();
        alert(data.message);
    } catch (err) {
        alert("Connection test failed.");
    } finally {
        btn.innerText = "TEST CONNECTION";
        btn.disabled = false;
    }
}

function toggleAiSettings() {
    const view = document.getElementById('ai-settings-view');
    const chat = document.getElementById('ai-chat-view');
    if (view.style.display === 'none') {
        view.style.display = 'flex';
        chat.style.display = 'none';
    } else {
        view.style.display = 'none';
        chat.style.display = 'flex';
    }
}

function saveAiSettings() {
    aiConfig.provider = document.getElementById('cfg-provider').value;
    aiConfig.url = document.getElementById('cfg-url').value;
    aiConfig.key = document.getElementById('cfg-key').value;
    aiConfig.model = document.getElementById('cfg-model').value;
    aiConfig.temp = parseFloat(document.getElementById('cfg-temp').value);
    aiConfig.prompt = document.getElementById('cfg-prompt').value;

    // Dates are globally available now
    saveDateFilters();

    localStorage.setItem('ai_analyst_config', JSON.stringify(aiConfig));
    toggleAiSettings();
    renderAiEntry("Settings saved and updated.", true);
}

function saveDateFilters() {
    aiConfig.start = document.getElementById('cfg-start').value;
    aiConfig.end = document.getElementById('cfg-end').value;
    localStorage.setItem('ai_analyst_config', JSON.stringify(aiConfig));
}

function toggleAiPanel() {
    const panel = document.getElementById('ai-panel');
    const badge = document.getElementById('ai-badge');
    if (!panel) return;

    panel.classList.toggle('visible');

    // Clear badge when opened
    if (panel.classList.contains('visible')) {
        unreadAiEvents = 0;
        if (badge) badge.style.display = 'none';
    }
}

function snoopFdc3(type, data) {
    const entry = {
        origin: 'FDC3',
        type: type,
        data: data,
        timestamp: Date.now()
    };
    aiLogs.push(entry);
    renderAiEntry(entry);

    // Update badge if panel is closed
    const panel = document.getElementById('ai-panel');
    if (panel && !panel.classList.contains('visible')) {
        unreadAiEvents++;
        const badge = document.getElementById('ai-badge');
        if (badge) {
            badge.innerText = unreadAiEvents;
            badge.style.display = 'flex';
        }
    }

    // Update Smart Suggestions
    if (window.mockSuggestionTimeout) clearTimeout(window.mockSuggestionTimeout);
    window.mockSuggestionTimeout = setTimeout(updateMockAiContextualSuggestions, 500);
}

function updateMockAiContextualSuggestions() {
    // Container is the AI Chat Log
    const container = document.getElementById('ai-log');
    if (!container) return;

    // Only show if we have logs
    if (aiLogs.length === 0) return;

    // Remove existing suggestion chips if any (to refresh)
    const existing = document.getElementById('mock-context-chips');
    if (existing) existing.remove();

    // Analyze logs for context (Same logic as Extension)
    const hasOrders = aiLogs.some(l => l.data && (l.data.type === 'fdc3.order' || JSON.stringify(l.data).includes('order')));
    const hasInstruments = aiLogs.some(l => l.data && (l.data.type === 'fdc3.instrument' || l.data.id?.ticker));
    const hasContext = aiLogs.length > 5;

    let suggestions = [];
    if (hasOrders) suggestions.push("Analyze my order execution");
    if (hasInstruments) suggestions.push("Summarize instrument activity");
    if (hasContext) suggestions.push("Check for compliance violations");
    suggestions.push("What happened in the last 5 minutes?");

    // Create Chips Container
    const chipDiv = document.createElement('div');
    chipDiv.id = 'mock-context-chips';
    chipDiv.style.padding = "10px";
    chipDiv.style.display = "flex";
    chipDiv.style.gap = "8px";
    chipDiv.style.flexWrap = "wrap";
    chipDiv.style.borderBottom = "1px solid #333";
    chipDiv.style.background = "rgba(56, 189, 248, 0.05)";
    chipDiv.style.order = "-1"; // Ensure it stays at top if using flex column, but log is just a div. 
    // Actually, we want this pinned. 
    // The log container scrolls, so if we prepend it, it might scroll off.
    // Better strategy: Insert it BEFORE the log container in the DOM?
    // The structure is #ai-chat-view > #ai-log.
    // Let's insert it inside #ai-chat-view, before #ai-log.

    const chatView = document.getElementById('ai-chat-view');
    if (chatView) {
        // Remove from chat view if exists
        const oldChips = document.getElementById('mock-context-chips-view');
        if (oldChips) oldChips.remove();

        chipDiv.id = 'mock-context-chips-view';
        chipDiv.style.flexShrink = "0"; // Don't shrink

        chatView.insertBefore(chipDiv, container);
        return;
    }

    // Fallback: Prepend to log (will scroll)
    container.prepend(chipDiv);
}

// Update Render Entry to NOT overwrite chips if used as fallback
// Actually, renderAiEntry appends relative to bottom...
// Our insertBefore logic above is safer.

function renderMockSuggestionChip(text, parent) {
    const btn = document.createElement('button');
    btn.innerText = text;
    btn.className = 'ai-suggestion-chip'; // We can styling inline or add to CSS
    btn.style.fontSize = "10px";
    btn.style.padding = "4px 8px";
    btn.style.background = "#1f2937";
    btn.style.border = "1px solid #38bdf8";
    btn.style.color = "#38bdf8";
    btn.style.cursor = "pointer";
    btn.style.borderRadius = "12px";

    btn.onmouseover = () => { btn.style.background = "#38bdf8"; btn.style.color = "#000"; };
    btn.onmouseout = () => { btn.style.background = "#1f2937"; btn.style.color = "#38bdf8"; };

    btn.onclick = () => {
        const input = document.getElementById('ai-query');
        input.value = text;
        askAi();
    };
    parent.appendChild(btn);
}

// We need to actually fill the chipDiv in the function above
// Rewriting the loop to use the helper
// (Self-correction: I can't redefine functions easily in a replace block if I want to use them immediately)
// So I'll inline the button creation in the main function.

function updateMockAiContextualSuggestions() {
    const chatView = document.getElementById('ai-chat-view');
    const logContainer = document.getElementById('ai-log');
    if (!chatView || !logContainer) return;

    if (aiLogs.length === 0) return;

    const existing = document.getElementById('mock-context-chips-view');
    if (existing) existing.remove();

    const hasOrders = aiLogs.some(l => l.data && (l.data.type === 'fdc3.order' || JSON.stringify(l.data).includes('order')));
    const hasInstruments = aiLogs.some(l => l.data && (l.data.type === 'fdc3.instrument' || l.data.id?.ticker));

    let suggestions = [];
    if (hasOrders) suggestions.push("Analyze my order execution");
    if (hasInstruments) suggestions.push("Summarize instrument activity");
    suggestions.push("Check for compliance violations");
    suggestions.push("What happened recently?");

    const chipDiv = document.createElement('div');
    chipDiv.id = 'mock-context-chips-view';
    chipDiv.style.padding = "8px";
    chipDiv.style.display = "flex";
    chipDiv.style.gap = "6px";
    chipDiv.style.flexWrap = "wrap";
    chipDiv.style.background = "#161b22";
    chipDiv.style.borderBottom = "1px solid #333";
    chipDiv.style.flexShrink = "0";

    suggestions.forEach(text => {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.style.fontSize = "11px";
        btn.style.padding = "4px 8px";
        btn.style.background = "#1f2937";
        btn.style.border = "1px solid #38bdf8";
        btn.style.color = "#38bdf8";
        btn.style.cursor = "pointer";
        btn.style.borderRadius = "12px";

        btn.onmouseover = () => { btn.style.background = "#38bdf8"; btn.style.color = "#000"; };
        btn.onmouseout = () => { btn.style.background = "#1f2937"; btn.style.color = "#38bdf8"; };

        btn.onclick = () => {
            const input = document.getElementById('ai-query');
            if (input) {
                input.value = text;
                askAi();
            }
        };
        chipDiv.appendChild(btn);
    });

    chatView.insertBefore(chipDiv, logContainer);
}

function renderAiEntry(entry, isBot = false, isUser = false) {
    const log = document.getElementById('ai-log');
    if (!log) return;

    // Remove placeholder
    const placeholder = log.querySelector('.ai-placeholder');
    if (placeholder) placeholder.remove();

    const div = document.createElement('div');
    div.className = `ai-entry ${isBot ? 'bot' : (isUser ? 'user' : 'event')}`;

    if (isBot) {
        div.innerHTML = `<span class="origin">AI ANALYST</span>${entry}`;
    } else if (isUser) {
        div.innerHTML = `${entry}`;
    } else {
        const details = entry.type === 'fdc3.instrument' ? entry.data.name :
            entry.type === 'fdc3.order' ? `${entry.data.side} ${entry.data.instrument.id.ticker}` :
                entry.type;
        const msgId = `json-${entry.timestamp}`;
        div.innerHTML = `
            <span class="origin">${entry.origin}: ${entry.type}</span>
            <div>${details}</div>
            <span class="expand-toggle" onclick="toggleJson('${msgId}')">▼ Click to expand JSON</span>
            <div id="${msgId}" class="json-block">${JSON.stringify(entry.data, null, 2)}</div>
        `;
    }

    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

function clearAiLogs() {
    if (confirm("Clear all captured FDC3 events and chat history?")) {
        aiLogs = [];
        const log = document.getElementById('ai-log');
        if (log) {
            log.innerHTML = '<div class="ai-placeholder">Captured FDC3 events will appear here. Ask me anything!</div>';
        }
    }
}

function handleAiKey(e) {
    if (e.key === 'Enter') askAi();
}

function toggleJson(id) {
    const block = document.getElementById(id);
    if (!block) return;
    block.style.display = block.style.display === 'block' ? 'none' : 'block';
}

async function askAi() {
    const input = document.getElementById('ai-query');
    const query = input.value.trim();
    if (!query) return;

    // 1. Show User Message
    renderAiEntry(query, false, true);
    input.value = '';

    // 2. Filter Logs by Date if set
    let filteredLogs = [...aiLogs];
    if (aiConfig.start) {
        const startTs = new Date(aiConfig.start).getTime();
        filteredLogs = filteredLogs.filter(l => l.timestamp >= startTs);
    }
    if (aiConfig.end) {
        const endTs = new Date(aiConfig.end).getTime();
        filteredLogs = filteredLogs.filter(l => l.timestamp <= endTs);
    }

    // 3. Call Backend
    const btn = document.getElementById('ai-send-btn');
    btn.innerText = "⏳";
    btn.disabled = true;

    // Create a container for the bot response to stream into
    const log = document.getElementById('ai-log');
    const responseDiv = document.createElement('div');
    responseDiv.className = 'ai-entry bot';
    responseDiv.innerHTML = '<span class="origin">AI ANALYST</span><span class="stream-text">...</span>';
    log.appendChild(responseDiv);
    const textTarget = responseDiv.querySelector('.stream-text');

    try {
        const resp = await fetch('/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                logs: filteredLogs,
                query: query,
                config: aiConfig,
                stream: true
            })
        });

        if (!resp.ok) {
            const errorData = await resp.json().catch(() => ({}));
            throw new Error(errorData.analysis || errorData.message || `HTTP Error ${resp.status}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        textTarget.innerText = ""; // Clear the loading dots
        let buffer = ""; // Buffer for partial chunks

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Split by double newline (SSE separator)
            let parts = buffer.split('\n\n');
            buffer = parts.pop(); // Keep partial last chunk

            for (const part of parts) {
                const lines = part.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const raw = line.substring(6).trim();
                            if (!raw) continue;
                            const data = JSON.parse(raw);
                            if (data.error) {
                                textTarget.innerHTML += `<div style="color:var(--color-danger)">Error: ${data.error}</div>`;
                            } else if (data.text) {
                                fullText += data.text;
                                // Basic markdown-ish conversion or just text
                                textTarget.innerText = fullText;
                                log.scrollTop = log.scrollHeight;
                            }
                        } catch (e) {
                            console.warn("Error parsing stream chunk", e, line);
                        }
                    }
                }
            }
        }

        // Post-Stream Processing: Extract Suggestions
        if (fullText.includes('Suggested Actions:')) {
            const parts = fullText.split('Suggested Actions:');
            const analysis = parts[0];
            const suggestionsBlock = parts[1];

            // 1. Clean up the UI to remove the raw suggestion text
            textTarget.innerText = analysis.trim();

            // 2. Parse suggestions
            const suggestions = suggestionsBlock
                .split('\n')
                .map(s => s.replace(/^[-*•]\s*/, '').trim())
                .filter(s => s.length > 0);

            // 3. Render buttons below the message
            if (suggestions.length > 0) {
                const actionsDiv = document.createElement('div');
                actionsDiv.style.marginTop = "8px";
                actionsDiv.style.borderTop = "1px solid #333";
                actionsDiv.style.paddingTop = "8px";
                actionsDiv.style.display = "flex";
                actionsDiv.style.flexDirection = "column";
                actionsDiv.style.gap = "4px";

                suggestions.forEach(s => {
                    const btn = document.createElement('button');
                    btn.innerText = s;
                    btn.style.textAlign = "left";
                    btn.style.fontSize = "11px";
                    btn.style.padding = "6px 10px";
                    btn.style.background = "#0d1117";
                    btn.style.border = "1px solid #30363d";
                    btn.style.color = "#58a6ff";
                    btn.style.borderRadius = "6px";
                    btn.style.cursor = "pointer";

                    btn.onmouseover = () => { btn.style.background = "#1f6feb"; btn.style.color = "white"; };
                    btn.onmouseout = () => { btn.style.background = "#0d1117"; btn.style.color = "#58a6ff"; };

                    btn.onclick = () => {
                        const input = document.getElementById('ai-query');
                        input.value = s;
                        askAi();
                    };
                    actionsDiv.appendChild(btn);
                });
                responseDiv.appendChild(actionsDiv);
                log.scrollTop = log.scrollHeight; // Scroll to see buttons
            }
        }

    } catch (err) {
        console.error("AI Error:", err);
        textTarget.innerHTML = `<span style="color:var(--color-danger)">Error connecting to AI service: ${err.message}</span>`;
    } finally {
        btn.innerText = "SEND";
    }
}
// OLD FDC3 Listener Registration (Preserved below)
function initFdc3Listeners() {
    if (!window.fdc3) return;

    // Listen for Instruments
    window.fdc3.addContextListener('fdc3.instrument', (context) => {
        const ticker = context.id?.ticker;
        if (ticker) {
            console.log("FDC3 Observer: Detected Instrument change:", ticker);
            syncInstrumentUI(ticker);
        }
    });

    // Listen for Orders
    window.fdc3.addContextListener('fdc3.order', (context) => {
        const ticker = context.instrument?.id?.ticker || context.details?.symbol;
        if (ticker) {
            console.log("FDC3 Observer: Detected Order focus:", ticker);
            syncInstrumentUI(ticker);
        }
    });

    // Listen for Trades
    window.fdc3.addContextListener('fdc3.trade', (context) => {
        const ticker = context.instrument?.id?.ticker || context.details?.symbol;
        if (ticker) {
            console.log("FDC3 Observer: Detected Trade focus:", ticker);
            syncInstrumentUI(ticker);
        }
    });

    // Listen for Positions
    window.fdc3.addContextListener('fdc3.position', (context) => {
        const ticker = context.instrument?.id?.ticker;
        if (ticker) {
            console.log("FDC3 Observer: Detected Position focus:", ticker);
            syncInstrumentUI(ticker);
        }
    });
}

function syncInstrumentUI(ticker) {
    // We use a specialized sync to avoid broadcast loops

    // 0. Update Filter Context
    currentContextSymbol = ticker;
    if (newsFilterEnabled) renderNews();

    // 1. Update Ticket Form
    // 1. Update Ticket Form
    const ticketSym = document.getElementById('ticket-symbol');
    if (ticketSym && ticketSym.value !== ticker) ticketSym.value = ticker;

    // 2. Update Headers
    const chartHeader = document.getElementById('chart-symbol');
    if (chartHeader) chartHeader.innerText = ticker;
    const quoteHeader = document.getElementById('qt-symbol');
    if (quoteHeader) quoteHeader.innerText = ticker;

    // 3. Update Visuals
    drawChart(ticker);
    drawChart(ticker);
    updateQuote(ticker);
}

function checkMobileLayout() {
    if (window.innerWidth <= 768) {
        // Auto-collapse panels to save space
        const panelsToCollapse = ['.news', '.positions'];
        panelsToCollapse.forEach(selector => {
            const panel = document.querySelector(`.panel${selector}`);
            if (panel && !panel.classList.contains('collapsed')) {
                // Simulate toggle click to ensure state consistency
                const toggle = panel.querySelector('.panel-toggle');
                if (toggle) togglePanel(toggle);
            }
        });
    }
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    initFdc3Listeners();
    initTheme();
    checkMobileLayout();
    loadAiConfig();
    renderWatchlist();
    renderPositions();
    renderOrders();
    renderTrades();
    renderNews();

    // Show default sort indicators
    updateSortIndicators('orders', 'time', 'desc');
    updateSortIndicators('trades', 'time', 'desc');

    // Auto-Broadcast Snapshot on Load (Wait for FDC3 ready)
    setTimeout(() => {
        broadcastSnapshot();
    }, 2000);
});

console.log("OMS App Logic Loaded.");
