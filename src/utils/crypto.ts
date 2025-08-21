import { ethers } from 'ethers'

export function gcd(x: bigint, y: bigint): bigint {
  while (y !== 0n) {
    const t = y
    y = x % t
    x = t
  }
  return x
}

export function derivePermutationParams(seed: bigint, modulus: bigint): { a: bigint; b: bigint } {
  if (modulus <= 1n) throw new Error('Invalid modulus')
  
  const ha = ethers.solidityPackedKeccak256(['uint256', 'string'], [seed, 'a'])
  const hb = ethers.solidityPackedKeccak256(['uint256', 'string'], [seed, 'b'])
  
  let a = BigInt(ha) % modulus
  if (a === 0n) a = 1n
  
  while (gcd(a, modulus) !== 1n) {
    a = (a + 1n) % modulus
    if (a === 0n) a = 1n
  }
  
  const b = BigInt(hb) % modulus
  return { a, b }
}

export function calculateMetadataId(tokenId: number, randomSeed: bigint, maxSupply: number): number {
  const N = BigInt(maxSupply)
  const { a, b } = derivePermutationParams(randomSeed, N)
  
  const zeroIndexedToken = BigInt(tokenId - 1)
  const zeroIndexedMeta = (a * zeroIndexedToken + b) % N
  const metadataId = zeroIndexedMeta + 1n
  
  return Number(metadataId)
}
