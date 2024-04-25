const config = require('../src/config.json')

const tokens = (n) => {
	return ethers.utils.parseUnits(n.toString(), 'ether')
}

const wait = (seconds) => {
	const milliseconds = seconds * 1000
	return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function main() {
	const { chainId } = await ethers.provider.getNetwork()
	console.log("Using chainId:", chainId)

	const accounts = await ethers.getSigners()

	const Dapp = await ethers.getContractAt('Token', config[chainId].Dapp.address)
	console.log(`Dapp Token fetched: ${Dapp.address}\n`)
	const mETH = await ethers.getContractAt('Token', config[chainId].mETH.address)
	console.log(`mETH Token fetched: ${mETH.address}\n`)
	const mDAI = await ethers.getContractAt('Token', config[chainId].mDAI.address)
	console.log(`mDAI Token fetched: ${mDAI.address}\n`)
	const exchange = await ethers.getContractAt('Exchange', config[chainId].exchange.address)
	console.log(`Exchange fetched: ${exchange.address}\n`)

	// tokens to account[1]
	const sender = accounts[0]
	const receiver = accounts[1]
	const receiver2 = accounts[2]
	let amount = tokens(10000)

	// user1 transfers 10,000 mETH
	let transaction, result
	transaction = await mETH.connect(sender).transfer(receiver.address, amount)
	result = await transaction.wait()
	console.log(`Transferred: ${amount} tokens from ${sender.address} to ${receiver.address}\n`)

	// setup exchange users
	const user1 = accounts[0]
	const user2 = accounts[1]

	//user 1 approves 10,000 Dapp...
	transaction = await Dapp.connect(user1).approve(exchange.address, amount)
	result = await transaction.wait()
	console.log(`Approved: ${amount} DAPP from ${user1.address}\n`)
	//user 1 deposits 10,000 Dapp...
	transaction = await exchange.connect(user1).depositToken(Dapp.address, amount)
	result = await transaction.wait()
	console.log(`Deposited: ${amount} DAPP from ${user1.address}\n`)

	//user 2 approves 10,000 mETH...
	transaction = await mETH.connect(user2).approve(exchange.address, amount)
	result = await transaction.wait()
	console.log(`Approved: ${amount} mETH from ${user2.address}\n`)
	//user 2 deposits 10,000 mETH...
	transaction = await exchange.connect(user2).depositToken(mETH.address, amount)
	result = await transaction.wait()
	console.log(`Deposited: ${amount} mETH from ${user2.address}\n`)

	// Seed a Cancelled Order
	let orderId
	transaction = await exchange.connect(user1).makeOrder(mETH.address, tokens(100), Dapp.address, tokens(5))
	result = await transaction.wait()
	orderId = result.events[0].args.id
	console.log(`Made order ${orderId} from from ${user1.address}\n`)
	transaction = await exchange.connect(user1).cancelOrder(orderId)
	result = await transaction.wait()
	console.log(`Cancel order ${orderId} from from ${user1.address}\n`)
	await wait(1)

	// seed a filled order
	transaction = await exchange.connect(user1).makeOrder(mETH.address, tokens(100), Dapp.address, tokens(10))
	result = await transaction.wait()
	orderId = result.events[0].args.id
	console.log(`Made order ${orderId} from from ${user1.address}\n`)
	transaction = await exchange.connect(user2).fillOrder(orderId)
	result = await transaction.wait()
	console.log(`Filled order ${orderId} from from ${user1.address}\n`)
	await wait(1)

	// Make another Order
	transaction = await exchange.connect(user1).makeOrder(mETH.address, tokens(50), Dapp.address, tokens(15))
	result = await transaction.wait()
	orderId = result.events[0].args.id
	console.log(`Made order ${orderId} from from ${user1.address}\n`)
	transaction = await exchange.connect(user2).fillOrder(orderId)
	result = await transaction.wait()
	console.log(`Filled order ${orderId} from from ${user1.address}\n`)
	await wait(1)

	// Make Final Order
	transaction = await exchange.connect(user1).makeOrder(mETH.address, tokens(200), Dapp.address, tokens(20))
	result = await transaction.wait()
	orderId = result.events[0].args.id
	console.log(`Made order ${orderId} from from ${user1.address}\n`)
	transaction = await exchange.connect(user2).fillOrder(orderId)
	result = await transaction.wait()
	console.log(`Filled order ${orderId} from from ${user1.address}\n`)
	await wait(1)

	// Seed Open Orders
	// User - make 10 orders
	for (let i = 1; i <= 10; i++) {
		transaction = await exchange.connect(user1).makeOrder(mETH.address, tokens(10 * i), Dapp.address, tokens(10))		
		result = await transaction.wait()
		orderId = result.events[0].args.id
		console.log(`Made order ${orderId} from from ${user1.address}\n`)
		await wait(1)

		transaction = await exchange.connect(user2).makeOrder(Dapp.address, tokens(10), mETH.address, tokens(10 * i))		
		result = await transaction.wait()
		orderId = result.events[0].args.id
		console.log(`Made order ${orderId} from from ${user2.address}\n`)
		await wait(1)
	}
	
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});