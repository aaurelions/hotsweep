import { Instance, Server } from "prool";
import { createWalletClient, createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import fs from "fs";
import path from "path";
import { createServer, type AddressInfo } from "net";

export const getFreePort = async (host = "localhost"): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, host, () => {
      const port = (server.address() as AddressInfo).port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
};

function getArtifact(pathStr: string) {
  // Navigate from apps/cli/test/utils/prool.ts to packages/contracts/out
  // ../../../.. goes to root
  const artifactPath = path.resolve(
    __dirname,
    "../../../../packages/contracts/out",
    pathStr
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Artifact not found at ${artifactPath}. Did you run 'forge build'?`
    );
  }
  const content = fs.readFileSync(artifactPath, "utf-8");
  const json = JSON.parse(content);
  return {
    abi: json.abi,
    bytecode: json.bytecode.object as Hex,
  };
}

export async function startTestEnv() {
  const port = await getFreePort();
  const server = Server.create({
    instance: Instance.anvil({
      hardfork: "Prague",
    }),
    port,
  });

  await server.start();

  const rpcUrl = `http://localhost:${port}/1`;

  // Anvil default account #0
  const account = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );

  const client = createWalletClient({
    account,
    chain: foundry,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain: foundry,
    transport: http(rpcUrl),
  });

  // Load Artifacts
  const HotSweep = getArtifact("HotSweep.sol/HotSweep.json");
  const MockLGCY = getArtifact("Mocks.sol/MockLGCY.json");
  const MockDLGT = getArtifact("Mocks.sol/MockDLGT.json");
  const MockPRMT = getArtifact("Mocks.sol/MockPRMT.json");
  const MockUSDC = getArtifact("Mocks.sol/MockUSDC.json");

  // Deploy Mocks
  const lgcyHash = await client.deployContract({
    abi: MockLGCY.abi,
    bytecode: MockLGCY.bytecode,
  });
  const dlgtHash = await client.deployContract({
    abi: MockDLGT.abi,
    bytecode: MockDLGT.bytecode,
  });
  const prmtHash = await client.deployContract({
    abi: MockPRMT.abi,
    bytecode: MockPRMT.bytecode,
  });
  const usdcHash = await client.deployContract({
    abi: MockUSDC.abi,
    bytecode: MockUSDC.bytecode,
  });

  const [lgcyReceipt, dlgtReceipt, prmtReceipt, usdcReceipt] =
    await Promise.all([
      publicClient.waitForTransactionReceipt({ hash: lgcyHash }),
      publicClient.waitForTransactionReceipt({ hash: dlgtHash }),
      publicClient.waitForTransactionReceipt({ hash: prmtHash }),
      publicClient.waitForTransactionReceipt({ hash: usdcHash }),
    ]);

  // Deploy HotSweep
  const hotsweepHash = await client.deployContract({
    abi: HotSweep.abi,
    bytecode: HotSweep.bytecode,
    args: [account.address],
  });
  const hotsweepReceipt = await publicClient.waitForTransactionReceipt({
    hash: hotsweepHash,
  });

  return {
    server,
    rpcUrl,
    contracts: {
      hotsweep: hotsweepReceipt.contractAddress!,
      mockLGCY: lgcyReceipt.contractAddress!,
      mockDLGT: dlgtReceipt.contractAddress!,
      mockPRMT: prmtReceipt.contractAddress!,
      mockUSDC: usdcReceipt.contractAddress!,
    },
    accounts: {
      deployer: account,
    },
    publicClient,
    walletClient: client,
  };
}
