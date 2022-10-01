const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("MultiSig", function () {
  async function deployMultiSigFixture() {
    const [owner, sigOne, sigTwo, payee] = await ethers.getSigners();
    const MultiSig = await ethers.getContractFactory("MultiSig");
    const multiSig = await MultiSig.deploy(
      [sigOne.address, sigTwo.address],
      2,
      { value: 100 }
    );

    return { owner, sigOne, sigTwo, payee, multiSig };
  }

  describe("Create Transfer", function () {
    describe("Validations", function () {
      it("should revert if non-approver is trying to create transfer", async function () {
        const { multiSig, payee } = await loadFixture(deployMultiSigFixture);
        await expect(
          multiSig.createTransfer(100, payee.address)
        ).to.be.revertedWith("only approver allowed");
      });
    });
    describe("Create", function () {
      it("should create a transfer", async function () {
        const { multiSig, sigOne, payee } = await loadFixture(
          deployMultiSigFixture
        );

        await multiSig.connect(sigOne).createTransfer(100, payee.address);
        const transfer = await multiSig.transfers(0);

        expect(transfer.id.toNumber()).to.equal(0);
        expect(transfer.amount.toNumber()).to.equal(100);
      });
    });
  });

  describe("Send Transfer", function () {
    describe("Validations", function () {
      it("should revert if non-approver is trying to send", async function () {
        const { multiSig, sigOne, payee } = await loadFixture(
          deployMultiSigFixture
        );
        await multiSig.connect(sigOne).createTransfer(100, payee.address);

        await expect(multiSig.sendTransfer(0)).to.be.revertedWith(
          "only approver allowed"
        );
      });

      it("should revert if already sent", async function () {
        const { multiSig, sigOne, sigTwo, payee } = await loadFixture(
          deployMultiSigFixture
        );
        await multiSig.connect(sigOne).createTransfer(100, payee.address);
        await multiSig.connect(sigOne).sendTransfer(0);
        await multiSig.connect(sigTwo).sendTransfer(0);

        await expect(
          multiSig.connect(sigTwo).sendTransfer(0)
        ).to.be.revertedWith("transfer already sent");
      });

      it("should not increment approvals if the same wallet attempts to send more than once", async function () {
        const { multiSig, sigOne, payee } = await loadFixture(
          deployMultiSigFixture
        );
        await multiSig.connect(sigOne).createTransfer(100, payee.address);
        await multiSig.connect(sigOne).sendTransfer(0);
        await multiSig.connect(sigOne).sendTransfer(0);

        const transfer = await multiSig.transfers(0);

        expect(transfer.approvals.toNumber()).to.equal(1);
      });

      it("should not send if quorum is not reached", async function () {
        const { multiSig, sigOne, payee } = await loadFixture(
          deployMultiSigFixture
        );
        await multiSig.connect(sigOne).createTransfer(100, payee.address);
        await multiSig.connect(sigOne).sendTransfer(0);

        expect(
          await multiSig.connect(sigOne).sendTransfer(0)
        ).to.not.changeEtherBalance(payee, 0);
      });
    });
    describe("Send", function () {
      it("should be marked as sent", async function () {
        const { multiSig, sigOne, sigTwo, payee } = await loadFixture(
          deployMultiSigFixture
        );
        await multiSig.connect(sigOne).createTransfer(100, payee.address);
        await multiSig.connect(sigOne).sendTransfer(0);
        await multiSig.connect(sigTwo).sendTransfer(0);

        const transfer = await multiSig.transfers(0);
        expect(transfer.sent).to.equal(true);
      });
      it("should send transfer amount to payee", async function () {
        const { multiSig, sigOne, sigTwo, payee } = await loadFixture(
          deployMultiSigFixture
        );
        await multiSig.connect(sigOne).createTransfer(100, payee.address);
        await multiSig.connect(sigOne).sendTransfer(0);

        expect(
          await multiSig.connect(sigTwo).sendTransfer(0)
        ).to.changeEtherBalance(payee, 100);
      });
    });
  });
});
