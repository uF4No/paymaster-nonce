import { expect } from "chai";
import { Wallet, Provider, Contract, utils } from "zksync-web3";
import * as hre from "hardhat";
import * as ethers from "ethers";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

const RICH_WALLET_PK =
  "0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110";

async function deployPaymaster(deployer: Deployer): Promise<Contract> {
  const artifactPay = await deployer.loadArtifact("Paymaster");
  return await deployer.deploy(artifactPay);
}

async function deployERC20(deployer: Deployer): Promise<Contract> {
  const artifact = await deployer.loadArtifact("MyERC20");
  return await deployer.deploy(artifact, ["MyToken", "MTK", 18]);
}

async function deployGreeter(deployer: Deployer): Promise<Contract> {
  const artifact = await deployer.loadArtifact("Greeter");

  return await deployer.deploy(artifact, ["Hi"]);
}

describe("Greeter", function () {
  it("Should return the new greeting once it's changed", async function () {
    const provider = Provider.getDefaultProvider();

    const wallet = new Wallet(RICH_WALLET_PK, provider);
    const deployer = new Deployer(hre, wallet);

    const greeter = await deployGreeter(deployer);

    console.log("Greeter deployed to :>> ", greeter.address);

    const paymaster = await deployPaymaster(deployer);

    console.log("paymaster deployed to :>> ", paymaster.address);

    // Supplying paymaster with ETH
    await (
      await deployer.zkWallet.sendTransaction({
        to: paymaster.address,
        value: ethers.utils.parseEther("0.3"),
      })
    ).wait();

    console.log("Paymaster funded");

    const erc20 = await deployERC20(deployer);

    console.log("erc20 deployed to :>> ", erc20.address);

    expect(await greeter.greet()).to.eq("Hi");

    console.log(
      `Account balance is ${await (
        await deployer.zkWallet.getBalance()
      ).toString()}`
    );
    console.log("nonce :>> ", await deployer.zkWallet.getNonce());

    const setGreetingTx = await greeter.setGreeting("Hola, mundo!");

    console.log(`Tx to update message is ${setGreetingTx.hash}`);
    // wait until the transaction is mined
    await setGreetingTx.wait();

    console.log("Message updated without paymaster");

    expect(await greeter.greet()).to.equal("Hola, mundo!");

    // Tested with both paymaster flows
    // const paymasterParams = utils.getPaymasterParams(paymaster.address, {
    //   type: "General",
    //   innerInput: new Uint8Array(),
    // });

    const paymasterParams = utils.getPaymasterParams(paymaster.address, {
      type: "ApprovalBased",
      token: erc20.address,
      minimalAllowance: ethers.BigNumber.from(1),
      innerInput: new Uint8Array(),
    });

    console.log("paymaster params :>> ", paymasterParams);

    const balance1 = await deployer.zkWallet.getBalance();

    console.log(`Account balance is ${balance1.toString()}`);

    const setGreetingTx2 = await greeter.setGreeting("Hola, mundo 2!", {
      customData: {
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
        paymasterParams: paymasterParams,
      },
    });
    console.log(`Tx to update message via paymaster is ${setGreetingTx2.hash}`);

    // wait until the transaction is mined
    const receipt = await setGreetingTx2.wait();

    console.log(
      "Account nonce after paymaster tx :>> ",
      await deployer.zkWallet.getNonce()
    );

    const balance2 = await deployer.zkWallet.getBalance();

    console.log(`Account balance is ${balance2.toString()}`);

    expect(await greeter.greet()).to.equal("Hola, mundo 2!");

    expect(balance1.toString()).to.equal(balance2.toString());
  });
});
