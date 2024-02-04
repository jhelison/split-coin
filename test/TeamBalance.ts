import { expect } from "chai";
import { ethers } from "hardhat";

describe("TeamBalance", function () {
  // deployBasicTeamBalance deploy a basic team with two members and 50 50 division
  async function deployBasicTeamBalance(numAddresses: number, proportion: number[]) {
    const addresses = await ethers.getSigners();

    const TeamBalance = await ethers.getContractFactory("TeamBalance");
    const teamBalance = await TeamBalance.deploy(addresses.slice(0, numAddresses), proportion);

    const owner = addresses[0]
    return { TeamBalance, teamBalance, proportion, owner, addresses };
  }

  // deployErc20 deploy a test ERC20
  async function deployErc20() {
    const TestERC20 = await ethers.getContractFactory("TestToken");
    const testERC20 = await TestERC20.deploy("TEST", "tes", ethers.parseEther("1000"));

    return testERC20
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { teamBalance, owner } = await deployBasicTeamBalance(2, [60, 40]);

      expect(await teamBalance.owner()).to.equal(owner.address)
    });

    it("Should set the right team and proportion", async function () {
      const { teamBalance, owner, addresses } = await deployBasicTeamBalance(3, [60, 20, 20]);

      // Test the two addresses
      expect(await teamBalance.teamProportion(owner)).to.equal(60)
      expect(await teamBalance.teamProportion(addresses[1])).to.equal(20)
      expect(await teamBalance.teamProportion(addresses[2])).to.equal(20)
    });

    it("Should fail if team length is zero", async function () {
      const TeamBalance = await ethers.getContractFactory("TeamBalance");
      await expect(TeamBalance.deploy([], []))
        .to
        .revertedWithCustomError(TeamBalance, "LengthMismatch")
        .withArgs("Team length must be bigger than 0")
    });

    it("Should fail if team length differs from proportion", async function () {
      const [owner, otherAccount] = await ethers.getSigners();

      const TeamBalance = await ethers.getContractFactory("TeamBalance");
      await expect(TeamBalance.deploy([owner, otherAccount], [40]))
        .to
        .revertedWithCustomError(TeamBalance, "LengthMismatch")
        .withArgs("Team and proportions length mismatch")
    });

    it("Should fail if proportion bellow 100", async function () {
      const [owner, otherAccount] = await ethers.getSigners();
      const TeamBalance = await ethers.getContractFactory("TeamBalance");
      await expect(TeamBalance.deploy([owner, otherAccount], [49, 50]))
        .to
        .revertedWithCustomError(TeamBalance, "BadProportion")
        .withArgs("Total proportion must equal 100")
    });

    it("Should fail if proportion above 100", async function () {
      const [owner, otherAccount] = await ethers.getSigners();
      const TeamBalance = await ethers.getContractFactory("TeamBalance");
      await expect(TeamBalance.deploy([owner, otherAccount], [51, 50]))
        .to
        .revertedWithCustomError(TeamBalance, "BadProportion")
        .withArgs("Total proportion must equal 100")
    });

    it("Should fail if team has zero hex address", async function () {
      const [owner] = await ethers.getSigners();
      const TeamBalance = await ethers.getContractFactory("TeamBalance");
      await expect(TeamBalance.deploy([owner, "0x0000000000000000000000000000000000000000"], [50, 50])).to.revertedWithCustomError(TeamBalance, "InvalidAddress")
    });
  })

  describe("availableToWithdraw", function () {
    it("Should receive the correct balance without withdraw", async function () {
      const { teamBalance, addresses } = await deployBasicTeamBalance(2, [50, 50]);
      const erc20 = await deployErc20();

      // Transfer 10 tokens to the team balance
      await (await erc20.transfer(teamBalance, ethers.parseEther("10"))).wait()

      // Member a should have 5 tokens, member b should have 5 tokens
      expect(await teamBalance.balanceERC20(erc20, addresses[0])).to.equal(ethers.parseEther("5"))
      expect(await teamBalance.balanceERC20(erc20, addresses[1])).to.equal(ethers.parseEther("5"))
    });

    it("Should receive the correct balance without withdraw - multiple balances", async function () {
      const proportion = [1, 23, 37, 4, 35]
      const { teamBalance, addresses } = await deployBasicTeamBalance(proportion.length, proportion);
      const erc20 = await deployErc20();

      // Transfer 10.x tokens to the team balance
      const etherAmount = ethers.parseEther("10.12356");
      await (await erc20.transfer(teamBalance, etherAmount)).wait()

      // Check if each one has the correct balance
      for (let i = 0; i < proportion.length; i++) {
        expect(await teamBalance.balanceERC20(erc20, addresses[i]))
          .to
          .equal((etherAmount * BigInt(proportion[i]) / BigInt(100)).toString())
      }
    });

    it("Should be 0 if balance outside team is used", async function () {
      const proportion = [50, 50]
      const { teamBalance, addresses } = await deployBasicTeamBalance(proportion.length, proportion);
      const erc20 = await deployErc20();

      // Transfer 10.x tokens to the team balance
      const etherAmount = ethers.parseEther("10");
      await (await erc20.transfer(teamBalance, etherAmount)).wait()

      expect(await teamBalance.balanceERC20(erc20, addresses[2]))
        .to
        .equal(0)
    });

    describe("withdrawERC20", function () {
      describe("Validations", function () {
        it("Should fail when user isn't from team", async function () {
          const { TeamBalance, teamBalance, addresses } = await deployBasicTeamBalance(2, [50, 50]);

          // Transfer 10 tokens to the team balance
          const erc20 = await deployErc20();
          await (await erc20.transfer(teamBalance, ethers.parseEther("10"))).wait()

          await expect(teamBalance.withdrawERC20(erc20, addresses[2]))
            .to
            .revertedWithCustomError(TeamBalance, "NoUserProportion")
            .withArgs("User has no proportion assigned")
        });

        it("Should fail when user has no balance", async function () {
          const { TeamBalance, teamBalance, addresses } = await deployBasicTeamBalance(2, [50, 50]);

          // Transfer 10 tokens to the team balance
          const erc20 = await deployErc20();

          await expect(teamBalance.withdrawERC20(erc20, addresses[0]))
            .to
            .revertedWithCustomError(TeamBalance, "NoBalanceToWithdraw")
            .withArgs("No balance available to withdraw")
        });

        it("Should fail if not owner", async function () {
          const proportion = [0, 50, 50] // Trick to eliminate the owner that has erc20 balance
          const { TeamBalance, teamBalance, addresses } = await deployBasicTeamBalance(proportion.length, proportion);
          const erc20 = await deployErc20();

          // Do the withdraw
          const teamBalance2 = await ethers.getContractAt("TeamBalance", teamBalance, addresses[1])
          await expect(teamBalance2.withdrawERC20(erc20, addresses[1]))
            .to
            .revertedWithCustomError(TeamBalance, "NotOwner")
        });
      })

      describe("Event", function () {
        it("Should emit Withdrawn event", async function () {
          const proportion = [50, 50]
          const { teamBalance, addresses } = await deployBasicTeamBalance(proportion.length, proportion);
          const erc20 = await deployErc20();

          // Transfer 10.x tokens to the team balance
          const etherAmount = ethers.parseEther("10");
          await (await erc20.transfer(teamBalance, etherAmount)).wait()

          await expect(teamBalance.withdrawERC20(erc20, addresses[0]))
            .to
            .emit(teamBalance, "Withdrawn")
            .withArgs(addresses[0], erc20, ethers.parseEther("5"))
        });
      })

      describe("Execute", function () {
        it("Should withdraw with single transfer", async function () {
          const proportion = [0, 50, 50] // Trick to eliminate the owner that has erc20 balance
          const { teamBalance, addresses } = await deployBasicTeamBalance(proportion.length, proportion);
          const erc20 = await deployErc20();

          // Transfer 10.x tokens to the team balance
          const etherAmount = ethers.parseEther("10");
          await (await erc20.transfer(teamBalance, etherAmount)).wait()

          // Do the withdraw
          await (await teamBalance.withdrawERC20(erc20, addresses[1])).wait()

          // First address must have 5 tokens
          expect(await erc20.balanceOf(addresses[1]))
            .to
            .equal(ethers.parseEther("5"))
          // Contract address must have 5 tokens
          expect(await erc20.balanceOf(teamBalance))
            .to
            .equal(ethers.parseEther("5"))

          // First address must have 0 balance available
          expect(await teamBalance.balanceERC20(erc20, addresses[1]))
            .to
            .equal(ethers.parseEther("0"))

          // Second address must have 5 balance available
          expect(await teamBalance.balanceERC20(erc20, addresses[2]))
            .to
            .equal(ethers.parseEther("5"))
        });

        it("Should withdraw with multiple transfers", async function () {
          const proportion = [0, 50, 50] // Trick to eliminate the owner that has erc20 balance
          const { teamBalance, addresses } = await deployBasicTeamBalance(proportion.length, proportion);
          const erc20 = await deployErc20();

          // Transfer 10.x tokens to the team balance
          const etherAmount = ethers.parseEther("10");
          await (await erc20.transfer(teamBalance, etherAmount)).wait()

          // Do the withdraw
          await (await teamBalance.withdrawERC20(erc20, addresses[1])).wait()

          // Transfer more and withdraw again
          await (await erc20.transfer(teamBalance, etherAmount)).wait()
          await (await teamBalance.withdrawERC20(erc20, addresses[1])).wait()

          // First address must have 10 tokens
          expect(await erc20.balanceOf(addresses[1]))
            .to
            .equal(ethers.parseEther("10"))
          // Contract address must have 10 tokens
          expect(await erc20.balanceOf(teamBalance))
            .to
            .equal(ethers.parseEther("10"))

          // First address must have 0 balance available
          expect(await teamBalance.balanceERC20(erc20, addresses[1]))
            .to
            .equal(ethers.parseEther("0"))

          // Second address must have 10 balance available
          expect(await teamBalance.balanceERC20(erc20, addresses[2]))
            .to
            .equal(ethers.parseEther("10"))
        });

        it("Should withdraw with decimal values", async function () {
          const proportion = [0, 50, 50] // Trick to eliminate the owner that has erc20 balance
          const { teamBalance, addresses } = await deployBasicTeamBalance(proportion.length, proportion);
          const erc20 = await deployErc20();

          // Transfer 777 tokens to the team balance
          await (await erc20.transfer(teamBalance, 777)).wait()

          // Do the withdraw
          await (await teamBalance.withdrawERC20(erc20, addresses[1])).wait()
          await (await teamBalance.withdrawERC20(erc20, addresses[2])).wait()

          // Team will still have one token
          expect(await erc20.balanceOf(teamBalance)).to.equal(1)

          // Do it again
          // Transfer 777 tokens to the team balance
          await (await erc20.transfer(teamBalance, 777)).wait()

          // Do the withdraw
          await (await teamBalance.withdrawERC20(erc20, addresses[1])).wait()
          await (await teamBalance.withdrawERC20(erc20, addresses[2])).wait()

          // Team will still have zero tokens
          expect(await erc20.balanceOf(teamBalance))
            .to
            .equal(0)

          // Each member will have equal value
          expect(await erc20.balanceOf(addresses[1])).to.equal(777)
          expect(await erc20.balanceOf(addresses[2])).to.equal(777)

          // Both addresses must have 0 balance available
          expect(await teamBalance.balanceERC20(erc20, addresses[1])).to.equal(0)
          expect(await teamBalance.balanceERC20(erc20, addresses[2])).to.equal(0)
        });
      })
    })
  });
});
