import { ethers } from 'ethers'

export function gcd(x: bigint, y: bigint): bigint {
  while (y !== 0n) {
    const t = y
    y = x % t
    x = t
  }
  return x
}

/**
 * Generate EIP-191 signature for Phase2 holder verification
 * This matches the verification logic in the smart contract
 * @param userAddress - The address to sign for
 * @param tokenId - The token ID to include in the signature
 * @param signerPrivateKey - The private key of the signer (server-side)
 * @returns The signature string
 */
export function generatePhase2Signature(
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
  const wallet = new ethers.Wallet(signerPrivateKey)
  const signature = wallet.signingKey.sign(ethSignedMessageHash).serialized
  
  return signature
}

/**
 * Verify a Phase2 signature matches the expected format
 * This is a helper function to validate signatures before storing
 * @param userAddress - The address that should be signed
 * @param tokenId - The token ID included in the signature
 * @param signature - The signature to verify
 * @param signerAddress - The expected signer address
 * @returns true if the signature is valid
 */
export function verifyPhase2Signature(
  userAddress: string,
  tokenId: number,
  signature: string,
  signerAddress: string
): boolean {
  try {
    // Recreate the same hash as in the smart contract
    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256'],
      [userAddress, tokenId]
    )
    
    // Convert to EIP-191 signed message hash
    const ethSignedMessageHash = ethers.hashMessage(ethers.getBytes(messageHash))
    
    // Recover the signer address from the signature
    const recoveredAddress = ethers.recoverAddress(ethSignedMessageHash, signature)
    
    return recoveredAddress.toLowerCase() === signerAddress.toLowerCase()
  } catch (error) {
    console.error('Error verifying signature:', error)
    return false
  }
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
