const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

describe("Escrow", function () {
  async function deployEscrowFixture() {
    const [holder, payer, payee] = await ethers.getSigners();
    const amount = 1000;
    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await Escrow.deploy(payer.address, payee.address, amount);

    return { escrow, holder, payer, payee, amount };
  }

  describe("Deployment", function () {
    it("Should have the correct escrow payer", async function () {
      const { escrow, payer } = await loadFixture(deployEscrowFixture);
      expect(await escrow.payer()).to.equal(payer.address);
    });

    it("Should have the correct escrow payee", async function () {
      const { escrow, payee } = await loadFixture(deployEscrowFixture);
      expect(await escrow.payee()).to.equal(payee.address);
    });

    it("Should have the correct escrow amount", async function () {
      const { escrow, amount } = await loadFixture(deployEscrowFixture);
      expect(await escrow.amount()).to.equal(amount);
    });
  });

  describe("Deposit", function () {
    describe("Validations", function () {
      it("Should revert if deposit is not made by the payer", async function () {
        const { escrow, amount } = await loadFixture(deployEscrowFixture);

        await expect(escrow.deposit({ value: amount })).to.be.revertedWith(
          "sender must be the payer"
        );
      });

      it("Should revert if amount deposited is larger than the escrow amount", async function () {
        const { escrow, amount, payer } = await loadFixture(
          deployEscrowFixture
        );

        await expect(
          escrow.connect(payer).deposit({ value: amount + 10 })
        ).to.be.revertedWith("deposit must be less or equal to amount");
      });
    });
    describe("Balance", function () {
      it("Should have balance equal to the amount deposited", async function () {
        const { escrow, payer, amount } = await loadFixture(
          deployEscrowFixture
        );

        await expect(
          escrow.connect(payer).deposit({ value: amount })
        ).to.changeEtherBalance(escrow, amount);
      });
    });
  });

  describe("Release", function () {
    describe("Validations", function () {
      it("Should revert if the holder isn't the one releasing the payment", async function () {
        const { escrow, payer } = await loadFixture(deployEscrowFixture);

        await expect(escrow.connect(payer).release()).to.be.revertedWith(
          "only holder can release funds"
        );
      });

      it("Should revert if the escrow isn't fully funded", async function () {
        const { escrow, payer, holder, amount } = await loadFixture(
          deployEscrowFixture
        );
        await escrow.connect(payer).deposit({ value: amount - 10 });

        await expect(escrow.connect(holder).release()).to.be.revertedWith(
          "escrow must be fully funded"
        );
      });
    });
    describe("Transfer", function () {
      it("Should release the funds to the payee", async function () {
        const { escrow, holder, payer, payee, amount } = await loadFixture(
          deployEscrowFixture
        );

        await escrow.connect(payer).deposit({ value: amount });

        await expect(escrow.connect(holder).release()).to.changeEtherBalances(
          [payee, escrow],
          [amount, -amount]
        );
      });
    });
  });
});
