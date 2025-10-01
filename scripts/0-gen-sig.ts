import { PrismaClient } from "@prisma/client";
import { ethers } from "ethers";
import * as dotenv from 'dotenv'
dotenv.config()


const prisma = new PrismaClient()
const wallet = new ethers.Wallet(process.env.SIGNER_PRIVATE_KEY as string)
console.log(`Wallet: ${wallet.address}`)
async function main() {
  const emptyPhase2Holders = await prisma.phase2Holders.findMany({
    where: {
      // signature: null
    },
    orderBy: {
      id: 'desc'
    }
  })
  console.log(`Found ${emptyPhase2Holders.length} empty phase2 holders`)
  const batchSize = 100
  let promises: any[] = []
  for (const holder of emptyPhase2Holders) {
    console.log(`Adding promise to batch: ${holder.userAddress}, tokenId: ${holder.id}, boxTypeId: ${holder.boxTypeId}`)
    promises.push(generateAndStorePhase2Signature(holder.userAddress, holder.id, holder.boxTypeId, wallet.privateKey))
    if (promises.length >= batchSize) {
      await Promise.all(promises)
      promises = []
    }
  }
  if (promises.length > 0) {
    await Promise.all(promises)
  }
}

function generatePhase2Signature(
  userAddress: string,
  tokenId: number,
  signerPrivateKey: string
): string {
  // Create the hash according to the smart contract logic:
  // keccak256(abi.encodePacked(msg.sender, _tokenId))
  const messageHash = ethers.solidityPackedKeccak256(
    ['address', 'uint256'],
    [userAddress, tokenId]
  )
  
  // Convert to EIP-191 signed message hash
  const ethSignedMessageHash = ethers.hashMessage(ethers.getBytes(messageHash))
  
  // Sign with the private key
  const signature = wallet.signingKey.sign(ethSignedMessageHash).serialized
  
  return signature
}

async function generateAndStorePhase2Signature(
  userAddress: string, 
  tokenId: number, 
  boxTypeId: number,
  signerPrivateKey: string
): Promise<string> {
  // Generate the signature
  const signature = generatePhase2Signature(userAddress, tokenId, signerPrivateKey)
  
  // Update the Phase2Holders record with the signature
  await prisma.phase2Holders.updateMany({
    where: {
      userAddress,
      boxTypeId
    },
    data: {
      signature
    }
  })
  
  return signature
}


main();

