import { createSelector } from 'reselect'
import { get, groupBy, reject, maxBy, minBy } from 'lodash';
import { ethers } from 'ethers'
import moment from 'moment'

const tokens = state => get(state, 'tokens.contracts')
const allOrders = state => get(state, 'exchange.allOrders.data', [])
const cancelledOrders = state => get(state, 'exchange.cancelledOrders.data', [])
const filledOrders = state => get(state, 'exchange.filledOrders.data', [])
const openOrders = state => {
	const all = allOrders(state)
	const filled = filledOrders(state)
	const cancelled = cancelledOrders(state)

	const openOrders = reject(all, (order) => {
		const orderFilled = filled.some((o) => o.id.toString() === order.id.toString())
		const orderCancelled = cancelled.some((o) => o.id.toString() === order.id.toString())
		return(orderFilled || orderCancelled)
	})
	return openOrders
}
const GREEN = '#25CE8F'
const RED = '#F45353'

const decorateOrder = (order, tokens) => {
	let token0Amount, token1Amount

	//note: DApp should be considered token0, mETH is considered token1
	//example: giving mETH in exchange for DApp
	if (order.tokenGive === tokens[1].address) {
		token0Amount = order.amountGive // amount of DApp we are giving
		token1Amount = order.amountGet // amount of mETH we want
	} else {
		token0Amount = order.amountGet // amount of DApp we want
		token1Amount = order.amountGive // amount of mETH we are giving
	}

	const precision = 10000
	let tokenPrice = (token1Amount / token0Amount)
	tokenPrice = Math.round(tokenPrice * precision) / precision

	return ({
		...order,
		token0Amount: ethers.utils.formatUnits(token0Amount, "ether"),
		token1Amount: ethers.utils.formatUnits(token1Amount, "ether"),
		tokenPrice: tokenPrice,
		formattedTimestamp: moment.unix(order.timestamp).format('h:mm:ssa d MMM D')
	})	
}

// filled orders
export const filledOrdersSelector = createSelector(
	filledOrders,
	tokens,
	(orders, tokens) => {
	if (!tokens[0] || !tokens[1]) { return }

	// filter orders by selected tokens
	orders = orders.filter((o) => o.tokenGet === tokens[0].address || o.tokenGet === tokens[1].address)
	orders = orders.filter((o) => o.tokenGive === tokens[0].address || o.tokenGive === tokens[1].address)

	// sort orders by time ascending
	orders = orders.sort((a, b) => a.timestamp - b.timestamp)

	// decorate orders
	orders = decorateFilledOrders(orders, tokens)

	// sort orders by time descending for UI
	orders = orders.sort((a, b) => b.timestamp - a.timestamp)

	return orders	
	}
)

const decorateFilledOrders = (orders, tokens) => {
	let previousOrder = orders[0]

	return(
		orders.map((order) => {
			order = decorateOrder(order, tokens)
			order = decorateFilledOrder(order, previousOrder)
			previousOrder = order
			return order
		})
	)
}

const decorateFilledOrder = (order, previousOrder) => {
	return({
		...order,
		tokenPriceClass: tokenPriceClass(order.tokenPrice, order.id, previousOrder)
	})
}

const tokenPriceClass = (tokenPrice, orderId, previousOrder) => {
	if (previousOrder.id === orderId)  {
		return GREEN
	}

	if (previousOrder.tokenPrice <= tokenPrice) {
		return GREEN
	} else {
		return RED
	}
}

//Order Book
export const orderBookSelector = createSelector(
	openOrders, 
	tokens, 
	(orders, tokens) => {
	if (!tokens[0] || !tokens[1]) { return }

	// filter orders by selected tokens
	orders = orders.filter((o) => o.tokenGet === tokens[0].address || o.tokenGet === tokens[1].address)
	orders = orders.filter((o) => o.tokenGive === tokens[0].address || o.tokenGive === tokens[1].address)

	// decorate the orders
	orders = decorateOrderBookOrders(orders, tokens)
	// group orders by order type
	orders = groupBy(orders, 'orderType')
	//fetch buy orders
	const buyOrders = get(orders,'buy', [])
	// sort buy orders by token price
	orders = {
		...orders,
		buyOrders: buyOrders.sort((a, b) => b.tokenPrice - a.tokenPrice)
	}
	//fetch sell orders
	const sellOrders = get(orders,'sell', [])
	// sort buy orders by token price
	orders = {
		...orders,
		sellOrders: sellOrders.sort((a, b) => b.tokenPrice - a.tokenPrice)
	}
	return orders
})

const decorateOrderBookOrders = (orders, tokens) => {
	return(
		orders.map((order) => {
			order = decorateOrder(order,tokens)
			order = decorateOrderBookOrder(order, tokens)
			return(order)
		})
	)
}

const decorateOrderBookOrder = (order, tokens) => {
	const orderType = order.tokenGive === tokens[1].address ? 'buy' : 'sell'
	return({
		...order,
		orderType,
		orderTypeClass: (orderType === 'buy' ? GREEN : RED),
		orderFillAction: (orderType === 'buy' ? 'sell' : 'buy')
	})
}

//---------------------------------------
// Price Chart Selector
export const priceChartSelector = createSelector(
	filledOrders, 
	tokens, 
	(orders, tokens) => {
	if (!tokens[0] || !tokens[1]) { return }

	// filter orders by selected tokens
	orders = orders.filter((o) => o.tokenGet === tokens[0].address || o.tokenGet === tokens[1].address)
	orders = orders.filter((o) => o.tokenGive === tokens[0].address || o.tokenGive === tokens[1].address)

	// sort orders by date ascending to compare history
	orders = orders.sort((a, b) => a.timestamp - b.timestamp)

	// decorate orders - add display attributes
	orders = orders.map((o) => decorateOrder(o, tokens))

	let secondLastOrder, lastOrder
	[secondLastOrder, lastOrder] = orders.slice(orders.length - 2, orders.length)
	const lastPrice = get(lastOrder, 'tokenPrice', 0)
	const secondLastPrice  = get(secondLastOrder, 'tokenPrice', 0)
	return ({
		lastPrice: lastPrice,
		lastPriceChange: (lastPrice >= secondLastPrice ? '+' : '-'),
		series: [{
			data: buildGraphData(orders)
		}]
	})

})

const buildGraphData = (orders) => {
	//group orders by timeslice
	orders = groupBy(orders, (o) => moment.unix(o.timestamp).startOf('hour').format())
	// get each hour were data exists
	const hours = Object.keys(orders)
	// build the grapth data
	const graphData = hours.map((hour) => {
		// Fetch all orders from current hour
		const group = orders[hour]
		// calculate price values: open, high, low, close
		const open = group[0]
		const high = maxBy(group, 'tokenPrice')
		const low = minBy(group, 'tokenPrice')
		const close = group[group.length - 1]

		return({
			x: new Date(hour),
			y: [open.tokenPrice, high.tokenPrice, low.tokenPrice, close.tokenPrice]
		})
	})

	return graphData
}