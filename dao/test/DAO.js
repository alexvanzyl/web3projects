const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

describe("DAO", function () {
  async function deployDAOFixture() {
    const [owner, investorOne, investorTwo, investorThree, payee] =
      await ethers.getSigners();
    const quorum = 50;
    const contributionTime = 10;
    const voteTime = 10;
    const DAO = await ethers.getContractFactory("DAO");
    const dao = await DAO.deploy(contributionTime, voteTime, quorum);

    return {
      dao,
      quorum,
      contributionTime,
      voteTime,
      owner,
      investorOne,
      investorTwo,
      investorThree,
      payee,
    };
  }

  async function createProposalFixture() {
    const {
      dao,
      quorum,
      contributionTime,
      voteTime,
      owner,
      investorOne,
      investorTwo,
      investorThree,
      payee,
    } = await loadFixture(deployDAOFixture);

    await dao.connect(investorOne).contribute({ value: 1 });
    await dao.connect(investorTwo).contribute({ value: 1 });
    await dao.connect(investorThree).contribute({ value: 1 });

    await dao.connect(investorOne).createProposal("DAI", 1, payee.address);

    return {
      dao,
      quorum,
      contributionTime,
      voteTime,
      owner,
      investorOne,
      investorTwo,
      investorThree,
      payee,
    };
  }

  describe("Deployment", function () {
    it("Should revert if the quorum is less than 0 or more than 100", async function () {
      const DAO = await ethers.getContractFactory("DAO");
      await expect(DAO.deploy(10, 10, 0, {})).to.be.revertedWith(
        "quorum must be between 0 and 100"
      );
      await expect(DAO.deploy(10, 10, 101)).to.be.revertedWith(
        "quorum must be between 0 and 100"
      );
    });

    it("Should set the correct quorum", async function () {
      const { dao, quorum } = await loadFixture(deployDAOFixture);

      expect(parseInt(await dao.quorum())).to.equal(quorum);
    });

    it("Should set the correct contributionEnd time", async function () {
      const { dao, contributionTime } = await loadFixture(deployDAOFixture);
      const blockTime = await time.latest();

      expect(parseInt(await dao.contributionEnd())).to.equal(
        blockTime + contributionTime
      );
    });

    it("Should set the correct voteTime", async function () {
      const { dao, voteTime } = await loadFixture(deployDAOFixture);

      expect(parseInt(await dao.voteTime())).to.equal(voteTime);
    });

    it("Should set the correct admin", async function () {
      const { dao, owner } = await loadFixture(deployDAOFixture);

      expect(await dao.admin()).to.equal(owner.address);
    });
  });

  describe("Contribute", function () {
    it("Should revert if trying to contribute after contributionEnd", async function () {
      const { dao, investorOne, contributionTime } = await loadFixture(
        deployDAOFixture
      );
      await time.increase(contributionTime + 1);

      await expect(
        dao.connect(investorOne).contribute({ value: 100 })
      ).to.be.revertedWith("cannot contribute after contributionEnd");
    });

    it("Should allow contributor to become investor", async function () {
      const { dao, investorOne } = await loadFixture(deployDAOFixture);
      await dao.connect(investorOne).contribute({ value: 1 });

      expect(await dao.investors(investorOne.address)).to.equal(true);
    });

    it("Should assign shares to contributor equal to ether invested", async function () {
      const { dao, investorOne } = await loadFixture(deployDAOFixture);
      const amountInvested = 10;
      await dao.connect(investorOne).contribute({ value: amountInvested });

      expect(parseInt(await dao.shares(investorOne.address))).to.equal(
        amountInvested
      );
    });

    it("Should increment totalShares", async function () {
      const { dao, investorOne, investorTwo } = await loadFixture(
        deployDAOFixture
      );
      await dao.connect(investorOne).contribute({ value: 1 });
      await dao.connect(investorTwo).contribute({ value: 1 });

      expect(parseInt(await dao.totalShares())).to.equal(2);
    });

    it("Should increment availableFunds", async function () {
      const { dao, investorOne, investorTwo } = await loadFixture(
        deployDAOFixture
      );
      await dao.connect(investorOne).contribute({ value: 1 });
      await dao.connect(investorTwo).contribute({ value: 1 });

      expect(parseInt(await dao.availableFunds())).to.equal(2);
    });
  });

  describe("Redeem Share", function () {
    it("Should revert if investor it trying to redeem more shares than they own", async function () {
      const { dao, investorOne } = await loadFixture(deployDAOFixture);
      await dao.connect(investorOne).contribute({ value: 1 });

      await expect(dao.connect(investorOne).redeemShare(2)).to.revertedWith(
        "not enough shares"
      );
    });

    it("Should revert if investor it trying to redeem an amount more than available", async function () {
      const { dao, owner, investorOne } = await loadFixture(deployDAOFixture);
      await dao.connect(investorOne).contribute({ value: 1 });
      await dao.connect(owner).withdrawEther(1, owner.address);

      await expect(dao.connect(investorOne).redeemShare(1)).to.revertedWith(
        "not enough availableFunds"
      );
    });

    it("Should decrement the amount of shares", async function () {
      const { dao, investorOne } = await loadFixture(deployDAOFixture);
      await dao.connect(investorOne).contribute({ value: 1 });
      await dao.connect(investorOne).redeemShare(1);

      expect(parseInt(await dao.shares(investorOne.address))).to.equal(0);
    });

    it("Should transfer funds back to investor", async function () {
      const { dao, investorOne } = await loadFixture(deployDAOFixture);
      await dao.connect(investorOne).contribute({ value: 1 });

      await expect(
        dao.connect(investorOne).redeemShare(1)
      ).to.changeEtherBalance(investorOne, 1);
    });
  });

  describe("Transfer Share", function () {
    it("Should revert if investor is trying to transfer more shares than owned", async function () {
      const { dao, investorOne, payee } = await loadFixture(deployDAOFixture);
      await dao.connect(investorOne).contribute({ value: 1 });

      await expect(
        dao.connect(investorOne).transferShare(2, payee.address)
      ).to.revertedWith("not enough shares");
    });

    it("Should decrement the numbers of shares an investor owns", async function () {
      const { dao, investorOne, payee } = await loadFixture(deployDAOFixture);
      await dao.connect(investorOne).contribute({ value: 2 });
      await dao.connect(investorOne).transferShare(1, payee.address);

      expect(parseInt(await dao.shares(investorOne.address))).to.equal(1);
    });

    it("Should increment the shares of the receiver", async function () {
      const { dao, investorOne, payee } = await loadFixture(deployDAOFixture);
      await dao.connect(investorOne).contribute({ value: 2 });
      await dao.connect(investorOne).transferShare(1, payee.address);

      expect(parseInt(await dao.shares(payee.address))).to.equal(1);
    });

    it("Should mark the receiving address as an investor", async function () {
      const { dao, investorOne, payee } = await loadFixture(deployDAOFixture);
      await dao.connect(investorOne).contribute({ value: 2 });
      await dao.connect(investorOne).transferShare(1, payee.address);

      expect(await dao.investors(payee.address)).to.equal(true);
    });
  });

  describe("Create Proposal", function () {
    it("Should revert if attempted by none investor", async function () {
      const { dao, payee } = await loadFixture(deployDAOFixture);

      await expect(
        dao.createProposal("DAI", 1, payee.address)
      ).to.be.revertedWith("only investors");
    });

    it("Should revert if attempting to create proposal with amount bigger than availableFunds", async function () {
      const { dao, investorOne, payee } = await loadFixture(deployDAOFixture);
      await dao.connect(investorOne).contribute({ value: 1 });

      await expect(
        dao.connect(investorOne).createProposal("DAI", 2, payee.address)
      ).to.be.revertedWith("amount to big");
    });

    it("Should decrement the amount of available funds", async function () {
      const { dao, investorOne, payee } = await loadFixture(deployDAOFixture);
      await dao.connect(investorOne).contribute({ value: 2 });
      await dao.connect(investorOne).createProposal("DAI", 1, payee.address);

      expect(parseInt(await dao.availableFunds())).to.equal(1);
    });

    it("Should set the next proposal ID", async function () {
      const { dao, investorOne, payee } = await loadFixture(deployDAOFixture);
      await dao.connect(investorOne).contribute({ value: 2 });
      await dao.connect(investorOne).createProposal("DAI", 1, payee.address);

      expect(parseInt(await dao.nextProposalId())).to.equal(1);
    });

    it("Should create a valid proposal", async function () {
      const { dao, investorOne, payee, voteTime } = await loadFixture(
        deployDAOFixture
      );
      await dao.connect(investorOne).contribute({ value: 2 });
      await dao.connect(investorOne).createProposal("DAI", 1, payee.address);

      const proposal = await dao.proposals(0);
      const blockTime = await time.latest();

      expect(proposal.id.toNumber()).to.equal(0);
      expect(proposal.name).to.equal("DAI");
      expect(proposal.amount.toNumber()).to.equal(1);
      expect(proposal.recipient).to.equal(payee.address);
      expect(proposal.votes.toNumber()).to.equal(0);
      expect(proposal.end.toNumber()).to.equal(blockTime + voteTime);
      expect(proposal.executed).to.equal(false);
    });
  });

  describe("Vote", function () {
    it("Should revert if attempted by none investor", async function () {
      const { dao, investorOne, payee } = await loadFixture(deployDAOFixture);
      await dao.connect(investorOne).contribute({ value: 2 });
      await dao.connect(investorOne).createProposal("DAI", 1, payee.address);

      await expect(dao.vote(0)).to.be.revertedWith("only investors");
    });

    it("Should revert if investor attempts to vote more than once", async function () {
      const { dao, investorOne, payee } = await loadFixture(deployDAOFixture);
      await dao.connect(investorOne).contribute({ value: 2 });
      await dao.connect(investorOne).createProposal("DAI", 1, payee.address);
      await dao.connect(investorOne).vote(0);

      await expect(dao.connect(investorOne).vote(0)).to.be.revertedWith(
        "can only vote once"
      );
    });

    it("Should revert if investor attempts to vote after proposal end date", async function () {
      const { dao, investorOne, payee, voteTime } = await loadFixture(
        deployDAOFixture
      );
      await dao.connect(investorOne).contribute({ value: 2 });
      await dao.connect(investorOne).createProposal("DAI", 1, payee.address);
      await time.increase(voteTime + 1);

      await expect(dao.connect(investorOne).vote(0)).to.be.revertedWith(
        "can only vote until proposal end"
      );
    });

    it("Should increment the amount of votes in proportion to the amount of shares an investor owns", async function () {
      const { dao, investorOne, payee } = await loadFixture(deployDAOFixture);
      await dao.connect(investorOne).contribute({ value: 2 });
      await dao.connect(investorOne).createProposal("DAI", 1, payee.address);

      const proposalBefore = await dao.proposals(0);
      const proposalVotesBefore = proposalBefore.votes.toNumber();

      await dao.connect(investorOne).vote(0);

      const proposalAfter = await dao.proposals(0);

      expect(await proposalAfter.votes.toNumber()).to.equal(
        proposalVotesBefore + 2
      );
    });
  });

  describe("Execute Proposal", function () {
    it("Should revert if attempted by none admin", async function () {
      const { dao, investorOne } = await loadFixture(deployDAOFixture);
      await dao.connect(investorOne).contribute({ value: 1 });

      await expect(
        dao.connect(investorOne).executeProposal(0)
      ).to.be.revertedWith("only admin");
    });

    it("Should revert if executed before proposal end date", async function () {
      const { dao } = await loadFixture(createProposalFixture);

      await expect(dao.executeProposal(0)).to.be.revertedWith(
        "cannot execute proposal before end date"
      );
    });

    it("Should revert if there are not enough votes", async function () {
      const { dao, investorOne, voteTime } = await loadFixture(
        createProposalFixture
      );
      await dao.connect(investorOne).vote(0);
      await time.increase(voteTime);

      await expect(dao.executeProposal(0)).to.be.revertedWith(
        "not enough votes to execute proposal"
      );
    });

    it("Should transfer proposal amount to recipient", async function () {
      const { dao, investorOne, investorTwo, voteTime, payee } =
        await loadFixture(createProposalFixture);
      await dao.connect(investorOne).vote(0);
      await dao.connect(investorTwo).vote(0);
      await time.increase(voteTime);

      const proposal = await dao.proposals(0);
      const proposalAmount = proposal.amount.toNumber();

      await expect(dao.executeProposal(0)).to.changeEtherBalances(
        [dao, payee],
        [-proposalAmount, proposalAmount]
      );
    });

    it("Should revert if attempted to execute more than once", async function () {
      const { dao, investorOne, investorTwo, voteTime } = await loadFixture(
        createProposalFixture
      );
      await dao.connect(investorOne).vote(0);
      await dao.connect(investorTwo).vote(0);
      await time.increase(voteTime);
      await dao.executeProposal(0);

      await expect(dao.executeProposal(0)).to.be.revertedWith(
        "proposal already executed"
      );
    });
  });

  describe("Withdraw", function () {
    it("Should revert if attempted by none admin", async function () {
      const { dao, investorOne, payee } = await loadFixture(deployDAOFixture);

      await expect(
        dao.connect(investorOne).withdrawEther(10, payee.address)
      ).to.be.revertedWith("only admin");
    });

    it("Should revert if not enough available funds", async function () {
      const { dao, payee } = await loadFixture(deployDAOFixture);

      await expect(dao.withdrawEther(10, payee.address)).to.be.revertedWith(
        "not enough availableFunds"
      );
    });

    it("Should transfer funds to recipient", async function () {
      const { dao, investorOne, payee } = await loadFixture(deployDAOFixture);

      await dao.connect(investorOne).contribute({ value: 10 });

      await expect(dao.withdrawEther(1, payee.address)).to.changeEtherBalances(
        [dao, payee],
        [-1, 1]
      );
    });
  });
});
