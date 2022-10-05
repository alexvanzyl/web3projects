// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  const ICO = await ethers.getContractFactory("ICO");
  const name = "The Great ICO";
  const symbol = "TGI";
  const decimals = 18;
  const initialBalance = ethers.utils.parseUnits("1000", "wei");
  const ico = await ICO.deploy(name, symbol, decimals, initialBalance);

  console.log(`ICO deployed to ${ico.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
