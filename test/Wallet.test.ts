import { ethers } from "hardhat";
import { expect } from "chai";
import { advanceBlockTo, getBigNumber } from "./utilities"

// Verified commit test

describe("SimpleWallet", function () {
  before(async function () {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.carol = this.signers[2]
    this.dev = this.signers[3]
    this.minter = this.signers[4]

    this.UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory")
    this.UniswapV2Pair = await ethers.getContractFactory("UniswapV2Pair")
    this.UniswapV2Router02 = await ethers.getContractFactory("UniswapV2Router02")
    
    this.MasterChef = await ethers.getContractFactory("MasterChef")
    this.SushiToken = await ethers.getContractFactory("SushiToken")
    this.ERC20Mock = await ethers.getContractFactory("ERC20Mock", this.minter)
  })

  beforeEach(async function () {
    this.weth = await this.ERC20Mock.deploy("WETH", "ETH", getBigNumber("10000000"))
    await this.weth.deployed()

    this.dai = await this.ERC20Mock.deploy("DAI", "DAI", getBigNumber("10000000"))
    await this.dai.deployed()
    
    this.sushi = await this.SushiToken.deploy()
    await this.sushi.deployed()
    await this.sushi.mint(this.alice.address, getBigNumber("10000000"))

    // 100 per block farming rate starting at block 100 with bonus until block 1000
    this.chef = await this.MasterChef.deploy(this.sushi.address, this.dev.address, "100", "100", "1000")
    await this.chef.deployed()
    await this.sushi.transferOwnership(this.chef.address)

    this.factory = await this.UniswapV2Factory.deploy(this.alice.address)
    await this.factory.deployed()

    this.router = await this.UniswapV2Router02.deploy(this.factory.address, this.weth.address)
    await this.router.deployed()

    let createPairTx = await this.factory.createPair(this.sushi.address, this.weth.address)
    let _pair = (await createPairTx.wait()).events[0].args.pair
    this.sushiEth = await this.UniswapV2Pair.attach(_pair)

    await this.sushi.transfer(this.sushiEth.address, getBigNumber(10))
    await this.weth.transfer(this.sushiEth.address, getBigNumber(10))

    await this.sushiEth.mint(this.alice.address)

    await this.chef.add("100", this.sushiEth.address, true)


    createPairTx = await this.factory.createPair(this.dai.address, this.weth.address)
    _pair = (await createPairTx.wait()).events[0].args.pair
    this.daiEth = await this.UniswapV2Pair.attach(_pair)

    await this.dai.transfer(this.daiEth.address, getBigNumber(10))
    await this.weth.transfer(this.daiEth.address, getBigNumber(10))

    await this.daiEth.mint(this.alice.address)

    await this.chef.add("100", this.daiEth.address, true)
  })

  it("should set correct state variables", async function () {
    this.SimpleWallet = await ethers.getContractFactory("SimpleWallet")
    this.wallet = await this.SimpleWallet.connect(this.bob).deploy(this.router.address, this.chef.address, this.sushi.address)
    await this.wallet.deployed()

    const router = await this.wallet.router()
    const chef = await this.wallet.chef()
    const sushi = await this.wallet.sushi()
    const factory = await this.wallet.factory()

    expect(router).to.equal(this.router.address)
    expect(chef).to.equal(this.chef.address)
    expect(sushi).to.equal(this.sushi.address)
    expect(factory).to.equal(this.factory.address)
  })

  it("should allow owner and only owner to interact with contract", async function () {
    this.SimpleWallet = await ethers.getContractFactory("SimpleWallet")
    this.wallet = await this.SimpleWallet.connect(this.bob).deploy(this.router.address, this.chef.address, this.sushi.address)
    await this.wallet.deployed()

    await this.sushi.transfer(this.carol.address, "1000000")
    await this.weth.transfer(this.carol.address, "1000000")

    await this.sushi.connect(this.carol).approve(this.wallet.address, "1000000")
    await this.weth.connect(this.carol).approve(this.wallet.address, "1000000")
    await this.sushi.connect(this.carol).transfer(this.wallet.address, "1000000")
    await this.weth.connect(this.carol).transfer(this.wallet.address, "1000000")

    await expect(this.wallet.connect(this.carol).addLiquidityWithFarming(this.sushi.address, this.weth.address,"1000000","1000000","1","1","10000000000", 0)).to.be.revertedWith("Ownable: caller is not the owner")
    
    await this.sushi.transfer(this.bob.address, "1000000")
    await this.weth.transfer(this.bob.address, "1000000")

    await this.sushi.connect(this.bob).approve(this.wallet.address, "1000000")
    await this.weth.connect(this.bob).approve(this.wallet.address, "1000000")
    await this.sushi.connect(this.bob).transfer(this.wallet.address, "1000000")
    await this.weth.connect(this.bob).transfer(this.wallet.address, "1000000")

    await this.wallet.connect(this.bob).addLiquidityWithFarming(this.sushi.address, this.weth.address,"1000000","1000000","1","1","10000000000", 0)
  })

  it("should give out SUSHIs", async function () {
    this.SimpleWallet = await ethers.getContractFactory("SimpleWallet")
    this.wallet = await this.SimpleWallet.connect(this.bob).deploy(this.router.address, this.chef.address, this.sushi.address)
    await this.wallet.deployed()

    await this.sushi.transfer(this.bob.address, "1000000")
    await this.weth.transfer(this.bob.address, "1000000")

    await this.sushi.connect(this.bob).approve(this.wallet.address, "1000000")
    await this.weth.connect(this.bob).approve(this.wallet.address, "1000000")
    await this.sushi.connect(this.bob).transfer(this.wallet.address, "1000000")
    await this.weth.connect(this.bob).transfer(this.wallet.address, "1000000")

    await this.wallet.connect(this.bob).addLiquidityWithFarming(this.sushi.address, this.weth.address,"1000000","1000000","1","1","10000000000", 0)

    await advanceBlockTo("104")
    await this.wallet.connect(this.bob).updateRewards(0) // block 105

    expect(await this.sushi.balanceOf(this.wallet.address)).to.equal("2500")
  })

  it("owner should retire funds with rewards", async function () {
    this.SimpleWallet = await ethers.getContractFactory("SimpleWallet")
    this.wallet = await this.SimpleWallet.connect(this.bob).deploy(this.router.address, this.chef.address, this.sushi.address)
    await this.wallet.deployed()

    await this.sushi.transfer(this.bob.address, "1000000")
    await this.weth.transfer(this.bob.address, "1000000")

    await this.sushi.connect(this.bob).approve(this.wallet.address, "1000000")
    await this.weth.connect(this.bob).approve(this.wallet.address, "1000000")
    await this.sushi.connect(this.bob).transfer(this.wallet.address, "1000000")
    await this.weth.connect(this.bob).transfer(this.wallet.address, "1000000")

    await this.wallet.connect(this.bob).addLiquidityWithFarming(this.sushi.address, this.weth.address,"1000000","1000000","1","1","10000000000", 0)

    await advanceBlockTo("104")
    await this.wallet.connect(this.bob).updateRewards(0) // block 105

    const bonus = parseInt(await this.sushi.balanceOf(this.wallet.address))
    const expectedWithBonus = 1000000 + bonus
    
    expect(await this.sushi.balanceOf(this.bob.address)).to.equal("0")
    expect(await this.weth.balanceOf(this.bob.address)).to.equal("0")
    
    await this.wallet.connect(this.bob).withdrawLiquidityWithRewards(this.sushi.address, this.weth.address,"1000000","1","1","10000000000", 0,"1000000")
    
    expect(await this.sushi.balanceOf(this.bob.address)).to.equal(expectedWithBonus)
    expect(await this.weth.balanceOf(this.bob.address)).to.equal("1000000")
  })

  it("should be the same pool than the pair of tokens provided", async function () {
    this.SimpleWallet = await ethers.getContractFactory("SimpleWallet")
    this.wallet = await this.SimpleWallet.connect(this.bob).deploy(this.router.address, this.chef.address, this.sushi.address)
    await this.wallet.deployed()

    await this.sushi.transfer(this.bob.address, "1000000")
    await this.weth.transfer(this.bob.address, "1000000")

    await this.sushi.connect(this.bob).approve(this.wallet.address, "1000000")
    await this.weth.connect(this.bob).approve(this.wallet.address, "1000000")
    await this.sushi.connect(this.bob).transfer(this.wallet.address, "1000000")
    await this.weth.connect(this.bob).transfer(this.wallet.address, "1000000")

    await expect(this.wallet.connect(this.bob).addLiquidityWithFarming(this.sushi.address, this.weth.address,"1000000","1000000","1","1","10000000000", 1)).to.be.reverted
    await this.wallet.connect(this.bob).addLiquidityWithFarming(this.sushi.address, this.weth.address,"1000000","1000000","1","1","10000000000", 0)

    await advanceBlockTo("104")
    await this.wallet.connect(this.bob).updateRewards(0) // block 105
    
    await expect (this.wallet.connect(this.bob).withdrawLiquidityWithRewards(this.sushi.address, this.weth.address,"1000000","1","1","10000000000", 1,"1000000")).to.be.revertedWith("withdraw: not good")

    await this.wallet.connect(this.bob).withdrawLiquidityWithRewards(this.sushi.address, this.weth.address,"1000000","1","1","10000000000", 0,"1000000")
  })
    
})
