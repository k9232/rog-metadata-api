import { PrismaClient } from "@prisma/client";
import { ethers } from "ethers";


const prisma = new PrismaClient()
const MAX_SUPPLY = 6020
async function main() {
  for (let i = 1; i <= MAX_SUPPLY; i++) {
    await prisma.nftInfo.create({
      data: {
        tokenId: i,
        boxTypeId: 1
      }
    })
  }
  
}




main();

