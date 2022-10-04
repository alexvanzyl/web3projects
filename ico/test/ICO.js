const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ICO", function () {
  async function deployICOFixture() {
    const [owner, investorOne, investorTwo] = await ethers.getSigners();
    const ICO = await ethers.getContractFactory("ICO");

    const name = "The Great ICO";
    const symbol = "TGI";
    const decimals = 18;
    const initialBalance = ethers.utils.parseUnits("1000", "wei");
    const ico = await ICO.deploy(name, symbol, decimals, initialBalance);

    const tokenAddress = await ico.token();
    const token = await ethers.getContractAt("ERC20Token", tokenAddress);

    return {
      ico,
      token,
      name,
      symbol,
      decimals,
      initialBalance,
      owner,
      investorOne,
      investorTwo,
    };
  }

  describe("Deployment", function () {
    it("Should create a ERC20 token", async function () {
      const { token, name, symbol, decimals, initialBalance } =
        await loadFixture(deployICOFixture);

      expect(await token.name()).to.equal(name);
      expect(await token.symbol()).to.equal(symbol);
      expect(await token.decimals()).to.equal(decimals);
      expect(await token.totalSupply()).to.equal(initialBalance);
    });

    it("Should set the correct admin address", async function () {
      const { ico, owner } = await loadFixture(deployICOFixture);
      expect(await ico.admin()).to.equal(owner.address);
    });
  });

  describe("Start", function () {
    it("Should revert if none admin attempts", async function () {
      const { ico, investorOne } = await loadFixture(deployICOFixture);
      await expect(
        ico.connect(investorOne).start(100, 1, 100, 10, 20)
      ).to.be.revertedWith("only admin");
    });

    it("Should revert if duration is not bigger then zero", async function () {
      const { ico } = await loadFixture(deployICOFixture);
      await expect(ico.start(0, 1, 100, 10, 20)).to.be.revertedWith(
        "duration should be > 0"
      );
    });

    it("Should revert if minPurchase is not bigger then zero", async function () {
      const { ico } = await loadFixture(deployICOFixture);
      await expect(ico.start(100, 1, 100, 0, 20)).to.be.revertedWith(
        "_minPurchase should be > 0"
      );
    });

    it("Should revert if maxPurchase is not bigger then zero or more than availableTokens ", async function () {
      const { ico } = await loadFixture(deployICOFixture);
      await expect(ico.start(100, 1, 100, 10, 0)).to.be.revertedWith(
        "_maxPurchase should be > 0 and <= _availableTokens"
      );
      await expect(ico.start(100, 1, 100, 10, 2000)).to.be.revertedWith(
        "_maxPurchase should be > 0 and <= _availableTokens"
      );
    });

    it("Should revert if availableToken less than 0 or more then the totalSupply", async function () {
      const { ico } = await loadFixture(deployICOFixture);
      await expect(ico.start(100, 1, 2000, 10, 20)).to.be.revertedWith(
        "_availableTokens should be > 0 and <= totalSupply"
      );
    });

    it("Should revert if ICO is already active", async function () {
      const { ico } = await loadFixture(deployICOFixture);
      await ico.start(100, 1, 100, 10, 20);

      await expect(ico.start(100, 1, 100, 10, 20)).to.be.revertedWith(
        "ICO should not be active"
      );
    });

    it("Should start the ICO", async function () {
      const { ico } = await loadFixture(deployICOFixture);
      const duration = 100;
      const price = 1;
      const availableTokens = ethers.utils.parseUnits("100", "wei");
      const minPurchase = ethers.utils.parseUnits("10", "wei");
      const maxPurchase = ethers.utils.parseUnits("20", "wei");
      await ico.start(
        duration,
        price,
        availableTokens,
        minPurchase,
        maxPurchase
      );
      const blockTime = await time.latest();
      const expectedEnd = blockTime + duration;

      expect(await ico.end()).to.equal(ethers.BigNumber.from(expectedEnd));
      expect(await ico.price()).to.equal(ethers.BigNumber.from(price));
      expect(await ico.availableTokens()).to.equal(
        ethers.BigNumber.from(availableTokens)
      );
      expect(await ico.minPurchase()).to.equal(
        ethers.BigNumber.from(minPurchase)
      );
      expect(await ico.maxPurchase()).to.equal(
        ethers.BigNumber.from(maxPurchase)
      );
    });
  });

  describe("Whitelist", function () {
    it("Should revert if none admin attempts", async function () {
      const { ico, investorOne, investorTwo } = await loadFixture(
        deployICOFixture
      );
      await expect(
        ico.connect(investorOne).whitelist(investorTwo.address)
      ).to.be.revertedWith("only admin");
    });

    it("Should whitelist investor address", async function () {
      const { ico, investorOne } = await loadFixture(deployICOFixture);
      await ico.whitelist(investorOne.address);

      expect(await ico.investors(investorOne.address)).to.equal(true);
    });
  });

  describe("Buy", function () {
    it("Should revert if attempted by none investor", async function () {
      const { ico } = await loadFixture(deployICOFixture);
      await expect(
        ico.buy({ value: ethers.utils.parseUnits("10", "wei") })
      ).to.be.revertedWith("only investors");
    });

    it("Should revert if ICO is not active", async function () {
      const { ico, investorOne } = await loadFixture(deployICOFixture);
      await ico.whitelist(investorOne.address);

      await expect(
        ico
          .connect(investorOne)
          .buy({ value: ethers.utils.parseUnits("10", "wei") })
      ).to.be.revertedWith("ICO must be active");
    });

    it("Should revert if value isn't a multiple of price", async function () {
      const { ico, investorOne } = await loadFixture(deployICOFixture);
      await ico.whitelist(investorOne.address);

      const duration = 100;
      const price = 2;
      const availableTokens = ethers.utils.parseUnits("100", "wei");
      const minPurchase = ethers.utils.parseUnits("10", "wei");
      const maxPurchase = ethers.utils.parseUnits("20", "wei");
      await ico.start(
        duration,
        price,
        availableTokens,
        minPurchase,
        maxPurchase
      );

      await expect(
        ico
          .connect(investorOne)
          .buy({ value: ethers.utils.parseUnits("1", "wei") })
      ).to.be.revertedWith("have to send a multiple of price");
    });

    it("Should revert if value isn't between minPurchase and maxPurchase", async function () {
      const { ico, investorOne } = await loadFixture(deployICOFixture);
      await ico.whitelist(investorOne.address);

      const duration = 100;
      const price = 1;
      const availableTokens = ethers.utils.parseUnits("100", "wei");
      const minPurchase = ethers.utils.parseUnits("10", "wei");
      const maxPurchase = ethers.utils.parseUnits("20", "wei");
      await ico.start(
        duration,
        price,
        availableTokens,
        minPurchase,
        maxPurchase
      );

      await expect(
        ico
          .connect(investorOne)
          .buy({ value: ethers.utils.parseUnits("1", "wei") })
      ).to.be.revertedWith("have to send between minPurchase and maxPurchase");
      await expect(
        ico
          .connect(investorOne)
          .buy({ value: ethers.utils.parseUnits("21", "wei") })
      ).to.be.revertedWith("have to send between minPurchase and maxPurchase");
    });

    it("Should revert if not enough available tokens", async function () {
      const { ico, investorOne } = await loadFixture(deployICOFixture);
      await ico.whitelist(investorOne.address);

      const duration = 100;
      const price = 1;
      const availableTokens = ethers.utils.parseUnits("10", "wei");
      const minPurchase = ethers.utils.parseUnits("5", "wei");
      const maxPurchase = ethers.utils.parseUnits("10", "wei");
      await ico.start(
        duration,
        price,
        availableTokens,
        minPurchase,
        maxPurchase
      );

      await ico
        .connect(investorOne)
        .buy({ value: ethers.utils.parseUnits("5", "wei") });

      await expect(
        ico
          .connect(investorOne)
          .buy({ value: ethers.utils.parseUnits("10", "wei") })
      ).to.be.revertedWith("not enough tokens left for sale");
    });

    it("Should create a sale", async function () {
      const { ico, investorOne } = await loadFixture(deployICOFixture);
      await ico.whitelist(investorOne.address);

      const duration = 100;
      const price = 1;
      const availableTokens = ethers.utils.parseUnits("100", "wei");
      const minPurchase = ethers.utils.parseUnits("10", "wei");
      const maxPurchase = ethers.utils.parseUnits("20", "wei");
      await ico.start(
        duration,
        price,
        availableTokens,
        minPurchase,
        maxPurchase
      );
      await ico
        .connect(investorOne)
        .buy({ value: ethers.utils.parseUnits("10", "wei") });
      const sale = await ico.sales(0);

      expect(sale.investor).to.equal(investorOne.address);
      expect(sale.quantity.toNumber()).to.equal(price * 10);
    });

    it("Should decrement the amount of availableTokens", async function () {
      const { ico, investorOne } = await loadFixture(deployICOFixture);
      await ico.whitelist(investorOne.address);

      const duration = 100;
      const price = 1;
      const availableTokens = ethers.utils.parseUnits("100", "wei");
      const minPurchase = ethers.utils.parseUnits("10", "wei");
      const maxPurchase = ethers.utils.parseUnits("20", "wei");
      await ico.start(
        duration,
        price,
        availableTokens,
        minPurchase,
        maxPurchase
      );
      await ico
        .connect(investorOne)
        .buy({ value: ethers.utils.parseUnits("10", "wei") });

      expect(await ico.availableTokens()).to.equal(
        availableTokens - price * 10
      );
    });
  });
});
