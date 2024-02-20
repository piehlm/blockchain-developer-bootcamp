const { expect } = require('chai');
const { ethers } = require('hardhat');

const tokens = (n) => {
	return ethers.utils.parseUnits(n.toString(), 'ether')
}

describe('Token', ()=>{
	let token

	beforeEach(async () => {
		//Fetch Token from Blockchain
		const Token = await ethers.getContractFactory('Token')
		token = await Token.deploy('Piehl Token', 'MDP', '1000000')		
	})

	describe('Deployment', () => {
		const name = 'Piehl Token'
		const symbol = 'MDP'
		const decimals = '18'
		const totalSupply = tokens('1000000')

		it('Has the correct name', async () => {
			expect(await token.name()).to.equal(name)
		})

		it('Has the correct symbol', async () => {
			expect(await token.symbol()).to.equal(symbol)
		})

		it('Has the correct decimals', async () => {
			expect(await token.decimals()).to.equal(decimals)
		})

		it('Has the correct total supply', async () => {
			expect(await token.totalSupply()).to.equal(totalSupply)
		})
	})

})
